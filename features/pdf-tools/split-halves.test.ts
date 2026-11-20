import zlib from "node:zlib";
import { degrees, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { splitHalves } from "@/features/pdf-tools/split-halves";

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

const makePdf = async (pages = 2) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	for (let index = 0; index < pages; index += 1) {
		const page = doc.addPage([400, 600]);
		page.drawText(`page ${index + 1} top`, { x: 20, y: 560, size: 12, font });
		page.drawText(`page ${index + 1} bottom`, { x: 20, y: 40, size: 12, font });
	}
	return { bytes: new Uint8Array(await doc.save()), doc };
};

const boxOf = (doc: PDFDocument, page = 0) => {
	const box = doc.getPage(page).getCropBox();
	return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
};

const annotsOf = (doc: PDFDocument, page = 0) => {
	const array = doc.getPage(page).node.Annots();
	if (!array) return [];
	const out: string[] = [];
	for (let index = 0; index < array.size(); index += 1) {
		const annot = doc.context.lookup(array.get(index));
		out.push(annot instanceof PDFDict ? String((annot.get(PDFName.of("Subtype")) as PDFName | undefined)?.decodeText?.()) : "?");
	}
	return out;
};

describe("splitHalves", () => {
	it("cuts each page down the middle into two pages", async () => {
		const { bytes } = await makePdf(2);
		const result = await splitHalves(bytes, { direction: "horizontal", order: "interleaved" });
		expect(result.pages).toBe(4);
		expect([result.width, result.height]).toEqual([400, 300]);

		const doc = await PDFDocument.load(result.bytes);
		expect(doc.getPageCount()).toBe(4);
		expect(boxOf(doc, 0)).toEqual([0, 300, 400, 300]);
		expect(boxOf(doc, 1)).toEqual([0, 0, 400, 300]);
		expect(boxOf(doc, 2)).toEqual([0, 300, 400, 300]);
		expect(boxOf(doc, 3)).toEqual([0, 0, 400, 300]);
		for (const page of doc.getPages()) expect([page.getWidth(), page.getHeight()]).toEqual([400, 300]);
	});

	it("keeps the whole original content, so the half is not redrawn", async () => {
		const { bytes } = await makePdf(1);
		const before = contentOf(await PDFDocument.load(bytes));
		const result = await splitHalves(bytes, { direction: "horizontal", order: "interleaved" });
		const doc = await PDFDocument.load(result.bytes);
		expect(contentOf(doc, 0)).toBe(before);
		expect(contentOf(doc, 1)).toBe(before);
		// The page's own font resource travelled with it.
		expect(doc.getPage(0).node.Resources()?.toString() ?? "").toContain("Times");
	});

	it("groups the top halves before the bottom ones when asked", async () => {
		const { bytes } = await makePdf(2);
		const result = await splitHalves(bytes, { direction: "horizontal", order: "grouped" });
		const doc = await PDFDocument.load(result.bytes);
		expect(boxOf(doc, 0)).toEqual([0, 300, 400, 300]);
		expect(boxOf(doc, 1)).toEqual([0, 300, 400, 300]);
		expect(boxOf(doc, 2)).toEqual([0, 0, 400, 300]);
		expect(boxOf(doc, 3)).toEqual([0, 0, 400, 300]);
	});

	it("cuts left and right when the page is split vertically", async () => {
		const { bytes } = await makePdf(1);
		const result = await splitHalves(bytes, { direction: "vertical", order: "interleaved" });
		expect([result.width, result.height]).toEqual([200, 600]);
		const doc = await PDFDocument.load(result.bytes);
		expect(boxOf(doc, 0)).toEqual([0, 0, 200, 600]);
		expect(boxOf(doc, 1)).toEqual([200, 0, 200, 600]);
	});

	it("leaves a mark on the half that keeps it, and no trace on the other", async () => {
		const { bytes, doc } = await makePdf(1);
		const page = doc.getPage(0);
		page.node.addAnnot(doc.context.register(doc.context.obj({ F: 4, Rect: [40, 520, 140, 540], Subtype: "Highlight", Type: "Annot" })));
		const result = await splitHalves(new Uint8Array(await doc.save()), { direction: "horizontal", order: "interleaved" });
		expect(result.trimmed).toBe(1);
		const out = await PDFDocument.load(result.bytes);
		expect(annotsOf(out, 0)).toEqual(["Highlight"]);
		expect(annotsOf(out, 1)).toEqual([]);
		expect(bytes.length).toBeGreaterThan(0);
	});

	it("cuts a page along the axis the reader sees when it is stored sideways", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		page.setRotation(degrees(90));
		const result = await splitHalves(new Uint8Array(await doc.save()), { direction: "horizontal", order: "interleaved" });
		// A sideways page printed in landscape: the cut the reader sees as top/bottom is left/right here.
		expect([result.width, result.height]).toEqual([200, 600]);
		const out = await PDFDocument.load(result.bytes);
		expect(boxOf(out, 0)).toEqual([0, 0, 200, 600]);
		expect(boxOf(out, 1)).toEqual([200, 0, 200, 600]);
	});

	it("goes by what is visible on a page that is already cropped", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		page.setCropBox(50, 50, 300, 500);
		const result = await splitHalves(new Uint8Array(await doc.save()), { direction: "horizontal", order: "interleaved" });
		expect([result.width, result.height]).toEqual([300, 250]);
		const out = await PDFDocument.load(result.bytes);
		expect(boxOf(out, 0)).toEqual([50, 300, 300, 250]);
		expect(boxOf(out, 1)).toEqual([50, 50, 300, 250]);
	});

	it("clears a trim box that would sit outside the new page", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		page.node.set(PDFName.of("TrimBox"), doc.context.obj([10, 10, 390, 590]));
		const result = await splitHalves(new Uint8Array(await doc.save()), { direction: "horizontal", order: "interleaved" });
		const out = await PDFDocument.load(result.bytes);
		expect(out.getPage(0).node.get(PDFName.of("TrimBox"))).toBeUndefined();
	});
});
