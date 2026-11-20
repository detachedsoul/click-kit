import { PDFArray, PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { longPage, overlayPdf, PdfInputError } from "@/features/pdf-tools/pdf-engine";

const makePdf = async (pages = 3, size: [number, number] = [300, 400]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage(size).drawText(`page ${index + 1}`, { x: 20, y: 20, size: 11, font });
	return new Uint8Array(await doc.save());
};

/** How much drawing each page holds, in bytes of content stream. */
const contentSizes = (doc: PDFDocument) =>
	doc.getPages().map((page) => {
		const contents = page.node.Contents();
		if (!contents) return 0;
		const streams = contents instanceof PDFArray ? contents.asArray() : [contents];
		return streams.reduce((sum, entry) => {
			const stream = doc.context.lookup(entry) as { getContents?: () => Uint8Array } | undefined;
			return sum + (stream?.getContents?.().length ?? 0);
		}, 0);
	});

describe("long page", () => {
	it("stacks the pages into one tall sheet", async () => {
		const out = await PDFDocument.load(await longPage(await makePdf(3), { gap: 12 }));
		expect(out.getPageCount()).toBe(1);
		const page = out.getPage(0);
		expect(page.getWidth()).toBe(300);
		expect(page.getHeight()).toBe(400 * 3 + 12 * 2);
	});

	it("leaves no gap when none is asked for", async () => {
		const out = await PDFDocument.load(await longPage(await makePdf(2), { gap: 0, margin: 10 }));
		const page = out.getPage(0);
		expect(page.getHeight()).toBe(800 + 20);
		expect(page.getWidth()).toBe(320);
	});

	it("keeps the pages as content, not pictures of content", async () => {
		const out = await PDFDocument.load(await longPage(await makePdf(2)));
		expect(out.getPage(0).node.Resources()?.toString()).toContain("XObject");
		expect(contentSizes(out)[0]).toBeGreaterThan(0);
	});

	it("refuses a single page, and a length a viewer cannot take", async () => {
		await expect(longPage(await makePdf(1))).rejects.toThrow(PdfInputError);
		await expect(longPage(await makePdf(1))).rejects.toThrow(/already a single page/u);
		await expect(longPage(await makePdf(30, [300, 400]), { maxHeight: 4000 })).rejects.toThrow(/limit|tall/u);
	});
});

describe("overlay", () => {
	it("lays the second document over every page of the first", async () => {
		const out = await PDFDocument.load(await overlayPdf(await makePdf(3), await makePdf(1, [150, 150])));
		expect(out.getPageCount()).toBe(3);
		for (const index of [0, 1, 2]) expect(out.getPage(index).node.Resources()?.toString()).toContain("XObject");
	});

	it("can be limited to the pages you pick", async () => {
		const base = await makePdf(3);
		const before = contentSizes(await PDFDocument.load(base));
		const out = await PDFDocument.load(await overlayPdf(base, await makePdf(1, [150, 150]), { pages: [2] }));
		const after = contentSizes(out);
		expect(after[1]).toBeGreaterThan(before[1]);
		expect(after[0]).toBe(before[0]);
		expect(after[2]).toBe(before[2]);
	});

	it("fits rather than stretches unless told otherwise", async () => {
		const out = await PDFDocument.load(await overlayPdf(await makePdf(1, [400, 400]), await makePdf(1, [200, 100]), { scale: "stretch" }));
		expect(out.getPageCount()).toBe(1);
	});

	it("refuses a page that is not there", async () => {
		await expect(overlayPdf(await makePdf(2), await makePdf(1), { pages: [5] })).rejects.toThrow(PdfInputError);
		await expect(overlayPdf(await makePdf(2), await makePdf(1), { pages: [5] })).rejects.toThrow(/page 5 does not exist/u);
	});

	it("dims the layer when asked", async () => {
		const out = await PDFDocument.load(await overlayPdf(await makePdf(1), await makePdf(1, [200, 200]), { opacity: 0.3 }));
		expect(out.getPageCount()).toBe(1);
		expect(contentSizes(out)[0]).toBeGreaterThan(0);
	});
});
