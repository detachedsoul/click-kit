import { pdfErrorMessage } from "@/features/pdf-tools/pdf-utils";

/**
 * A thin, lazy layer over pdf-lib. Everything here copies pages rather than redrawing them,
 * so a document's own fonts, images, vector art, and metadata survive the round trip: the
 * library only moves the existing page content streams into a new file.
 */

/** pdf-lib is only downloaded on the pages that need it, not with every tool page. */
const loadPdfLib = () => import("pdf-lib");

export type PdfInfo = { pageCount: number; title: string | null; author: string | null; producer: string | null; creator: string | null; subject: string | null; keywords: string[] };

export const readFileBytes = async (file: File) => new Uint8Array(await file.arrayBuffer());

/** Our own, readable complaints. They pass back to the UI as written, not re-worded. */
export class PdfInputError extends Error {}

const openDocument = async (bytes: Uint8Array) => {
	const { PDFDocument } = await loadPdfLib();
	// updateMetadata: false keeps the original producer, dates, and XMP untouched.
	return PDFDocument.load(bytes, { updateMetadata: false });
};

const asFriendlyError = (error: unknown) => (error instanceof PdfInputError ? error : new Error(pdfErrorMessage(error)));

/** Runs an operation and translates only the library's failures, never our own checks. */
const guard = async <T>(run: () => Promise<T>): Promise<T> => {
	try {
		return await run();
	} catch (error) {
		throw asFriendlyError(error);
	}
};

const infoOf = (doc: Awaited<ReturnType<typeof openDocument>>): PdfInfo => {
	const keywords = doc.getKeywords();
	return {
		pageCount: doc.getPageCount(),
		title: doc.getTitle() ?? null,
		author: doc.getAuthor() ?? null,
		producer: doc.getProducer() ?? null,
		creator: doc.getCreator() ?? null,
		subject: doc.getSubject() ?? null,
		keywords: keywords ? keywords.split(",").map((word) => word.trim()).filter(Boolean) : [],
	};
};

export const readPdfInfo = (bytes: Uint8Array) => guard(async () => infoOf(await openDocument(bytes)));

export const pageCountOf = (bytes: Uint8Array) => guard(async () => (await openDocument(bytes)).getPageCount());

/** Merge in the order given; each source keeps its own fonts and artwork. */
export const mergePdfs = async (sources: Uint8Array[]): Promise<Uint8Array> =>
	guard(async () => {
		if (!sources.length) throw new PdfInputError("Add at least one PDF.");
		const { PDFDocument } = await loadPdfLib();
		const merged = await PDFDocument.create();
		for (const [index, bytes] of sources.entries()) {
			const doc = await openDocument(bytes);
			if (index === 0) copyMetadata(doc, merged);
			const pages = await merged.copyPages(doc, doc.getPageIndices());
			for (const page of pages) merged.addPage(page);
		}
		return merged.save({ useObjectStreams: true });
	});

/** The merged file is a new document, so it inherits the first file's description rather than a blank one. */
const copyMetadata = (from: Awaited<ReturnType<typeof openDocument>>, to: Awaited<ReturnType<typeof openDocument>>) => {
	const title = from.getTitle();
	const author = from.getAuthor();
	const subject = from.getSubject();
	const keywords = from.getKeywords();
	const creator = from.getCreator();
	if (title) to.setTitle(title);
	if (author) to.setAuthor(author);
	if (subject) to.setSubject(subject);
	if (keywords) to.setKeywords(keywords.split(",").map((word) => word.trim()).filter(Boolean));
	if (creator) to.setCreator(creator);
};

/** Pull out the chosen 1-based pages, in the order requested. */
export const extractPages = (bytes: Uint8Array, pages: number[]): Promise<Uint8Array> =>
	guard(async () => {
		const { PDFDocument } = await loadPdfLib();
		const source = await openDocument(bytes);
		const total = source.getPageCount();
		if (!pages.length) throw new PdfInputError("Choose at least one page.");
		for (const page of pages) {
			if (page < 1 || page > total) throw new PdfInputError(`This PDF has ${total} pages, so page ${page} does not exist.`);
		}
		const target = await PDFDocument.create();
		copyMetadata(source, target);
		const copied = await target.copyPages(source, pages.map((page) => page - 1));
		for (const page of copied) target.addPage(page);
		return target.save({ useObjectStreams: true });
	});

/** Re-order, rotate, or drop pages in one pass, keeping every other page untouched. */
export const rewritePages = (
	bytes: Uint8Array,
	plan: { keep: number[]; rotate: Record<number, number> },
): Promise<Uint8Array> =>
	guard(async () => {
		const { PDFDocument, degrees } = await loadPdfLib();
		const source = await openDocument(bytes);
		const total = source.getPageCount();
		if (!plan.keep.length) throw new PdfInputError("Keep at least one page.");
		for (const page of plan.keep) {
			if (page < 1 || page > total) throw new PdfInputError(`This PDF has ${total} pages, so page ${page} does not exist.`);
		}
		const target = await PDFDocument.create();
		copyMetadata(source, target);
		const copied = await target.copyPages(source, plan.keep.map((page) => page - 1));
		copied.forEach((page, index) => {
			const turn = plan.rotate[plan.keep[index]] ?? 0;
			if (turn) page.setRotation(degrees((page.getRotation().angle + turn) % 360));
			target.addPage(page);
		});
		return target.save({ useObjectStreams: true });
	});
