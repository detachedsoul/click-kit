import { concatTransformationMatrix, drawObject, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef, PDFStream, popGraphicsState, pushGraphicsState } from "pdf-lib";

/** The markup kinds that carry a painted appearance we can bake into the page. */
const MARKUP = new Set(["Caret", "Circle", "FileAttachment", "FreeText", "Highlight", "Ink", "Line", "Polygon", "PolyLine", "Square", "Squiggly", "Stamp", "StrikeOut", "Text", "Underline"]);

export type FlattenReport = {
	/** Form fields baked into the pages. */
	fields: number;
	/** Markup annotations baked into the pages. */
	baked: number;
	/** Markup that carried no appearance stream, so it stayed an annotation. */
	skipped: number;
};

const nameOf = (dict: PDFDict, key: string) => {
	const value = dict.get(PDFName.of(key));
	return value instanceof PDFName ? value.decodeText() : "";
};

const numbersOf = (doc: PDFDocument, array: PDFArray | undefined) => {
	if (!array) return null;
	const out: number[] = [];
	for (let index = 0; index < array.size(); index += 1) {
		const value = doc.context.lookup(array.get(index));
		if (!(value instanceof PDFNumber)) return null;
		out.push(value.asNumber());
	}
	return out;
};

/**
 * The reference to the normal appearance stream. `N` is either the stream itself or a
 * dictionary of streams keyed by the annotation's `/AS` state, so both shapes are walked.
 */
const appearanceRef = (doc: PDFDocument, entry: PDFRef | PDFDict): PDFRef | null => {
	if (entry instanceof PDFRef) {
		const target = doc.context.lookup(entry);
		if (target instanceof PDFStream) return entry;
		if (target instanceof PDFDict) return appearanceRef(doc, target);
		return null;
	}
	const state = nameOf(entry, "AS");
	if (state) {
		const chosen = entry.get(PDFName.of(state));
		if (chosen instanceof PDFRef) return chosen;
	}
	for (const [, value] of entry.entries()) if (value instanceof PDFRef) return value;
	return null;
};

/**
 * Bake every visible annotation into the page it sits on.
 *
 * Form fields go through pdf-lib's own flatten, which copies each widget's appearance
 * stream into the page content. Highlights, sticky notes, stamps, and the rest are baked
 * the same way — their appearance is an XObject, so the page is asked to draw it at the
 * annotation's rectangle. Nothing is rasterised: the mark stays vector, in its own fonts,
 * because it was already drawn as vector in the appearance stream.
 */
export const flattenPdf = async (bytes: Uint8Array): Promise<{ bytes: Uint8Array; report: FlattenReport }> => {
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	const report: FlattenReport = { baked: 0, fields: 0, skipped: 0 };
	const hasForm = Boolean(doc.catalog.get(PDFName.of("AcroForm")));

	for (const page of doc.getPages()) {
		const annots = page.node.Annots();
		if (!annots) continue;
		const refs: PDFRef[] = [];
		for (let index = 0; index < annots.size(); index += 1) {
			const ref = annots.get(index);
			if (ref instanceof PDFRef) refs.push(ref);
		}
		for (const ref of refs) {
			const annot = doc.context.lookup(ref);
			if (!(annot instanceof PDFDict)) continue;
			const subtype = nameOf(annot, "Subtype");
			if (!MARKUP.has(subtype)) continue;
			const rect = numbersOf(doc, annot.get(PDFName.of("Rect")) as PDFArray | undefined);
			const ap = annot.get(PDFName.of("AP"));
			if (!rect || rect.length < 4 || !(ap instanceof PDFDict)) {
				report.skipped += 1;
				continue;
			}
			const normal = ap.get(PDFName.of("N"));
			const streamRef = normal instanceof PDFRef || normal instanceof PDFDict ? appearanceRef(doc, normal) : null;
			const stream = streamRef ? doc.context.lookup(streamRef) : null;
			const box = stream instanceof PDFStream ? numbersOf(doc, stream.dict.get(PDFName.of("BBox")) as PDFArray | undefined) : null;
			if (!streamRef || !box || box.length < 4) {
				report.skipped += 1;
				continue;
			}
			const width = Math.abs(rect[2] - rect[0]);
			const height = Math.abs(rect[3] - rect[1]);
			const boxWidth = Math.abs(box[2] - box[0]);
			const boxHeight = Math.abs(box[3] - box[1]);
			if (!width || !height || !boxWidth || !boxHeight) {
				report.skipped += 1;
				continue;
			}
			const across = width / boxWidth;
			const down = height / boxHeight;
			const left = Math.min(rect[0], rect[2]) - Math.min(box[0], box[2]) * across;
			const bottom = Math.min(rect[1], rect[3]) - Math.min(box[1], box[3]) * down;
			const key = page.node.newXObject("FlatAnnot", streamRef);
			page.pushOperators(pushGraphicsState(), concatTransformationMatrix(across, 0, 0, down, left, bottom), drawObject(key), popGraphicsState());
			page.node.removeAnnot(ref);
			report.baked += 1;
		}
	}

	if (hasForm) {
		try {
			const form = doc.getForm();
			const fields = form.getFields();
			if (fields.length) {
				form.flatten();
				report.fields = fields.length;
			}
		} catch {
			// A malformed AcroForm is left alone rather than half-flattened.
		}
	}

	// pdf-lib deletes a field's objects but can leave its reference behind in /Annots, so
	// every page is swept once at the end: a page either keeps the annotation dicts that
	// are still there or loses the key entirely.
	for (const page of doc.getPages()) {
		const annots = page.node.Annots();
		if (!annots) continue;
		const keep: unknown[] = [];
		for (let index = 0; index < annots.size(); index += 1) {
			const element = annots.get(index);
			if (doc.context.lookup(element as never) instanceof PDFDict) keep.push(element);
		}
		if (keep.length === annots.size()) continue;
		if (!keep.length) page.node.delete(PDFName.of("Annots"));
		else page.node.set(PDFName.of("Annots"), doc.context.obj(keep as never));
	}

	return { bytes: await doc.save({ useObjectStreams: true }), report };
};

/** How much there is to flatten, for the panel before you run it. */
export const countAnnotations = async (bytes: Uint8Array): Promise<{ fields: number; markup: number }> => {
	const doc = await PDFDocument.load(bytes, { updateMetadata: false });
	let markup = 0;
	let fields = 0;
	for (const page of doc.getPages()) {
		const annots = page.node.Annots();
		if (!annots) continue;
		for (let index = 0; index < annots.size(); index += 1) {
			const annot = doc.context.lookup(annots.get(index));
			if (annot instanceof PDFDict && MARKUP.has(nameOf(annot, "Subtype"))) markup += 1;
		}
	}
	if (doc.catalog.get(PDFName.of("AcroForm"))) {
		try {
			fields = doc.getForm().getFields().length;
		} catch {
			fields = 0;
		}
	}
	return { fields, markup };
};
