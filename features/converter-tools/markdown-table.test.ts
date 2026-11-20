import { describe, expect, it } from "vitest";
import { convertTable, detectTable, htmlToMarkdownTable, parseMarkdownTable, tableToHtml } from "@/features/converter-tools/markdown-table";

const MD = `| Item | Qty | Cost |
| :--- | --: | :-: |
| Tea | 2 | 4.50 |
| Coffee | 1 | 6.00 |`;

describe("parseMarkdownTable", () => {
	it("reads rows and their alignment", () => {
		const table = parseMarkdownTable(MD);
		expect(table?.rows).toEqual([
			["Item", "Qty", "Cost"],
			["Tea", "2", "4.50"],
			["Coffee", "1", "6.00"],
		]);
		expect(table?.align).toEqual(["left", "right", "center"]);
	});

	it("skips prose above the table", () => {
		expect(parseMarkdownTable(`Here is what I bought | yesterday\n\n${MD}`)?.rows).toHaveLength(3);
	});

	it("stops at the blank line under the table", () => {
		const table = parseMarkdownTable(`${MD}\n\nAnd that was that.`);
		expect(table?.rows).toHaveLength(3);
	});

	it("keeps a pipe that was escaped", () => {
		expect(parseMarkdownTable("| a \\| b | c |\n| --- | --- |\n| 1 | 2 |")?.rows[0]).toEqual(["a | b", "c"]);
	});

	it("pads a short row so the columns line up", () => {
		expect(parseMarkdownTable("| a | b | c |\n| --- | --- | --- |\n| 1 |")?.rows[1]).toEqual(["1", "", ""]);
	});

	it("is not fooled by pipe-less text", () => {
		expect(parseMarkdownTable("no table here")).toBeNull();
		expect(parseMarkdownTable("| only a header |\nno dashes")).toBeNull();
	});
});

describe("tableToHtml", () => {
	it("writes a thead, a tbody, and the alignment", () => {
		const html = tableToHtml(parseMarkdownTable(MD) ?? { align: [], rows: [] });
		expect(html).toContain("<thead>");
		expect(html).toContain('<th style="text-align: left">Item</th>');
		expect(html).toContain('<th style="text-align: right">Qty</th>');
		expect(html).toContain('<th style="text-align: center">Cost</th>');
		expect(html).toContain('<td style="text-align: left">Coffee</td>');
		expect(html.trimEnd().endsWith("</table>")).toBe(true);
	});

	it("escapes markup inside a cell", () => {
		const html = tableToHtml({ align: [null], rows: [["<script>"], ['a & "b"']] });
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("a &amp; &quot;b&quot;");
	});
});

describe("htmlToMarkdownTable", () => {
	it("turns a table element into a pipe table", () => {
		const table = htmlToMarkdownTable("<table><tr><th>Item</th><th>Qty</th></tr><tr><td>Tea</td><td>2</td></tr></table>");
		expect(table?.rows).toEqual([
			["Item", "Qty"],
			["Tea", "2"],
		]);
		expect(tableToHtml(table ?? { align: [], rows: [] })).toContain("<th>Item</th>");
	});

	it("returns nothing when there is no table", () => {
		expect(htmlToMarkdownTable("<p>just words</p>")).toBeNull();
	});
});

describe("convertTable", () => {
	it("goes from Markdown to HTML", () => {
		const result = convertTable(MD);
		expect(result.kind).toBe("markdown");
		expect(result.rows).toBe(3);
		expect(result.columns).toBe(3);
		expect(result.output).toContain('<td style="text-align: left">Tea</td>');
	});

	it("goes from HTML to Markdown", () => {
		const result = convertTable("<table><tr><th>Item</th><th>Qty</th></tr><tr><td>Tea</td><td>2</td></tr></table>");
		expect(result.kind).toBe("html");
		expect(result.output).toBe("| Item | Qty |\n| ---- | --- |\n| Tea  | 2   |\n");
	});

	it("knows which way round a paste is", () => {
		expect(detectTable(MD)).toBe("markdown");
		expect(detectTable("<TABLE><tr><td>x</td></tr></TABLE>")).toBe("html");
		expect(detectTable("nothing at all")).toBeNull();
	});

	it("complains in words when there is no table", () => {
		expect(() => convertTable("   ")).toThrow(/Paste a table first/u);
		expect(() => convertTable("just a paragraph")).toThrow(/No table found/u);
	});
});
