import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { rasterPagesToPdf } from "@/features/converter-tools/word-pdf-visual";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

describe("rendered Word pages to PDF", () => {
	it("keeps each rendered page's proportions and size", async () => {
		async function* pages() {
			yield { height: 1056, png, width: 816 };
			yield { height: 816, png, width: 1056 };
		}
		const result = await rasterPagesToPdf(pages());
		const pdf = await PDFDocument.load(result.bytes);
		expect(result.pageCount).toBe(2);
		expect(pdf.getPageCount()).toBe(2);
		expect(pdf.getPage(0).getSize()).toMatchObject({ width: 612, height: 792 });
		expect(pdf.getPage(1).getSize()).toMatchObject({ width: 792, height: 612 });
	});

	it("rejects blank pages and documents with no pages", async () => {
		await expect(rasterPagesToPdf([])).rejects.toThrow(/no pages/u);
		await expect(rasterPagesToPdf([{ height: 10, png: new Uint8Array(), width: 10 }])).rejects.toThrow(/could not be captured/u);
		await expect(rasterPagesToPdf([{ height: 0, png, width: 10 }])).rejects.toThrow(/no usable dimensions/u);
	});
});
