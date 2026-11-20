import type { PDFArray, PDFDocument, PDFPage } from "pdf-lib";

export type HalfDirection = "horizontal" | "vertical";
export type HalfOrder = "interleaved" | "grouped";

export type HalvesResult = {
	bytes: Uint8Array;
	/** Pages in the new document: two for every page in the old one. */
	pages: number;
	/** The size of each half, in points. */
	width: number;
	height: number;
	/** Annotations that fell on the half that was dropped. */
	trimmed: number;
};

type Box = { x: number; y: number; width: number; height: number };

/**
 * Cut every page into two, one file out.
 *
 * The pages are copied, not redrawn: each copy keeps the whole original content stream and
 * only its crop box is narrowed, so the half you keep is the original page, seen through a
 * smaller window. Fonts, vector art, and even the hidden half stay exactly where they were,
 * which is why nothing has to be re-encoded or rasterised.
 */
export const splitHalves = async (bytes: Uint8Array, options: { direction: HalfDirection; order: HalfOrder }): Promise<HalvesResult> => {
	const { PDFDict: Dict, PDFDocument: Doc, PDFName, PDFNumber } = await import("pdf-lib");
	const source = await Doc.load(bytes, { updateMetadata: false });
	const out = await Doc.create();
	const count = source.getPageCount();
	if (!count) throw new Error("This PDF has no pages to split.");

	const order: HalfOrder = options.order;
	const entries: { page: PDFPage; half: number; index: number }[] = [];
	let width = 0;
	let height = 0;
	let trimmed = 0;

	const numbersOf = (doc: PDFDocument, array: PDFArray | undefined) => {
		if (!array) return null;
		const values: number[] = [];
		for (let index = 0; index < array.size(); index += 1) {
			const value = doc.context.lookup(array.get(index));
			if (!(value instanceof PDFNumber)) return null;
			values.push(value.asNumber());
		}
		return values;
	};

	/** Keeps the annotations that land on the half being kept, and drops the rest. */
	const clipAnnots = (doc: PDFDocument, page: PDFPage, box: Box) => {
		const annots = page.node.Annots();
		if (!annots) return 0;
		const keep: unknown[] = [];
		let dropped = 0;
		for (let index = 0; index < annots.size(); index += 1) {
			const element = annots.get(index);
			const annot = doc.context.lookup(element as never);
			const rect = annot instanceof Dict ? numbersOf(doc, annot.get(PDFName.of("Rect")) as PDFArray | undefined) : null;
			if (!rect || rect.length < 4) {
				keep.push(element);
				continue;
			}
			const left = Math.min(rect[0], rect[2]);
			const right = Math.max(rect[0], rect[2]);
			const bottom = Math.min(rect[1], rect[3]);
			const top = Math.max(rect[1], rect[3]);
			const overlap = Math.min(right, box.x + box.width) - Math.max(left, box.x) > 0 && Math.min(top, box.y + box.height) - Math.max(bottom, box.y) > 0;
			if (overlap) keep.push(element);
			else dropped += 1;
		}
		if (!keep.length) page.node.delete(PDFName.of("Annots"));
		else if (keep.length !== annots.size()) page.node.set(PDFName.of("Annots"), doc.context.obj(keep as never));
		return dropped;
	};

	for (let index = 0; index < count; index += 1) {
		const original = source.getPage(index);
		const box = original.getCropBox();
		// A page that is stored sideways is cut along the axis the reader actually sees.
		const rotated = Math.abs(original.getRotation().angle) % 180 === 90;
		const direction: HalfDirection = rotated ? (options.direction === "horizontal" ? "vertical" : "horizontal") : options.direction;
		const halves =
			direction === "horizontal"
				? [
						{ x: box.x, y: box.y + box.height / 2, width: box.width, height: box.height / 2 },
						{ x: box.x, y: box.y, width: box.width, height: box.height / 2 },
					]
				: [
						{ x: box.x, y: box.y, width: box.width / 2, height: box.height },
						{ x: box.x + box.width / 2, y: box.y, width: box.width / 2, height: box.height },
					];
		const copies = await out.copyPages(source, [index, index]);
		for (const [half, copy] of copies.entries()) {
			const target = halves[half];
			copy.setMediaBox(target.x, target.y, target.width, target.height);
			copy.setCropBox(target.x, target.y, target.width, target.height);
			for (const key of ["TrimBox", "BleedBox", "ArtBox"]) copy.node.delete(PDFName.of(key));
			trimmed += clipAnnots(out, copy, target);
			entries.push({ half, index, page: copy });
			if (!width) {
				width = target.width;
				height = target.height;
			}
		}
	}

	const ordered = order === "grouped" ? [...entries.filter((entry) => entry.half === 0), ...entries.filter((entry) => entry.half === 1)] : entries;
	for (const entry of ordered) out.addPage(entry.page);

	return { bytes: await out.save({ useObjectStreams: true }), height, pages: out.getPageCount(), trimmed, width };
};

/** The visible size of the first page, so the panel can say how big a half will be. */
export const firstPageSize = async (bytes: Uint8Array): Promise<{ width: number; height: number }> => {
	const { PDFDocument } = await import("pdf-lib");
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	const box = doc.getPage(0).getCropBox();
	return { height: Math.round(box.height), width: Math.round(box.width) };
};
