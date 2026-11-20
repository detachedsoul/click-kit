import { readHtmlTables, tableToMarkdown } from "@/features/converter-tools/html-tables";

export type Alignment = "center" | "left" | "right" | null;

export type MarkdownTable = {
	rows: string[][];
	align: Alignment[];
};

export type ConvertedTable = {
	/** Which way the paste was read. */
	kind: "html" | "markdown";
	output: string;
	rows: number;
	columns: number;
};

const DELIMITER = /^:?-{1,}:?$/u;

/** A row split on the pipes that are not escaped, with `\|` turned back into a pipe. */
const cells = (line: string) => {
	const trimmed = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
	return trimmed.split(/(?<!\\)\|/u).map((cell) => cell.replace(/\\\|/gu, "|").trim());
};

const alignmentOf = (line: string): Alignment[] | null => {
	const row = cells(line);
	if (!row.length || !row.every((cell) => DELIMITER.test(cell))) return null;
	return row.map((cell) => {
		const left = cell.startsWith(":");
		const right = cell.endsWith(":");
		if (left && right) return "center";
		if (right) return "right";
		if (left) return "left";
		return null;
	});
};

/**
 * Read the first pipe table in a block of Markdown.
 *
 * The delimiter row is what makes a table a table, so a paragraph with pipes in it is
 * skipped rather than mangled: only a header line followed by `|---|:--:|` is taken.
 */
export const parseMarkdownTable = (text: string): MarkdownTable | null => {
	const lines = text.replace(/\r\n?/gu, "\n").split("\n");
	for (let index = 0; index < lines.length - 1; index += 1) {
		const header = lines[index];
		if (!header.includes("|")) continue;
		const align = alignmentOf(lines[index + 1]);
		if (!align) continue;
		const rows = [cells(header)];
		let cursor = index + 2;
		while (cursor < lines.length && lines[cursor].trim() && lines[cursor].includes("|")) {
			rows.push(cells(lines[cursor]));
			cursor += 1;
		}
		const columns = rows.reduce((most, row) => Math.max(most, row.length), 0);
		return {
			align: Array.from({ length: columns }, (_, column) => align[column] ?? null),
			rows: rows.map((row) => Array.from({ length: columns }, (_, column) => row[column] ?? "")),
		};
	}
	return null;
};

const escape = (value: string) => value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

const styleOf = (align: Alignment) => (align ? ` style="text-align: ${align}"` : "");

/** The table as HTML, indented enough to read, with the header row in a `<thead>`. */
export const tableToHtml = (table: MarkdownTable): string => {
	const [header, ...body] = table.rows;
	const cell = (tag: "td" | "th", value: string, column: number) => `<${tag}${styleOf(table.align[column] ?? null)}>${escape(value)}</${tag}>`;
	const row = (tag: "td" | "th", values: string[], indent: string) => [`${indent}<tr>`, ...values.map((value, column) => `${indent}  ${cell(tag, value, column)}`), `${indent}</tr>`];
	const lines = ["<table>"];
	if (header && header.some((value) => value !== "")) {
		lines.push("  <thead>", ...row("th", header, "    "), "  </thead>");
	}
	if (body.length) {
		lines.push("  <tbody>");
		for (const values of body) lines.push(...row("td", values, "    "));
		lines.push("  </tbody>");
	}
	lines.push("</table>");
	return lines.join("\n");
};

/** The first HTML table found in the text, as rows. */
export const htmlToMarkdownTable = (text: string): MarkdownTable | null => {
	const [first] = readHtmlTables(text);
	if (!first) return null;
	const columns = first.rows.reduce((most, row) => Math.max(most, row.length), 0);
	return { align: Array.from({ length: columns }, () => null), rows: first.rows.map((row) => Array.from({ length: columns }, (_, column) => row[column] ?? "")) };
};

/** Which of the two the paste looks like. Markup wins: a `<table>` is unmistakable. */
export const detectTable = (text: string): "html" | "markdown" | null => {
	if (/<table[\s>]/iu.test(text)) return "html";
	if (parseMarkdownTable(text)) return "markdown";
	return null;
};

/** Read it whichever way round it is, and write it out the other way. */
export const convertTable = (text: string): ConvertedTable => {
	if (!text.trim()) throw new Error("Paste a table first — either a Markdown pipe table or a <table> element.");
	const kind = detectTable(text);
	if (!kind) throw new Error("No table found. A Markdown table needs a line of dashes under the header, like |---|:--:|.");
	const table = kind === "html" ? htmlToMarkdownTable(text) : parseMarkdownTable(text);
	if (!table || !table.rows.length) throw new Error("No table found. Check that the rows have cells in them.");
	const columns = table.rows.reduce((most, row) => Math.max(most, row.length), 0);
	return {
		columns,
		kind,
		output: kind === "html" ? `${tableToMarkdown(table.rows)}\n` : tableToHtml(table),
		rows: table.rows.length,
	};
};
