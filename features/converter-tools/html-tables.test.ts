import { describe, expect, it } from "vitest";
import { describeTable, readHtmlTables, tableToCsv, tableToMarkdown } from "@/features/converter-tools/html-tables";

const page = `
<html><body>
	<h1>Spending</h1>
	<table>
		<caption>March</caption>
		<thead><tr><th>Item</th><th>Cost</th></tr></thead>
		<tbody>
			<tr><td>Tea</td><td>3.50</td></tr>
			<tr><td>Coffee, ground</td><td>12</td></tr>
		</tbody>
	</table>
	<table>
		<tr><td>Only one cell</td></tr>
	</table>
</body></html>`;

describe("finding tables", () => {
	it("takes every table in the page, in order", () => {
		const tables = readHtmlTables(page);
		expect(tables).toHaveLength(2);
		expect(tables[0].rows).toEqual([
			["Item", "Cost"],
			["Tea", "3.50"],
			["Coffee, ground", "12"],
		]);
	});

	it("keeps the caption as a name", () => {
		const [first] = readHtmlTables(page);
		expect(first.caption).toBe("March");
		expect(describeTable(first)).toBe("March — 3 rows, 2 columns");
		expect(describeTable({ index: 1, caption: "", rows: [["a"]] })).toBe("Table 2 — 1 rows, 1 columns");
	});

	it("fills in a spanning cell so the columns stay lined up", () => {
		const [table] = readHtmlTables(`<table>
			<tr><td colspan="2">Totals</td></tr>
			<tr><td>Tea</td><td>3.50</td></tr>
			<tr><td rowspan="2">Two rows</td><td>a</td></tr>
			<tr><td>b</td></tr>
		</table>`);
		expect(table.rows).toEqual([
			["Totals", ""],
			["Tea", "3.50"],
			["Two rows", "a"],
			["", "b"],
		]);
	});

	it("squeezes the whitespace out of cells", () => {
		const [table] = readHtmlTables("<table><tr><td>\n   a   b\n  </td><td><b>bold</b> text</td></tr></table>");
		expect(table.rows).toEqual([["a b", "bold text"]]);
	});

	it("ignores markup with no tables in it", () => {
		expect(readHtmlTables("<p>nothing here</p>")).toEqual([]);
		expect(readHtmlTables("<table><tr><td> </td></tr></table>")).toEqual([]);
	});
});

describe("writing tables out", () => {
	const rows = [
		["Item", "Cost"],
		["Coffee, ground", "12"],
		['He said "hi"', ""],
	];

	it("writes CSV with quotes where they are needed", () => {
		expect(tableToCsv(rows)).toBe('Item,Cost\n"Coffee, ground",12\n"He said ""hi""",\n');
	});

	it("writes a Markdown table with even columns", () => {
		const markdown = tableToMarkdown(rows);
		const lines = markdown.split("\n");
		expect(lines[0]).toBe("| Item           | Cost |");
		expect(lines[1]).toBe("| -------------- | ---- |");
		expect(lines[2]).toBe('| Coffee, ground | 12   |');
	});

	it("escapes a pipe so the table does not split", () => {
		expect(tableToMarkdown([["a|b", "c"]])).toContain("a\\|b");
	});

	it("has nothing to write for no rows", () => {
		expect(tableToMarkdown([])).toBe("");
	});
});
