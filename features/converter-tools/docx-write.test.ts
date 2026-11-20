import { describe, expect, it } from "vitest";
import { docxDocumentXml, writeDocx } from "@/features/converter-tools/docx-write";
import { readZipEntries } from "@/features/converter-tools/zip-reader";

const part = async (bytes: Uint8Array, name: string) => {
	const entries = await readZipEntries(bytes);
	const found = entries.find((entry) => entry.name === name);
	return found ? new TextDecoder().decode(found.bytes) : null;
};

describe("writing a Word document", () => {
	it("carries the three parts Word needs to open it", async () => {
		const docx = writeDocx([{ kind: "paragraph", text: "Hello" }]);
		expect((await readZipEntries(docx)).map((entry) => entry.name).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
		expect(await part(docx, "[Content_Types].xml")).toContain("wordprocessingml.document.main+xml");
		expect(await part(docx, "_rels/.rels")).toContain("word/document.xml");
	});

	it("puts paragraphs, headings, and page breaks where they were asked for", async () => {
		const docx = writeDocx([
			{ kind: "heading", level: 1, text: "Report" },
			{ kind: "paragraph", text: "First line" },
			{ kind: "pageBreak" },
			{ kind: "paragraph", text: "Second page" },
		]);
		const xml = await part(docx, "word/document.xml");
		expect(xml).toContain('xml:space="preserve">Report</w:t>');
		expect(xml).toContain('xml:space="preserve">First line</w:t>');
		expect(xml).toContain('<w:br w:type="page"/>');
		expect(xml).toContain('xml:space="preserve">Second page</w:t>');
		// The heading is bigger and bold; the body text is neither.
		expect(xml).toContain("<w:b/><w:sz w:val=\"36\"/>");
		expect(xml).toContain('<w:sz w:val="22"/>');
	});

	it("escapes the characters that would break the XML", () => {
		const xml = docxDocumentXml([{ kind: "paragraph", text: "Smith & Sons <tag>" }]);
		expect(xml).toContain("Smith &amp; Sons &lt;tag&gt;");
		expect(xml).not.toContain("<tag>");
	});

	it("keeps a blank paragraph blank instead of dropping it", async () => {
		const docx = writeDocx([{ kind: "paragraph", text: "before" }, { kind: "paragraph", text: "  " }, { kind: "paragraph", text: "after" }]);
		const xml = (await part(docx, "word/document.xml")) ?? "";
		expect((xml.match(/<w:p>/gu) ?? []).length).toBe(3);
		expect(xml).toContain("<w:p><w:pPr><w:spacing w:after=\"140\"/></w:pPr></w:p>");
	});
});
