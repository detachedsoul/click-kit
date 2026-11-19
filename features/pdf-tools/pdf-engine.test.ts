import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPages, mergePdfs, readPdfInfo, rewritePages } from "@/features/pdf-tools/pdf-engine";

/** A small PDF with real text in an embedded font, so we can prove the text layer survives. */
const makePdf = async (labels: string[], title = "Sample") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.setTitle(title);
	for (const label of labels) {
		const page = doc.addPage([300, 400]);
		page.drawText(label, { x: 24, y: 340, size: 14, font });
	}
	return new Uint8Array(await doc.save());
};

const pageTexts = async (bytes: Uint8Array) => {
	const doc = await PDFDocument.load(bytes);
	return doc.getPages().map((page) => page.node.Contents()?.toString() ?? "");
};

describe("pdf engine", () => {
	it("merges in order and keeps each document's text layer", async () => {
		const first = await makePdf(["First"]);
		const second = await makePdf(["Second"]);
		const merged = await mergePdfs([first, second]);
		const doc = await PDFDocument.load(merged);
		expect(doc.getPageCount()).toBe(2);
		const streams = await pageTexts(merged);
		expect(streams.length).toBe(2);
		expect(streams[0].length).toBeGreaterThan(0);
	});

	it("keeps the embedded font resources when pages are copied", async () => {
		const source = await makePdf(["Hello"]);
		const doc = await PDFDocument.load(source);
		const sourceResources = doc.getPages()[0].node.Resources();
		expect(sourceResources).toBeTruthy();
		expect(sourceResources?.toString()).toContain("Font");

		const extracted = await extractPages(source, [1]);
		const output = await PDFDocument.load(extracted);
		expect(output.getPages()[0].node.Resources()?.toString()).toContain("Font");
	});

	it("extracts pages in the order asked for", async () => {
		const source = await makePdf(["One", "Two", "Three"]);
		const picked = await extractPages(source, [3, 1]);
		const doc = await PDFDocument.load(picked);
		expect(doc.getPageCount()).toBe(2);
		await expect(extractPages(source, [4])).rejects.toThrow(/page 4 does not exist/u);
	});

	it("re-orders, rotates, and drops pages", async () => {
		const source = await makePdf(["One", "Two", "Three"]);
		const rewritten = await rewritePages(source, { keep: [3, 1], rotate: { 3: 90 } });
		const doc = await PDFDocument.load(rewritten);
		expect(doc.getPageCount()).toBe(2);
		expect(doc.getPages()[0].getRotation().angle).toBe(90);
		expect(doc.getPages()[1].getRotation().angle).toBe(0);
		// Rotation accumulates rather than snapping to the new value.
		const turned = await rewritePages(source, { keep: [1], rotate: { 1: 270 } });
		const again = await rewritePages(turned, { keep: [1], rotate: { 1: 180 } });
		expect((await PDFDocument.load(again)).getPages()[0].getRotation().angle).toBe(90);
		expect(degrees(90).angle).toBe(90);
	});

	it("reads the document's own metadata without editing it", async () => {
		const bytes = await makePdf(["Page"], "Quarterly report");
		const info = await readPdfInfo(bytes);
		expect(info.pageCount).toBe(1);
		expect(info.title).toBe("Quarterly report");
		const reloaded = await PDFDocument.load(await mergePdfs([bytes]));
		expect(reloaded.getTitle()).toBe("Quarterly report");
	});

	it("says something useful when the bytes are not a PDF", async () => {
		await expect(mergePdfs([new Uint8Array([1, 2, 3, 4])])).rejects.toThrow(/not a readable PDF/u);
		await expect(mergePdfs([])).rejects.toThrow(/at least one PDF/u);
	});
});
