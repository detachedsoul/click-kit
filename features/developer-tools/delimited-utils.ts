export type Delimiter = "," | "\t" | ";" | "|";

export type DelimitedTable = { rows: string[][]; delimiter: Delimiter; columns: number; hasHeader: boolean };

export type DelimitedOutput = "json" | "json-array" | "csv" | "tsv" | "markdown" | "sql";

const delimiterNames: Record<Delimiter, string> = { ",": "comma", "\t": "tab", ";": "semicolon", "|": "pipe" };

export const delimiterLabel = (delimiter: Delimiter) => delimiterNames[delimiter];

export const detectDelimiter = (source: string): Delimiter => {
	const firstLine = source.split(/\r?\n/u).find((line) => line.trim()) ?? "";
	const candidates: Delimiter[] = [",", "\t", ";", "|"];
	let best: { delimiter: Delimiter; count: number } = { delimiter: ",", count: -1 };
	for (const candidate of candidates) {
		let count = 0;
		let quoted = false;
		for (let index = 0; index < firstLine.length; index += 1) {
			const character = firstLine[index];
			if (character === '"') quoted = !quoted;
			else if (character === candidate && !quoted) count += 1;
		}
		if (count > best.count) best = { delimiter: candidate, count };
	}
	return best.delimiter;
};

export const parseDelimited = (source: string, requested: Delimiter | "auto" = "auto"): DelimitedTable => {
	if (!source.trim()) throw new Error("Paste delimited data first.");
	const delimiter = requested === "auto" ? detectDelimiter(source) : requested;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	let index = 0;
	while (index < source.length) {
		const character = source[index];
		if (quoted) {
			if (character === '"') {
				if (source[index + 1] === '"') {
					field += '"';
					index += 2;
					continue;
				}
				quoted = false;
				index += 1;
				continue;
			}
			field += character;
			index += 1;
			continue;
		}
		if (character === '"') {
			quoted = true;
			index += 1;
			continue;
		}
		if (character === delimiter) {
			row.push(field);
			field = "";
			index += 1;
			continue;
		}
		if (character === "\r") {
			index += 1;
			continue;
		}
		if (character === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
			index += 1;
			continue;
		}
		field += character;
		index += 1;
	}
	if (quoted) throw new Error("Unclosed quote in the data.");
	row.push(field);
	rows.push(row);
	const cleaned = rows.filter((cells) => cells.length > 1 || cells[0]!.trim() !== "");
	if (cleaned.length === 0) throw new Error("No rows found.");
	const columns = Math.max(...cleaned.map((cells) => cells.length));
	for (const cells of cleaned) {
		while (cells.length < columns) cells.push("");
	}
	return { rows: cleaned, delimiter, columns, hasHeader: cleaned.length > 1 };
};

const needsQuote = (value: string, delimiter: Delimiter) => value.includes(delimiter) || /["\r\n]/u.test(value);

const joinDelimited = (rows: string[][], delimiter: Delimiter) =>
	rows.map((cells) => cells.map((cell) => (needsQuote(cell, delimiter) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(delimiter)).join("\n");

const uniqueHeaders = (header: string[]) => {
	const seen = new Map<string, number>();
	return header.map((name, indexPos) => {
		const base = name.trim() || `column_${indexPos + 1}`;
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}_${count + 1}`;
	});
};

const typedValue = (value: string): unknown => {
	const trimmed = value.trim();
	if (trimmed === "") return null;
	if (/^(true|false)$/iu.test(trimmed)) return trimmed.toLowerCase() === "true";
	if (/^-?\d+(\.\d+)?$/u.test(trimmed)) return Number(trimmed);
	return value;
};

export const rowsToObjects = (table: DelimitedTable, typed = true) => {
	const [header, ...body] = table.rows;
	const keys = uniqueHeaders(header ?? []);
	return body.map((cells) => Object.fromEntries(keys.map((key, position) => [key, typed ? typedValue(cells[position] ?? "") : cells[position] ?? ""])));
};

export const toMarkdownTable = (table: DelimitedTable) => {
	const [header, ...body] = table.rows;
	const escape = (value: string) => value.replace(/\|/gu, "\\|").trim();
	const lines = [`| ${header.map(escape).join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
	for (const cells of body) lines.push(`| ${cells.map(escape).join(" | ")} |`);
	return lines.join("\n");
};

export const toSql = (table: DelimitedTable, tableName: string, dialect: "postgres" | "mysql" | "sqlite") => {
	const quoteName = (name: string) => {
		const safe = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) ? name : name.replace(/[^A-Za-z0-9_]/gu, "_");
		return dialect === "mysql" ? `\`${safe}\`` : `"${safe}"`;
	};
	const [header, ...body] = table.rows;
	const keys = uniqueHeaders(header ?? []);
	const columns = keys.map(quoteName).join(", ");
	const values = body.map((cells) => `(${cells.map((cell) => (cell.trim() === "" ? "NULL" : `'${cell.replaceAll("'", "''")}'`)).join(", ")})`);
	const target = quoteName(tableName.trim() || "data");
	return `INSERT INTO ${target} (${columns})\nVALUES\n  ${values.join(",\n  ")};`;
};

export const convertDelimited = (source: string, options: { delimiter: Delimiter | "auto"; output: DelimitedOutput; table: string; typed: boolean }) => {
	const table = parseDelimited(source, options.delimiter);
	switch (options.output) {
		case "json":
			return { text: JSON.stringify(rowsToObjects(table, options.typed), null, 2), table };
		case "json-array":
			return { text: JSON.stringify(table.rows, null, 2), table };
		case "csv":
			return { text: joinDelimited(table.rows, ","), table };
		case "tsv":
			return { text: joinDelimited(table.rows, "\t"), table };
		case "markdown":
			return { text: toMarkdownTable(table), table };
		default:
			return { text: toSql(table, options.table, "postgres"), table };
	}
};
