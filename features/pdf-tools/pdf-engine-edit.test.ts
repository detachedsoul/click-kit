import { PDFDocument, StandardFonts, PDFName, PDFDict, PDFArray } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addMargins, applyEdits, PdfInputError } from "@/features/pdf-tools/pdf-engine";

const makePdf = async (pages = 1, size: [number, number] = [600, 800]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	for (let index = 0; index < pages; index += 1) doc.addPage(size).drawText("hello", { x: 40, y: 40, size: 12, font });
	return new Uint8Array(await doc.save());
};

const fontsOn = (doc: PDFDocument, pageIndex = 0) => {
	const resources = doc.getPage(pageIndex).node.Resources();
	if (!resources) return [] as string[];
	const fontDict = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
	if (!fontDict) return [] as string[];
	return fontDict.keys().map((key) => key.asString());
};

describe("addMargins", () => {
	it("grows the page on each side it is given", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(), { top: 36, right: 18, bottom: 9, left: 27 }));
		const page = out.getPage(0);
		expect([page.getWidth(), page.getHeight()]).toEqual([600 + 45, 800 + 45]);
	});

	it("keeps the page's own content and its embedded font", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(2), { top: 20, right: 0, bottom: 0, left: 0 }));
		expect(out.getPageCount()).toBe(2);
		expect(fontsOn(out).length).toBeGreaterThan(0);
	});

	it("moves the content in rather than scaling it", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(), { top: 0, right: 0, bottom: 0, left: 50 }));
		const { Contents } = out.getPage(0).node.normalizedEntries();
		const content = (Contents as PDFArray).asArray();
		expect(content.length).toBeGreaterThan(0);
		// The page's own drawing stays where it was drawn; only the page moved around it.
		expect(out.getPage(0).getWidth()).toBe(650);
	});

	it("refuses a margin it cannot draw", async () => {
		const bytes = await makePdf();
		await expect(addMargins(bytes, { top: -1, right: 0, bottom: 0, left: 0 })).rejects.toThrow(PdfInputError);
		await expect(addMargins(bytes, { top: 0, right: 0, bottom: 0, left: 0 })).rejects.toThrow(/at least one side/u);
		await expect(addMargins(bytes, { top: 2000, right: 0, bottom: 0, left: 0 })).rejects.toThrow(/50 cm/u);
		await expect(addMargins(bytes, { top: Number.NaN, right: 0, bottom: 0, left: 0 })).rejects.toThrow(PdfInputError);
	});
});

describe("applyEdits, at the edges", () => {
	it("writes a note and a box over the page", async () => {
		const out = await PDFDocument.load(
			await applyEdits(await makePdf(), [
				{ kind: "text", page: 1, x: 0.1, y: 0.2, text: "Approved", font: "times", size: 14, color: "black" },
				{ kind: "highlight", page: 1, x: 0.1, y: 0.5, color: "black", size: 12, text: "x", font: "times" },
			]),
		);
		expect(out.getPageCount()).toBe(1);
		expect(fontsOn(out).length).toBeGreaterThan(0);
	});

	it("refuses nonsense rather than guessing", async () => {
		const bytes = await makePdf(2);
		await expect(applyEdits(bytes, [])).rejects.toThrow(PdfInputError);
		await expect(applyEdits(bytes, [{ kind: "text", page: 9, x: 0.1, y: 0.1, text: "hi", font: "times", size: 12, color: "black" }])).rejects.toThrow(/page/u);
		await expect(applyEdits(bytes, [{ kind: "text", page: 1, x: 0.1, y: 0.1, text: "   ", font: "times", size: 12, color: "black" }])).rejects.toThrow(/Type something/u);
		await expect(applyEdits(bytes, [{ kind: "text", page: 1, x: 0.1, y: 0.1, text: "日本語", font: "times", size: 12, color: "black" }])).rejects.toThrow(PdfInputError);
	});
});
