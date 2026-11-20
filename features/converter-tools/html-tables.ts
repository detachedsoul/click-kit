/**
 * Pulling the tables out of a web page.
 *
 * Copying a table out of a browser usually brings formatting, links, and invisible spacing
 * with it. This reads the markup with the browser's own parser, walks each `<table>`, and
 * gives back plain rows — which is what a spreadsheet wants.
 */

export type HtmlTable = { index: number; caption: string; rows: string[][] };
export type TableFormat = "csv" | "markdown";

const csvCell = (value: string) => (/[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value);

const clean = (text: string) => text.replace(/\s+/gu, " ").trim();

/**
 * Rows of a table as a square grid. A colspan or rowspan takes up its cells, so the
 * columns stay aligned instead of everything after it sliding left.
 */
const rowsOf = (table: HTMLTableElement): string[][] => {
	const grid: string[][] = [];
	const taken: boolean[][] = [];
	Array.from(table.rows).forEach((row, rowIndex) => {
		grid[rowIndex] ??= [];
		taken[rowIndex] ??= [];
		let column = 0;
		for (const cell of Array.from(row.cells)) {
			while (taken[rowIndex][column]) column += 1;
			const width = Math.max(1, cell.colSpan || 1);
			const height = Math.max(1, cell.rowSpan || 1);
			const text = clean(cell.textContent ?? "");
			for (let down = 0; down < height; down += 1) {
				const target = rowIndex + down;
				grid[target] ??= [];
				taken[target] ??= [];
				for (let across = 0; across < width; across += 1) {
					taken[target][column + across] = true;
					grid[target][column + across] = down === 0 && across === 0 ? text : "";
				}
			}
			column += width;
		}
	});
	return grid.map((row) => Array.from(row, (value) => (value ?? "").trim()));
};

/** Every table in the markup, in the order it appears. */
export const readHtmlTables = (html: string): HtmlTable[] => {
	const parsed = new DOMParser().parseFromString(html, "text/html");
	return Array.from(parsed.querySelectorAll("table"))
		.map((table, index) => ({
			index,
			caption: clean(table.caption?.textContent ?? ""),
			rows: rowsOf(table as HTMLTableElement).filter((row) => row.some((cell) => cell !== "")),
		}))
		.filter((table) => table.rows.length > 0);
};

export const tableToCsv = (rows: string[][]): string => `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;

/** A Markdown table, with the column widths padded so it still reads well in plain text. */
export const tableToMarkdown = (rows: string[][]): string => {
	if (!rows.length) return "";
	const width = rows.reduce((most, row) => Math.max(most, row.length), 0);
	const padded = rows.map((row) => Array.from({ length: width }, (_, index) => (row[index] ?? "").replace(/\|/gu, "\\|")));
	const sizes = Array.from({ length: width }, (_, column) => Math.max(3, ...padded.map((row) => row[column].length)));
	const line = (row: string[]) => `| ${row.map((cell, index) => cell.padEnd(sizes[index])).join(" | ")} |`;
	return [line(padded[0]), `| ${sizes.map((size) => "-".repeat(size)).join(" | ")} |`, ...padded.slice(1).map(line)].join("\n");
};

export const describeTable = (table: HtmlTable): string => {
	const name = table.caption || `Table ${table.index + 1}`;
	const columns = table.rows.reduce((most, row) => Math.max(most, row.length), 0);
	return `${name} — ${table.rows.length} rows, ${columns} columns`;
};
