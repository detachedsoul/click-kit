import { describe, expect, it } from "vitest";
import { readZipEntries } from "@/features/converter-tools/zip-reader";
import { asNumber, buildXlsx, columnIndex, columnName, csvToRows, escapeXml, readXlsx, rowsToCsv, sheetName, sheetSummary, sheetXml } from "@/features/converter-tools/xlsx";

describe("cell references", () => {
	it("names columns the spreadsheet way", () => {
		expect(columnName(0)).toBe("A");
		expect(columnName(25)).toBe("Z");
		expect(columnName(26)).toBe("AA");
		expect(columnName(27)).toBe("AB");
		expect(columnName(701)).toBe("ZZ");
		expect(columnName(702)).toBe("AAA");
	});

	it("reads them back", () => {
		expect(columnIndex("A1")).toBe(0);
		expect(columnIndex("Z9")).toBe(25);
		expect(columnIndex("AA3")).toBe(26);
		expect(columnIndex("b2")).toBe(1);
	});
});

describe("cells", () => {
	it("escapes the characters XML cares about", () => {
		expect(escapeXml(`Fish & <chips> "yes" 'no'`)).toBe("Fish &amp; &lt;chips&gt; &quot;yes&quot; &apos;no&apos;");
	});

	it("knows a number when it sees one", () => {
		expect(asNumber("12")).toBe(12);
		expect(asNumber("-3.5")).toBe(-3.5);
		expect(asNumber("1.2.3")).toBeNull();
		expect(asNumber("12 kg")).toBeNull();
		expect(asNumber("007")).toBeNull();
		expect(asNumber("")).toBeNull();
		expect(asNumber("1e9")).toBeNull();
	});

	it("writes numbers as numbers and words as words", () => {
		const xml = sheetXml([["Name", "Total"], ["Tea", "12"]]);
		expect(xml).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
		expect(xml).toContain('<c r="B2"><v>12</v></c>');
		expect(xml).toContain('<row r="2">');
	});

	it("leaves empty cells out rather than padding them", () => {
		expect(sheetXml([["a", "", "c"]])).not.toContain('r="B1"');
	});

	it("tidies sheet names the way Excel insists", () => {
		expect(sheetName("Q1/Q2 [draft]")).toBe("Q1 Q2 draft");
		expect(sheetName("")).toBe("Sheet1");
		expect(sheetName("x".repeat(50))).toHaveLength(31);
	});
});

describe("building a workbook", () => {
	it("writes the parts a spreadsheet needs", async () => {
		const zip = await buildXlsx([{ name: "Spend", rows: [["Item", "Cost"], ["Tea", "3.5"]] }]);
		const names = (await readZipEntries(zip)).map((entry) => entry.name).sort();
		expect(names).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
	});

	it("survives a round trip", async () => {
		const rows = [
			["Item", "Cost", "Note"],
			["Tea", "3.5", "a & b"],
			["Coffee", "12", ""],
		];
		const sheets = await readXlsx(await buildXlsx([{ name: "Spend", rows }]));
		expect(sheets).toHaveLength(1);
		expect(sheets[0].name).toBe("Spend");
		expect(sheets[0].rows).toEqual(rows);
	});

	it("keeps several sheets apart and in order", async () => {
		const sheets = await readXlsx(
			await buildXlsx([
				{ name: "First", rows: [["a"]] },
				{ name: "Second", rows: [["b"]] },
			]),
		);
		expect(sheets.map((sheet) => sheet.name)).toEqual(["First", "Second"]);
		expect(sheets[1].rows).toEqual([["b"]]);
	});

	it("renames a duplicate sheet rather than refusing it", async () => {
		const sheets = await readXlsx(
			await buildXlsx([
				{ name: "Same", rows: [["a"]] },
				{ name: "Same", rows: [["b"]] },
			]),
		);
		expect(sheets[0].name).toBe("Same");
		expect(sheets[1].name).toBe("Same 2");
	});

	it("refuses a file that is not a workbook", async () => {
		const notASheet = await buildXlsx([{ name: "Data", rows: [] }]);
		await expect(readXlsx(notASheet.subarray(0, 10))).rejects.toThrow();
	});
});

describe("csv", () => {
	it("quotes what needs quoting", () => {
		expect(rowsToCsv([["a,b", 'say "hi"'], ["plain", "1"]])).toBe('"a,b","say ""hi"""\nplain,1\n');
	});

	it("reads quoted cells, commas, and newlines", () => {
		expect(csvToRows('name,note\nTea,"strong, hot"\n')).toEqual([
			["name", "note"],
			["Tea", "strong, hot"],
		]);
	});

	it("drops blank lines", () => {
		expect(csvToRows("a,b\n\n\nc,d\n")).toEqual([
			["a", "b"],
			["c", "d"],
		]);
	});

	it("counts what it is holding", () => {
		expect(sheetSummary([["a", "1"], ["b", "2"]])).toEqual({ rows: 2, columns: 2, numbers: 2 });
	});
});
