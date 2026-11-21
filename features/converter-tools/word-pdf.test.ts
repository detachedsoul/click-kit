import zlib from "node:zlib";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { writeZip } from "@/features/converter-tools/zip-write";
import { docxToPdfTextOnly, printable } from "@/features/converter-tools/word-pdf";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const para = (text: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const styledPara = (text: string, options: { bold?: boolean; italic?: boolean }) =>
	`<w:p><w:r><w:rPr>${options.bold ? "<w:b/>" : ""}${options.italic ? "<w:i/>" : ""}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
const listPara = (text: string, numId: string, level = 0) =>
	`<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

const NUMBERING = `<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;

const docxOf = (body: string, numbering?: string) =>
	writeZip([
		{ data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`, name: "word/document.xml" },
		...(numbering ? [{ data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${W}">${numbering}</w:numbering>`, name: "word/numbering.xml" }] : []),
	]);

/** The decoded content stream of a page, where the drawn operators live. */
const contentOf = (doc: PDFDocument, page = 0) => {
	const node = doc.getPage(page).node;
	const contents = node.Contents() as unknown as { asArray?: () => unknown[] };
	const items = contents?.asArray ? contents.asArray() : [contents];
	let text = "";
	for (const item of items) {
		const stream = doc.context.lookup(item as never);
		if (!(stream instanceof PDFRawStream)) continue;
		const data = stream.getContents();
		try {
			text += new TextDecoder().decode(zlib.inflateSync(Buffer.from(data)));
		} catch {
			text += new TextDecoder().decode(data);
		}
	}
	return text;
};

/** The handful of WinAnsi slots above 0x7f that carry punctuation rather than letters. */
const WIN_ANSI: Record<number, string> = {
	0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰",
	0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
	0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

/** Every string the page actually draws, in order: pdf-lib writes them as hex. */
const drawnText = (content: string) =>
	Array.from(content.matchAll(/<([0-9a-fA-F]+)>\s*Tj/gu))
		.map((match) =>
			Array.from(Buffer.from(match[1], "hex"))
				.map((byte) => WIN_ANSI[byte] ?? String.fromCharCode(byte))
				.join(""),
		)
		.join("");

const convert = async (body: string, numbering?: string, options?: { pageSize?: "a4" | "letter" }) => {
	const result = await docxToPdfTextOnly(docxOf(body, numbering), options);
	return { ...result, doc: await PDFDocument.load(result.bytes) };
};

describe("Word to PDF", () => {
	it("puts the words on the page as selectable text", async () => {
		const { doc } = await convert(para("Quarterly report") + para("The numbers are in."));
		const drawn = drawnText(contentOf(doc));
		expect(drawn).toContain("Quarterly report");
		expect(drawn).toContain("The numbers are in.");
		expect(doc.getPageCount()).toBe(1);
	});

	it("sets a heading bigger than the body text", async () => {
		const { doc } = await convert(para("Heading", "Heading1") + para("Body"));
		const content = contentOf(doc);
		// The heading is bold and 20 pt; the body is 10.5 pt in the regular cut.
		expect(content).toMatch(/\/Helvetica-Bold[^ ]* 20 Tf/u);
		expect(content).toMatch(/\/Helvetica[^ ]* 10\.5 Tf/u);
	});

	it("keeps bold and italic runs in their own cut", async () => {
		const { doc } = await convert(styledPara("quietly", { bold: true }) + styledPara("sideways", { italic: true }));
		const fonts = doc.getPage(0).node.Resources()?.toString() ?? "";
		expect(fonts).toContain("Helvetica-Bold");
		expect(fonts).toContain("Helvetica-Oblique");
	});

	it("numbers an ordered list and dots a bulleted one", async () => {
		const { doc } = await convert(listPara("first", "1") + listPara("second", "1") + listPara("a point", "2"), NUMBERING);
		const drawn = drawnText(contentOf(doc));
		expect(drawn).toContain("1.");
		expect(drawn).toContain("2.");
		expect(drawn).toContain("•");
		expect(drawn).toContain("a point");
	});

	it("wraps a long paragraph instead of running off the page", async () => {
		const words = Array.from({ length: 120 }, (_value, index) => `word${index}`).join(" ");
		const { doc } = await convert(para(words));
		const content = contentOf(doc);
		const spots = Array.from(content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/gu)).map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
		// Many lines, all of them inside the margins of an A4 page.
		expect(spots.length).toBeGreaterThan(5);
		for (const spot of spots) {
			expect(spot.x).toBeGreaterThanOrEqual(56);
			expect(spot.x).toBeLessThan(595.28 - 56);
			expect(spot.y).toBeGreaterThan(56);
			expect(spot.y).toBeLessThan(841.89 - 56);
		}
	});

	it("starts a new page when the first one fills up", async () => {
		const body = Array.from({ length: 90 }, (_value, index) => para(`Paragraph number ${index} with enough words to take a couple of lines on the page.`)).join("");
		const { doc, pageCount } = await convert(body);
		expect(pageCount).toBeGreaterThan(1);
		expect(doc.getPageCount()).toBe(pageCount);
	});

	it("draws a table row by row", async () => {
		const table = `<w:tbl><w:tr><w:tc>${para("Name")}</w:tc><w:tc>${para("Total")}</w:tc></w:tr><w:tr><w:tc>${para("Ada")}</w:tc><w:tc>${para("42")}</w:tc></w:tr></w:tbl>`;
		const { doc } = await convert(table);
		const drawn = drawnText(contentOf(doc));
		expect(drawn).toContain("Name");
		expect(drawn).toContain("Ada");
		expect(drawn).toContain("42");
	});

	it("takes a Letter page when asked", async () => {
		const { doc } = await convert(para("Pocket"), undefined, { pageSize: "letter" });
		const { width, height } = doc.getPage(0).getSize();
		expect(Math.round(width)).toBe(612);
		expect(Math.round(height)).toBe(792);
	});

	it("folds letters the standard fonts cannot draw", async () => {
		// An arrow and a Chinese name: neither is in WinAnsi.
		const { doc } = await convert(para("next \u2192 张伟"));
		const drawn = drawnText(contentOf(doc));
		expect(drawn).toContain("next -> ?");
		expect(printable("\u2192")).toBe("->");
		expect(printable("caf\u00e9")).toBe("caf\u00e9");
		// A no-break space is in WinAnsi, so it survives as itself.
		expect(printable("a\u00a0b")).toBe("a\u00a0b");
	});

	it("counts the words and pages it wrote", async () => {
		const { pageCount, wordCount } = await convert(para("one two three") + para("four"));
		expect(pageCount).toBe(1);
		expect(wordCount).toBe(4);
	});

	it("refuses a document with nothing in it", async () => {
		await expect(docxToPdfTextOnly(docxOf(""))).rejects.toThrow(/no text/u);
	});

	it("refuses a file that is not a Word document", async () => {
		await expect(docxToPdfTextOnly(writeZip([{ data: "nope", name: "readme.txt" }]))).rejects.toThrow(/not a Word document/u);
	});
});
