export type DdlKind = "int" | "float" | "boolean" | "date" | "json" | "uuid" | "bytes" | "string";

export type DdlColumn = {
	name: string;
	type: string;
	kind: DdlKind;
	nullable: boolean;
	primaryKey: boolean;
	unique: boolean;
	autoIncrement: boolean;
	defaultValue: string | null;
	references: { table: string; column: string } | null;
};

export type DdlTable = { name: string; columns: DdlColumn[]; compositePrimaryKey: string[] };

const kindFor = (type: string): DdlKind => {
	const base = type.toLowerCase().replace(/\(.*$/u, "").trim();
	if (/^(smallint|int|integer|bigint|serial|bigserial|smallserial|tinyint|mediumint)$/u.test(base)) return "int";
	if (/^(numeric|decimal|real|double|double precision|float|float4|float8|money)$/u.test(base)) return "float";
	if (/^(bool|boolean)$/u.test(base)) return "boolean";
	if (/^(date|time|timetz|timestamp|timestamptz|datetime|timestamp with time zone|timestamp without time zone)$/u.test(base)) return "date";
	if (/^(json|jsonb)$/u.test(base)) return "json";
	if (base === "uuid") return "uuid";
	if (/^(bytea|blob|binary|varbinary)$/u.test(base)) return "bytes";
	return "string";
};

const cleanIdentifier = (raw: string) => {
	const trimmed = raw.trim();
	const quoted = /(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\])\s*$/u.exec(trimmed);
	if (quoted) return quoted[1] ?? quoted[2] ?? quoted[3];
	const parts = trimmed.split(".");
	return parts[parts.length - 1].replace(/^[^\w]+|[^\w]+$/gu, "");
};

const splitDefinitions = (body: string) => {
	const parts: string[] = [];
	let current = "";
	let depth = 0;
	let quote: string | null = null;
	for (const character of body) {
		if (quote) {
			current += character;
			if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
			current += character;
			continue;
		}
		if (character === "(") depth += 1;
		if (character === ")") depth -= 1;
		if (character === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += character;
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
};

const statementSplit = (sql: string) => sql.split(";").map((statement) => statement.trim()).filter(Boolean);

export const parseDdl = (source: string): DdlTable[] => {
	if (!source.trim()) throw new Error("Paste CREATE TABLE statements first.");
	const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/--[^\n]*/gu, " ");
	const tables: DdlTable[] = [];
	for (const statement of statementSplit(withoutComments)) {
		const header = /^create\s+(?:temp(?:orary)?\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*)\)\s*$/iu.exec(statement);
		if (!header) throw new Error(`Only CREATE TABLE statements are supported. Got: ${statement.slice(0, 40)}…`);
		const name = cleanIdentifier(header[1]);
		const columns: DdlColumn[] = [];
		const compositePrimaryKey: string[] = [];
		for (const definition of splitDefinitions(header[2])) {
			if (/^(constraint\s+\S+\s+)?(primary\s+key|unique|foreign\s+key|check|index|key)\b/iu.test(definition)) {
				const primary = /^(constraint\s+\S+\s+)?primary\s+key\s*\(([^)]*)\)/iu.exec(definition);
				if (primary) compositePrimaryKey.push(...splitDefinitions(primary[2]).map(cleanIdentifier));
				continue;
			}
			const match = /^("[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)\s+([A-Za-z_]+(?:\s+(?:precision|varying))?(?:\s+(?:with|without)\s+time\s+zone)?(?:\s*\([^)]*\))?(?:\[\])?)([\s\S]*)$/u.exec(definition);
			if (!match) continue;
			const columnName = cleanIdentifier(match[1]);
			const type = match[2].trim();
			const rest = match[3] ?? "";
			const notNull = /\bnot\s+null\b/iu.test(rest);
			const primaryKey = /\bprimary\s+key\b/iu.test(rest);
			const defaultValue = /\bdefault\s+('(?:[^']|'')*'|[^\s,]+)/iu.exec(rest)?.[1] ?? null;
			const reference = /\breferences\s+([^\s(]+)\s*(?:\(\s*([^)]+)\s*\))?/iu.exec(rest);
			columns.push({
				name: columnName,
				type,
				kind: kindFor(type),
				nullable: !notNull && !primaryKey,
				primaryKey,
				unique: /\bunique\b/iu.test(rest),
				autoIncrement: /\b(auto_increment|autoincrement|identity|serial)\b/iu.test(`${type} ${rest}`),
				defaultValue,
				references: reference ? { table: cleanIdentifier(reference[1]), column: cleanIdentifier(reference[2] ?? "id") } : null,
			});
		}
		if (columns.length === 0) throw new Error(`No columns found for table ${name}.`);
		for (const column of columns) if (compositePrimaryKey.includes(column.name)) column.primaryKey = true;
		tables.push({ name, columns, compositePrimaryKey: compositePrimaryKey.length ? compositePrimaryKey : columns.filter((column) => column.primaryKey).map((column) => column.name) });
	}
	if (tables.length === 0) throw new Error("No CREATE TABLE statements found.");
	return tables;
};

const pascal = (value: string) => value.replace(/(^|[-_.\s])(\w)/gu, (_, __: string, letter: string) => letter.toUpperCase());

const prismaScalar = (column: DdlColumn) => {
	switch (column.kind) {
		case "int":
			return "Int";
		case "float":
			return "Float";
		case "boolean":
			return "Boolean";
		case "date":
			return "DateTime";
		case "json":
			return "Json";
		case "bytes":
			return "Bytes";
		default:
			return "String";
	}
};

const prismaDefault = (raw: string | null) => {
	if (!raw) return "";
	const value = raw.trim();
	if (/^now\(\)$/iu.test(value) || /^current_timestamp$/iu.test(value)) return "@default(now())";
	if (/^(gen_random_uuid\(\)|uuid_generate_v4\(\)|uuid\(\))$/iu.test(value)) return "@default(uuid())";
	if (/^(true|false)$/iu.test(value)) return `@default(${value.toLowerCase()})`;
	if (/^-?\d+(\.\d+)?$/u.test(value)) return `@default(${value})`;
	if (/^'.*'$/u.test(value)) return `@default("${value.slice(1, -1).replaceAll("''", "'")}")`;
	if (/^null$/iu.test(value)) return "";
	return "";
};

export type DdlTarget = "prisma" | "typescript" | "mongoose";

export const ddlToPrisma = (tables: DdlTable[], options: { mapTables: boolean } = { mapTables: true }) => {
	const blocks = tables.map((table) => {
		const modelName = pascal(table.name);
		const lines = table.columns.map((column) => {
			const modifiers = [column.primaryKey ? "@id" : "", column.unique && !column.primaryKey ? "@unique" : ""].filter(Boolean);
			const auto = column.autoIncrement ? "@default(autoincrement())" : prismaDefault(column.defaultValue);
			if (column.primaryKey && column.kind === "uuid" && !auto) modifiers.push("@default(uuid())");
			if (auto) modifiers.push(auto);
			const optional = column.nullable && !column.primaryKey ? "?" : "";
			const comment = column.references ? ` // references ${column.references.table}(${column.references.column})` : "";
			return `  ${column.name} ${prismaScalar(column)}${optional}${modifiers.length ? ` ${modifiers.join(" ")}` : ""}${comment}`;
		});
		if (table.compositePrimaryKey.length > 1) {
			lines.push(`  @@id([${table.compositePrimaryKey.join(", ")}])`);
		}
		if (options.mapTables && modelName.toLowerCase() !== table.name.toLowerCase()) lines.push(`  @@map("${table.name}")`);
		return `model ${modelName} {\n${lines.join("\n")}\n}`;
	});
	return `${blocks.join("\n\n")}\n`;
};

const tsType = (column: DdlColumn) => {
	switch (column.kind) {
		case "int":
		case "float":
			return "number";
		case "boolean":
			return "boolean";
		case "date":
			return "string";
		case "json":
			return "Record<string, unknown>";
		case "bytes":
			return "Uint8Array";
		default:
			return "string";
	}
};

export const ddlToTypeScript = (tables: DdlTable[]) =>
	`// Generated from SQL DDL by ClickKit.\n${tables
		.map((table) => {
			const fields = table.columns.map((column) => {
				const comment = column.primaryKey ? "  /** primary key */\n" : column.references ? `  /** references ${column.references.table}(${column.references.column}) */\n` : "";
				return `${comment}  ${column.name}${column.nullable ? "?" : ""}: ${tsType(column)}${column.nullable ? " | null" : ""};`;
			});
			const name = pascal(table.name);
			return `export interface ${name} {\n${fields.join("\n")}\n}`;
		})
		.join("\n\n")}\n`;

const mongooseType = (column: DdlColumn) => {
	switch (column.kind) {
		case "int":
		case "float":
			return "Number";
		case "boolean":
			return "Boolean";
		case "date":
			return "Date";
		case "json":
			return "Schema.Types.Mixed";
		default:
			return "String";
	}
};

export const ddlToMongoose = (tables: DdlTable[]) =>
	`// Generated from SQL DDL by ClickKit.\nimport mongoose from "mongoose";\n\nconst { Schema } = mongoose;\n\n${tables
		.map((table) => {
			const name = pascal(table.name);
			const fields = table.columns.map((column) => {
				const extras = [`type: ${mongooseType(column)}`];
				if (!column.nullable) extras.push("required: true");
				if (column.unique) extras.push("unique: true");
				if (column.defaultValue && /^'.*'$/u.test(column.defaultValue)) extras.push(`default: "${column.defaultValue.slice(1, -1)}"`);
				if (column.defaultValue && /^-?\d+(\.\d+)?$/u.test(column.defaultValue)) extras.push(`default: ${column.defaultValue}`);
				return `  ${column.name}: { ${extras.join(", ")} }`;
			});
			return `export const ${name}Schema = new Schema({\n${fields.join(",\n")}\n});\nexport const ${name} = mongoose.model("${name}", ${name}Schema);`;
		})
		.join("\n\n")}\n`;
