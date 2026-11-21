import { PDFDocument } from "pdf-lib";

export type RasterPage = { height: number; png: Uint8Array; width: number };
export type RasterPageSource = AsyncIterable<RasterPage> | Iterable<RasterPage>;
export type RasterPdf = { bytes: Uint8Array; pageCount: number };

/**
 * Writes browser-rendered Word pages into a PDF without reflowing their content.
 * A CSS pixel is 0.75 PDF points at the standard 96 CSS pixels per inch.
 */
export const rasterPagesToPdf = async (pages: RasterPageSource): Promise<RasterPdf> => {
	const pdf = await PDFDocument.create();
	let pageCount = 0;
	for await (const rendered of pages) {
		if (!Number.isFinite(rendered.width) || !Number.isFinite(rendered.height) || rendered.width <= 0 || rendered.height <= 0) {
			throw new Error("A rendered Word page has no usable dimensions.");
		}
		if (!rendered.png.byteLength) throw new Error("A rendered Word page could not be captured as an image.");
		const width = rendered.width * 0.75;
		const height = rendered.height * 0.75;
		const image = await pdf.embedPng(rendered.png);
		const page = pdf.addPage([width, height]);
		page.drawImage(image, { x: 0, y: 0, width, height });
		pageCount += 1;
	}
	if (!pageCount) throw new Error("This Word document has no pages to convert.");
	return { bytes: new Uint8Array(await pdf.save()), pageCount };
};
