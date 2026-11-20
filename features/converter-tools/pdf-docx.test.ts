import { describe, expect, it } from "vitest";
import { pageWordCount, pdfPageParagraphs, pdfPagesToDocx } from "@/features/converter-tools/pdf-docx";
import { readZipEntries } from "@/features/converter-tools/zip-reader";

const documentXml = async (bytes: Uint8Array) => {
	const entries = await readZipEntries(bytes);
	const part = entries.find((entry) => entry.name === "word/document.xml");
	if (!part) throw new Error("no document.xml");
	return new TextDecoder().decode(part.bytes);
};

const paragraphs = (xml: string) => (xml.match(/>([^<]*)<\/w:t>/gu) ?? []).map((match) => match.replace(/^>|<\/w:t>$/gu, ""));

describe("PDF pages to Word", () => {
	it("keeps a page's lines as paragraphs", () => {
		expect(pdfPageParagraphs("First line\n\nSecond line\n   \nThird")).toEqual(["First line", "Second line", "Third"]);
	});

	it("joins a soft wrap back together", () => {
		const wrapped = "The quick brown fox jumps over the lazy dog and keeps going for a while longer\nthan the page was wide.";
		expect(pdfPageParagraphs(wrapped)).toEqual(["The quick brown fox jumps over the lazy dog and keeps going for a while longer than the page was wide."]);
	});

	it("leaves a short line that starts a new sentence alone", () => {
		// A short line is not a wrap, and a line ending a sentence never is.
		expect(pdfPageParagraphs("Heading\nSecond line")).toEqual(["Heading", "Second line"]);
		expect(pdfPageParagraphs(`${"a".repeat(80)}.\nnext`)).toEqual([`${"a".repeat(80)}.`, "next"]);
	});

	it("writes the words, in order, into word/document.xml", async () => {
		const docx = pdfPagesToDocx([
			{ page: 1, text: "Terms of service\nThe parties agree." },
			{ page: 2, text: "Signed at Lagos" },
		]);
		const xml = await documentXml(docx);
		expect(paragraphs(xml)).toEqual(["Terms of service", "The parties agree.", "Signed at Lagos"]);
	});

	it("starts a new Word page wherever the PDF had one", async () => {
		const docx = pdfPagesToDocx([
			{ page: 1, text: "one" },
			{ page: 2, text: "two" },
			{ page: 3, text: "three" },
		]);
		const xml = await documentXml(docx);
		// Two breaks for three pages, never one at the end.
		expect((xml.match(/<w:br w:type="page"\/>/gu) ?? []).length).toBe(2);
	});

	it("escapes ampersands and angle brackets from the PDF", async () => {
	 const docx = pdfPagesToDocx([{ page: 1, text: "R&D <script> & more" }]);
		const xml = await documentXml(docx);
		expect(xml).toContain("R&amp;D &lt;script&gt; &amp; more");
	});

	it("keeps a page that turned out to be blank", async () => {
		const docx = pdfPagesToDocx([
			{ page: 1, text: "before" },
			{ page: 2, text: "" },
			{ page: 3, text: "after" },
		]);
		const xml = await documentXml(docx);
		expect((xml.match(/<w:br w:type="page"\/>/gu) ?? []).length).toBe(2);
		expect(paragraphs(xml)).toEqual(["before", "after"]);
	});

	it("counts the words across the pages", () => {
		expect(pageWordCount([{ page: 1, text: "one two three" }, { page: 2, text: " four " }])).toBe(4);
		expect(pageWordCount([])).toBe(0);
	});
});
