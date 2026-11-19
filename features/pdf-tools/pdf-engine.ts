import type { PDFPage } from "pdf-lib";
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

export type PagePreset = "fit" | "a4" | "letter";

const PRESET_SIZES: Record<Exclude<PagePreset, "fit">, [number, number]> = {
	a4: [595.28, 841.89],
	letter: [612, 792],
};

/**
 * Builds a PDF from pictures, one page each. Images are embedded as they are (JPEG stays
 * JPEG), so nothing is re-encoded. "fit" makes the page exactly the picture's size at
 * 72 dpi; a paper preset scales the picture down to sit inside the margins.
 */
export const imagesToPdf = (
	images: { bytes: Uint8Array; type: "image/png" | "image/jpeg" }[],
	preset: PagePreset = "fit",
	margin = 24,
	options: { dpi?: number } = {},
): Promise<Uint8Array> =>
	guard(async () => {
		if (!images.length) throw new PdfInputError("Add at least one image.");
		const { PDFDocument } = await loadPdfLib();
		const doc = await PDFDocument.create();
		for (const image of images) {
			const embedded = image.type === "image/jpeg" ? await doc.embedJpg(image.bytes) : await doc.embedPng(image.bytes);
			const width = embedded.width;
			const height = embedded.height;
			if (preset === "fit") {
				// A picture drawn at 144 dpi represents half as many points as it has pixels.
				const perPoint = (options.dpi ?? 72) / 72;
				const page = doc.addPage([width / perPoint, height / perPoint]);
				page.drawImage(embedded, { x: 0, y: 0, width: width / perPoint, height: height / perPoint });
				continue;
			}
			const [pageWidth, pageHeight] = PRESET_SIZES[preset];
			const landscape = width > height;
			const base = landscape ? ([pageHeight, pageWidth] as [number, number]) : ([pageWidth, pageHeight] as [number, number]);
			const page = doc.addPage(base);
			const room = { width: base[0] - margin * 2, height: base[1] - margin * 2 };
			const zoom = Math.min(room.width / width, room.height / height, 1);
			const drawn = { width: width * zoom, height: height * zoom };
			page.drawImage(embedded, {
				x: (base[0] - drawn.width) / 2,
				y: (base[1] - drawn.height) / 2,
				width: drawn.width,
				height: drawn.height,
			});
		}
		return doc.save({ useObjectStreams: true });
	});

/**
 * Re-saves a document with cross-reference streams and shared object streams. Page
 * content is copied verbatim, so text, fonts, and vectors are untouched; the saving comes
 * from the file's structure, which is why it helps most on files built by older tools.
 */
export const optimisePdf = (bytes: Uint8Array): Promise<Uint8Array> =>
	guard(async () => {
		const document = await openDocument(bytes);
		return document.save({ useObjectStreams: true, addDefaultPage: false });
	});

export type WatermarkOptions = {
	text: string;
	opacity?: number;
	size?: number;
	color?: "grey" | "red" | "blue";
	tiled?: boolean;
};

/** Can the stamp font actually draw these words? */
const isLatin = (text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }) => {
	try {
		font.widthOfTextAtSize(text, 12);
		return true;
	} catch {
		return false;
	}
};

const WATERMARK_COLOURS: Record<"grey" | "red" | "blue", [number, number, number]> = {
	grey: [0.45, 0.45, 0.45],
	red: [0.75, 0.15, 0.15],
	blue: [0.15, 0.3, 0.7],
};

/**
 * Writes text across every page. Existing page content is untouched — the words go on in a
 * separate layer — so the document's own fonts and artwork stay exactly as they were.
 */
export const addWatermark = (bytes: Uint8Array, options: WatermarkOptions): Promise<Uint8Array> =>
	guard(async () => {
		const text = options.text.trim();
		if (!text) throw new PdfInputError("Type the words to stamp on the pages.");
		const { StandardFonts, degrees, rgb } = await loadPdfLib();
		const document = await openDocument(bytes);
		const font = await document.embedFont(StandardFonts.HelveticaBold);
		if (!isLatin(text, font)) throw new PdfInputError("The built-in stamp font only covers Latin letters, digits, and common punctuation. Try shorter wording.");
		const colour = rgb(...WATERMARK_COLOURS[options.color ?? "grey"]);
		const opacity = Math.min(Math.max(options.opacity ?? 0.16, 0.02), 1);
		for (const page of document.getPages()) {
			const { width, height } = page.getSize();
			const size = options.size ?? Math.max(12, Math.min(width, height) / (text.length > 18 ? 12 : 8));
			const textWidth = font.widthOfTextAtSize(text, size);
			if (options.tiled) {
				for (let y = size; y < height; y += size * 4) {
					const offset = (Math.round(y / (size * 4)) % 2) * (textWidth / 2);
					for (let x = -textWidth + offset; x < width; x += textWidth + size * 3) {
						page.drawText(text, { x, y, size, font, color: colour, opacity, rotate: degrees(45) });
					}
				}
				continue;
			}
			const angle = 45;
			const radians = (angle * Math.PI) / 180;
			page.drawText(text, {
				x: width / 2 - (textWidth / 2) * Math.cos(radians) + (size / 2) * Math.sin(radians),
				y: height / 2 - (textWidth / 2) * Math.sin(radians) - (size / 2) * Math.cos(radians),
				size,
				font,
				color: colour,
				opacity,
				rotate: degrees(angle),
			});
		}
		return document.save({ useObjectStreams: true });
	});

export type HeaderFooterOptions = {
	header?: string;
	footer?: string;
	align?: "left" | "center" | "right";
	startAt?: number;
	skipFirst?: boolean;
	size?: number;
};

export type LabelContext = { page: number; pages: number; title: string; date: string };

/** Fills {page}, {pages}, {title}, and {date} in a header or footer template. */
export const fillLabel = (template: string, context: LabelContext) =>
	template
		.replace(/\{page\}/giu, String(context.page))
		.replace(/\{pages\}/giu, String(context.pages))
		.replace(/\{title\}/giu, context.title)
		.replace(/\{date\}/giu, context.date)
		.replace(/\s+/gu, " ")
		.trim();

/**
 * Writes a header and/or footer on every page. The words go on as a separate layer, so the
 * document's own fonts, images, and links are untouched.
 */
export const addHeadersAndFooters = (bytes: Uint8Array, options: HeaderFooterOptions): Promise<Uint8Array> =>
	guard(async () => {
		const header = (options.header ?? "").trim();
		const footer = (options.footer ?? "").trim();
		if (!header && !footer) throw new PdfInputError("Write something for the header or the footer.");
		const { StandardFonts, rgb } = await loadPdfLib();
		const document = await openDocument(bytes);
		const font = await document.embedFont(StandardFonts.Helvetica);
		const size = options.size ?? 9;
		const pages = document.getPageCount();
		const title = document.getTitle()?.trim() ?? "";
		const date = new Date().toISOString().slice(0, 10);
		const start = options.startAt ?? 1;
		const align = options.align ?? "center";
		const ink = rgb(0.25, 0.25, 0.25);

		const write = (page: PDFPage, template: string, atTop: boolean, label: number) => {
			const text = fillLabel(template, { page: label, pages: pages + start - 1, title, date });
			if (!text) return;
			if (!isLatin(text, font)) throw new PdfInputError("The built-in page-number font only covers Latin letters, digits, and common punctuation. Try shorter wording.");
			const { width, height } = page.getSize();
			const textWidth = font.widthOfTextAtSize(text, size);
			const x = align === "left" ? 40 : align === "right" ? width - 40 - textWidth : (width - textWidth) / 2;
			page.drawText(text, { x, y: atTop ? height - 32 : 24, size, font, color: ink });
		};

		document.getPages().forEach((page, index) => {
			if (options.skipFirst && index === 0) return;
			const label = start + index;
			if (header) write(page, header, true, label);
			if (footer) write(page, footer, false, label);
		});
		return document.save({ useObjectStreams: true });
	});
