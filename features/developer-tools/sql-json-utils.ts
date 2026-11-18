export type SqlTable = { table: string; columns: string[]; rows: Record<string, unknown>[] };
export type SqlReport = { tables: SqlTable[]; warnings: string[]; statements: number };

const identifier = (raw: string) => {
	const last = raw.trim().split(".").pop() ?? raw;
	return last.replace(/^["`\[]/u, "").replace(/["`\]]$/u, "");
};

const stripComments = (source: string) => {
	let output = "";
	let quote: string | null = null;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			output += character;
			if (character === "'" && source[index + 1] === "'") {
				output += "'";
				index += 1;
			} else if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			output += character;
			continue;
		}
		if (character === "-" && source[index + 1] === "-") {
			while (index < source.length && source[index] !== "\n") index += 1;
			output += "\n";
			continue;
		}
		if (character === "/" && source[index + 1] === "*") {
			index += 2;
			while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
			index += 1;
			continue;
		}
		output += character;
	}
	if (quote) throw new Error("Unterminated string literal in the SQL.");
	return output;
};

const splitStatements = (source: string) => {
	const statements: string[] = [];
	let current = "";
	let quote: string | null = null;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			current += character;
			if (character === "'" && source[index + 1] === "'") {
				current += "'";
				index += 1;
			} else if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			current += character;
			continue;
		}
		if (character === ";") {
			if (current.trim()) statements.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	if (current.trim()) statements.push(current.trim());
	return statements;
};

export const splitTopLevel = (source: string, separator = ",") => {
	const parts: string[] = [];
	let current = "";
	let depth = 0;
	let quote: string | null = null;
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index];
		if (quote) {
			current += character;
			if (character === "'" && source[index + 1] === "'") {
				current += "'";
				index += 1;
			} else if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			current += character;
			continue;
		}
		if (character === "(" || character === "[") depth += 1;
		if (character === ")" || character === "]") depth -= 1;
		if (character === separator && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
};

const parseValue = (raw: string): unknown => {
	const value = raw.trim();
	if (/^null$/iu.test(value)) return null;
	if (/^true$/iu.test(value)) return true;
	if (/^false$/iu.test(value)) return false;
	if (/^'-?\d+'::/u.test(value)) return parseValue(value.split("::")[0]);
	if (/^-?\d+$/u.test(value)) return Number(value);
	if (/^-?\d*\.\d+(e[-+]?\d+)?$/iu.test(value)) return Number(value);
	if (/^'[\s\S]*'$/u.test(value)) return value.slice(1, -1).replaceAll("''", "'");
	if (/^"[\s\S]*"$/u.test(value)) return value.slice(1, -1);
	if (/^e'[\s\S]*'$/iu.test(value)) return value.slice(2, -1).replace(/\\n/gu, "\n").replace(/\\'/gu, "'");
	return value;
};

export const parseSqlInserts = (source: string, options: { castTypes?: boolean } = {}): SqlReport => {
	if (!source.trim()) throw new Error("Paste INSERT statements first.");
	const cast = options.castTypes ?? true;
	const statements = splitStatements(stripComments(source));
	if (statements.length === 0) throw new Error("No SQL statements found.");
	const tables = new Map<string, SqlTable>();
	const warnings: string[] = [];
	let insertCount = 0;
	for (const statement of statements) {
		const match = /^insert\s+(?:or\s+\w+\s+)?into\s+([^\s(]+)\s*(?:\(([^)]*)\))?\s*values\s*([\s\S]+)$/iu.exec(statement);
		if (!match) {
			if (/^(create|alter|drop|select|update|delete|set|begin|commit)\b/iu.test(statement)) warnings.push(`Skipped a ${statement.split(/\s+/u)[0].toUpperCase()} statement; only INSERTs are converted.`);
			else warnings.push(`Skipped an unrecognised statement: ${statement.slice(0, 60)}…`);
			continue;
		}
		insertCount += 1;
		const tableName = identifier(match[1]);
		const columns = match[2] ? splitTopLevel(match[2]).map((column) => identifier(column)) : [];
		const valueGroups = splitTopLevel(match[3]).filter(Boolean);
		const existing = tables.get(tableName) ?? { table: tableName, columns: [], rows: [] };
		for (const group of valueGroups) {
			if (!group.startsWith("(") || !group.endsWith(")")) throw new Error(`Could not read the VALUES tuple: ${group.slice(0, 60)}`);
			const values = splitTopLevel(group.slice(1, -1)).map((item) => (cast ? parseValue(item) : item.replace(/^'[\s\S]*'$/u, (raw) => raw.slice(1, -1))));
			const keys = existing.columns.length ? existing.columns : columns.length ? columns : values.map((_, index) => `column_${index + 1}`);
			if (values.length !== keys.length) {
				warnings.push(`${tableName}: a row has ${values.length} values but ${keys.length} columns; extra values are dropped.`);
			}
			const row: Record<string, unknown> = {};
			keys.forEach((key, index) => {
				if (index < values.length) row[key] = values[index];
			});
			existing.rows.push(row);
		}
		if (!existing.columns.length) existing.columns = Object.keys(existing.rows[0] ?? {});
		tables.set(tableName, existing);
	}
	if (insertCount === 0) throw new Error("No INSERT statements found in this SQL.");
	const list = [...tables.values()];
	return { tables: list, warnings, statements: insertCount };
};

export const sqlToJson = (source: string, options: { castTypes: boolean; wrap: boolean }) => {
	const report = parseSqlInserts(source, { castTypes: options.castTypes });
	if (report.tables.length === 1) {
		return { text: JSON.stringify(report.tables[0].rows, null, 2), report };
	}
	const object = Object.fromEntries(report.tables.map((table) => [table.table, table.rows]));
	return { text: JSON.stringify(options.wrap ? { tables: object } : object, null, 2), report };
};
