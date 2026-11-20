import { describe, expect, it } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { docxToMarkdown, docxToText } from "@/features/converter-tools/docx";

const encoder = new TextEncoder();

const W = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

const makeDocx = async (body: string) =>
	createZip([
		{ name: "[Content_Types].xml", data: encoder.encode("<Types/>") },
		{ name: "word/document.xml", data: encoder.encode(W(body)) },
	]);

const para = (runs: string, style = "") =>
	`<w:p>${style ? `<w:pPr>${style}</w:pPr>` : ""}${runs}</w:p>`;
const run = (text: string, properties = "") => `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t>${text}</w:t></w:r>`;

describe("word to markdown", () => {
	it("writes headings, paragraphs, bold, and italic", async () => {
		const docx = await makeDocx(
			para(run("Quarterly report"), '<w:pStyle w:val="Heading1"/>') + para(run("Sales were ") + run("strong", "<w:b/>") + run(" and ") + run("quiet", "<w:i/>")),
		);
		expect(await docxToMarkdown(docx)).toBe("# Quarterly report\n\nSales were **strong** and *quiet*");
	});

	it("recognises heading levels and titles", async () => {
		const docx = await makeDocx(
			para(run("Title"), '<w:pStyle w:val="Title"/>') +
				para(run("Second"), '<w:pStyle w:val="Heading2"/>') +
				para(run("Deep"), '<w:pStyle w:val="Heading9"/>'),
		);
		expect(await docxToMarkdown(docx)).toBe("# Title\n\n## Second\n\n###### Deep");
	});

	it("turns list paragraphs into bullets", async () => {
		const docx = await makeDocx(para(run("One"), "<w:numPr/>") + para(run("Two"), "<w:numPr/>"));
		expect(await docxToMarkdown(docx)).toBe("- One\n\n- Two");
	});

	it("writes tables as markdown tables", async () => {
		const cell = (text: string) => `<w:tc>${para(run(text))}</w:tc>`;
		const row = (left: string, right: string) => `<w:tr>${cell(left)}${cell(right)}</w:tr>`;
		const docx = await makeDocx(`<w:tbl>${row("Month", "Total")}${row("May", "1,200")}</w:tbl>`);
		expect(await docxToMarkdown(docx)).toBe("| Month | Total |\n| --- | --- |\n| May | 1,200 |");
	});

	it("keeps hyperlink text and skips deleted text", async () => {
		const docx = await makeDocx(para(`<w:hyperlink>${run("our site")}</w:hyperlink>`) + para("<w:del><w:r><w:t>cut</w:t></w:r></w:del>") + para(run("kept")));
		expect(await docxToMarkdown(docx)).toBe("our site\n\nkept");
	});

	it("drops the markup for plain text", async () => {
		const docx = await makeDocx(para(run("Head"), '<w:pStyle w:val="Heading1"/>') + para(run("bold", "<w:b/>")) + para(run("item"), "<w:numPr/>"));
		expect(await docxToText(docx)).toBe("Head\n\nbold\n\nitem");
	});

	it("explains a file that is not a word document", async () => {
		const zip = await createZip([{ name: "readme.txt", data: encoder.encode("hi") }]);
		await expect(docxToMarkdown(zip)).rejects.toThrow(/not a Word document/u);
		await expect(docxToMarkdown(encoder.encode("not even a zip"))).rejects.toThrow(/not a zip/u);
	});
});
