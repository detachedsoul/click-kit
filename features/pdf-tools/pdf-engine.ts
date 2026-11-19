import type { PDFPage } from "pdf-lib";
import { pdfErrorMessage, splitKeywords } from "@/features/pdf-tools/pdf-utils";

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
		keywords: splitKeywords(keywords),
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
	if (keywords) to.setKeywords(splitKeywords(keywords));
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

export type PdfMetadata = { title: string; author: string; subject: string; keywords: string };

/**
 * Replaces the document's own metadata. Only the info dictionary changes — every page,
 * font, and link is copied through untouched.
 */
export const writeMetadata = (bytes: Uint8Array, metadata: PdfMetadata): Promise<Uint8Array> =>
	guard(async () => {
		const document = await openDocument(bytes);
		const clean = (value: string) => value.trim();
		const title = clean(metadata.title);
		const author = clean(metadata.author);
		const subject = clean(metadata.subject);
		const keywords = clean(metadata.keywords)
			.split(",")
			.map((word) => word.trim())
			.filter(Boolean);
		document.setTitle(title);
		document.setAuthor(author);
		document.setSubject(subject);
		document.setKeywords(keywords);
		document.setModificationDate(new Date());
		return document.save({ useObjectStreams: true });
	});

export type PaperSize = "a4" | "letter" | "legal" | "a5";

export const PAPER_SIZES: Record<PaperSize, { width: number; height: number; label: string }> = {
	a4: { width: 595.28, height: 841.89, label: "A4" },
	letter: { width: 612, height: 792, label: "US Letter" },
	legal: { width: 612, height: 1008, label: "US Legal" },
	a5: { width: 419.53, height: 595.28, label: "A5" },
};

/**
 * Puts every page on one paper size, scaling the page content to fit and centring it. The
 * content itself — text runs, fonts, images, vectors — is the original stream with a scale
 * and a translation in front, so nothing is re-encoded or re-rendered.
 */
export const resizePages = (bytes: Uint8Array, paper: PaperSize, margin = 18): Promise<Uint8Array> =>
	guard(async () => {
		const document = await openDocument(bytes);
		const preset = PAPER_SIZES[paper];
		if (!preset) throw new PdfInputError("Choose a paper size.");
		for (const page of document.getPages()) {
			const rotation = ((page.getRotation().angle % 360) + 360) % 360;
			const sideways = rotation === 90 || rotation === 270;
			const { width, height } = page.getSize();
			const visual = sideways ? { width: height, height: width } : { width, height };
			// A landscape page stays landscape: the paper turns with it.
			const turned = visual.width > visual.height;
			const box = {
				width: (turned ? preset.height : preset.width) - margin * 2,
				height: (turned ? preset.width : preset.height) - margin * 2,
			};
			const zoom = Math.min(box.width / width, box.height / height);
			const drawn = { width: width * zoom, height: height * zoom };
			page.setSize(box.width + margin * 2, box.height + margin * 2);
			page.scaleContent(zoom, zoom);
			page.translateContent((box.width + margin * 2 - drawn.width) / 2, (box.height + margin * 2 - drawn.height) / 2);
		}
		return document.save({ useObjectStreams: true });
	});

export type CropInsets = { top: number; right: number; bottom: number; left: number };

/** Points per millimetre, for the margin fields. */
export const MM = 72 / 25.4;

/**
 * Trims the visible area of every page by a margin, in points. This sets the crop box —
 * the page's content is untouched, so text stays selectable, fonts stay embedded, and the
 * trimmed-away part is still there if someone opens the file in an editor later.
 */
export const cropPages = (bytes: Uint8Array, insets: CropInsets): Promise<Uint8Array> =>
	guard(async () => {
		const document = await openDocument(bytes);
		for (const page of document.getPages()) {
			const box = page.getMediaBox();
			const width = box.width - insets.left - insets.right;
			const height = box.height - insets.top - insets.bottom;
			if (width < 12 || height < 12) throw new PdfInputError("Those margins leave no page behind — use smaller numbers.");
			if (insets.left < 0 || insets.right < 0 || insets.top < 0 || insets.bottom < 0) throw new PdfInputError("Margins cannot be negative.");
			page.setCropBox(box.x + insets.left, box.y + insets.bottom, width, height);
		}
		return document.save({ useObjectStreams: true });
	});

export type NupGrid = { columns: number; rows: number };

export type NupLayout = { width: number; height: number; cells: { x: number; y: number; width: number; height: number }[] };

export const NUP_GRIDS: Record<number, NupGrid> = {
	1: { columns: 1, rows: 1 },
	2: { columns: 2, rows: 1 },
	4: { columns: 2, rows: 2 },
	6: { columns: 3, rows: 2 },
	9: { columns: 3, rows: 3 },
};

/**
 * Where each mini page goes on a sheet: paper turned sideways for two-up, then an even
 * grid with a margin round the outside and a gap between cells. Pure numbers, so the
 * placement can be checked without drawing anything.
 */
export const nupLayout = (perSheet: number, paper: PaperSize, margin = 18, gap = 12): NupLayout => {
	const grid = NUP_GRIDS[perSheet] ?? NUP_GRIDS[4];
	const preset = PAPER_SIZES[paper] ?? PAPER_SIZES.a4;
	const width = grid.columns > grid.rows ? preset.height : preset.width;
	const height = grid.columns > grid.rows ? preset.width : preset.height;
	const cellWidth = (width - margin * 2 - gap * (grid.columns - 1)) / grid.columns;
	const cellHeight = (height - margin * 2 - gap * (grid.rows - 1)) / grid.rows;
	const cells: NupLayout["cells"] = [];
	for (let row = 0; row < grid.rows; row += 1) {
		for (let column = 0; column < grid.columns; column += 1) {
			cells.push({
				x: margin + column * (cellWidth + gap),
				y: height - margin - (row + 1) * cellHeight - row * gap,
				width: cellWidth,
				height: cellHeight,
			});
		}
	}
	return { width, height, cells };
};

export type NupOptions = { perSheet?: number; paper?: PaperSize; margin?: number; gap?: number; border?: boolean };

/**
 * Puts several pages on one sheet. Each page is embedded as it stands — a form XObject of
 * the original content — so fonts, vectors, and links are scaled, never redrawn.
 */
export const nupPages = (bytes: Uint8Array, options: NupOptions = {}): Promise<Uint8Array> =>
	guard(async () => {
		const perSheet = options.perSheet ?? 2;
		if (!NUP_GRIDS[perSheet]) throw new PdfInputError("Choose 1, 2, 4, 6, or 9 pages per sheet.");
		const { PDFDocument, PDFName, degrees, rgb } = await loadPdfLib();
		const source = await openDocument(bytes);
		const pages = source.getPages();
		if (pages.length === 0) throw new PdfInputError("This PDF has no pages.");
		const layout = nupLayout(perSheet, options.paper ?? "a4", options.margin, options.gap);
		const target = await PDFDocument.create();
		copyMetadata(source, target);
		for (let start = 0; start < pages.length; start += perSheet) {
			const sheet = target.addPage([layout.width, layout.height]);
			const slice = pages.slice(start, start + perSheet);
			for (const [index, page] of slice.entries()) {
				const cell = layout.cells[index];
				const { width, height } = page.getSize();
				const zoom = Math.min(cell.width / width, cell.height / height);
				const drawn = { width: width * zoom, height: height * zoom };
				const x = cell.x + (cell.width - drawn.width) / 2;
				const y = cell.y + (cell.height - drawn.height) / 2;
				// A blank source page has no content stream, and pdf-lib refuses to embed one.
				// Give it an empty stream so a blank page becomes a blank cell, not an error.
				if (!page.node.Contents()) page.node.set(PDFName.of("Contents"), source.context.obj([]));
				const embedded = await target.embedPage(page);
				const turn = ((page.getRotation().angle % 360) + 360) % 360;
				if (turn === 0) sheet.drawPage(embedded, { x, y, width: drawn.width, height: drawn.height });
				else if (turn === 90) sheet.drawPage(embedded, { x: x + drawn.width, y, width: drawn.height, height: drawn.width, rotate: degrees(90) });
				else if (turn === 180) sheet.drawPage(embedded, { x: x + drawn.width, y: y + drawn.height, width: drawn.width, height: drawn.height, rotate: degrees(180) });
				else sheet.drawPage(embedded, { x, y: y + drawn.width, width: drawn.height, height: drawn.width, rotate: degrees(270) });
				if (options.border) {
					sheet.drawRectangle({ x, y, width: drawn.width, height: drawn.height, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
				}
			}
		}
		return target.save({ useObjectStreams: true });
	});

export type BookletSheet = { front: [number | null, number | null]; back: [number | null, number | null] };

/**
 * The page order for a saddle-stitched booklet: print double-sided, fold the stack in half,
 * and the pages land in reading order. Pages are 1-based, and `null` is the blank that fills
 * the last sheet out to a multiple of four.
 */
export const bookletOrder = (pageCount: number): BookletSheet[] => {
	if (!Number.isFinite(pageCount) || pageCount < 1) return [];
	const padded = Math.ceil(pageCount / 4) * 4;
	const page = (number: number) => (number >= 1 && number <= pageCount ? number : null);
	const sheets: BookletSheet[] = [];
	for (let sheet = 0; sheet < padded / 4; sheet += 1) {
		sheets.push({
			front: [page(padded - sheet * 2), page(1 + sheet * 2)],
			back: [page(2 + sheet * 2), page(padded - 1 - sheet * 2)],
		});
	}
	return sheets;
};

export type BookletOptions = { paper?: PaperSize; margin?: number; fold?: boolean };

/**
 * Imposes a PDF as a folded booklet. Two pages per landscape sheet, in booklet order, each
 * one embedded as the original content stream — so the type is still type, not a picture.
 */
export const bookletPages = (bytes: Uint8Array, options: BookletOptions = {}): Promise<Uint8Array> =>
	guard(async () => {
		const { PDFDocument, PDFName, degrees, rgb } = await loadPdfLib();
		const source = await openDocument(bytes);
		const pages = source.getPages();
		if (pages.length === 0) throw new PdfInputError("This PDF has no pages.");
		const order = bookletOrder(pages.length);
		const layout = nupLayout(2, options.paper ?? "a4", options.margin ?? 18, 12);
		const target = await PDFDocument.create();
		copyMetadata(source, target);
		const draw = async (sheet: Awaited<ReturnType<typeof target.addPage>>, slot: number, number: number | null) => {
			if (number === null) return;
			const page = pages[number - 1];
			if (!page) return;
			const cell = layout.cells[slot];
			const { width, height } = page.getSize();
			const zoom = Math.min(cell.width / width, cell.height / height);
			const drawn = { width: width * zoom, height: height * zoom };
			const x = cell.x + (cell.width - drawn.width) / 2;
			const y = cell.y + (cell.height - drawn.height) / 2;
			if (!page.node.Contents()) page.node.set(PDFName.of("Contents"), source.context.obj([]));
			const turn = ((page.getRotation().angle % 360) + 360) % 360;
			const embedded = await target.embedPage(page);
			if (turn === 0) sheet.drawPage(embedded, { x, y, width: drawn.width, height: drawn.height });
			else if (turn === 90) sheet.drawPage(embedded, { x: x + drawn.width, y, width: drawn.height, height: drawn.width, rotate: degrees(90) });
			else if (turn === 180) sheet.drawPage(embedded, { x: x + drawn.width, y: y + drawn.height, width: drawn.width, height: drawn.height, rotate: degrees(180) });
			else sheet.drawPage(embedded, { x, y: y + drawn.width, width: drawn.height, height: drawn.width, rotate: degrees(270) });
		};
		for (const part of order) {
			for (const side of [part.front, part.back] as [number | null, number | null][]) {
				const sheet = target.addPage([layout.width, layout.height]);
				await draw(sheet, 0, side[0]);
				await draw(sheet, 1, side[1]);
				if (options.fold) {
					sheet.drawLine({
						start: { x: layout.width / 2, y: 24 },
						end: { x: layout.width / 2, y: layout.height - 24 },
						thickness: 0.5,
						dashArray: [4, 4],
						color: rgb(0.72, 0.72, 0.72),
					});
				}
			}
		}
		return target.save({ useObjectStreams: true });
	});

export type RotateOptions = { angle?: 90 | 180 | 270; pages?: number[] | null };

/**
 * Turns pages in the page tree itself — the /Rotate entry the viewer already honours — so
 * nothing is redrawn and text, links, and vectors stay exactly as they were.
 */
export const rotatePages = (bytes: Uint8Array, options: RotateOptions = {}): Promise<Uint8Array> =>
	guard(async () => {
		const angle = ((options.angle ?? 90) % 360 + 360) % 360;
		if (angle !== 90 && angle !== 180 && angle !== 270) throw new PdfInputError("Choose a quarter, half, or three-quarter turn.");
		const { degrees } = await loadPdfLib();
		const doc = await openDocument(bytes);
		const total = doc.getPageCount();
		if (!total) throw new PdfInputError("This PDF has no pages.");
		const targets = options.pages?.length ? options.pages : Array.from({ length: total }, (_page, index) => index + 1);
		for (const pageNumber of targets) {
			if (pageNumber < 1 || pageNumber > total) throw new PdfInputError(`This PDF has ${total} page${total === 1 ? "" : "s"}.`);
			const page = doc.getPage(pageNumber - 1);
			const current = ((page.getRotation().angle % 360) + 360) % 360;
			page.setRotation(degrees((current + angle) % 360));
		}
		return doc.save({ useObjectStreams: true });
	});

export type ImageWatermarkOptions = {
	image: { bytes: Uint8Array; type: "image/png" | "image/jpeg" };
	/** Share of the page's width the picture takes, 0.05 – 1. */
	widthRatio?: number;
	opacity?: number;
};

/**
 * Lays a picture — a logo, a school crest, a signature — over every page in its own layer.
 * The page underneath keeps its fonts, links, and artwork, because nothing of it is touched.
 */
export const addImageWatermark = (bytes: Uint8Array, options: ImageWatermarkOptions): Promise<Uint8Array> =>
	guard(async () => {
		const document = await openDocument(bytes);
		if (!document.getPageCount()) throw new PdfInputError("This PDF has no pages.");
		const image = options.image;
		if (!image.bytes.length) throw new PdfInputError("Choose a picture to stamp with.");
		const embedded = image.type === "image/jpeg" ? await document.embedJpg(image.bytes) : await document.embedPng(image.bytes);
		if (!embedded.width || !embedded.height) throw new PdfInputError("That picture has no size to it.");
		const ratio = Math.min(Math.max(options.widthRatio ?? 0.3, 0.02), 1);
		const opacity = Math.min(Math.max(options.opacity ?? 0.3, 0.02), 1);
		for (const page of document.getPages()) {
			const { width, height } = page.getSize();
			const drawnWidth = width * ratio;
			const drawnHeight = (embedded.height / embedded.width) * drawnWidth;
			page.drawImage(embedded, {
				x: (width - drawnWidth) / 2,
				y: (height - drawnHeight) / 2,
				width: drawnWidth,
				height: drawnHeight,
				opacity,
			});
		}
		return document.save({ useObjectStreams: true });
	});

export type EditKind = "text" | "highlight" | "cover";
export type EditFont = "helvetica" | "times" | "courier";

/**
 * One mark on a page. Positions are fractions of the page — 0 is the left or top edge and
 * 1 the right or bottom — so the same edit lands in the same place whatever size the page is.
 */
export type PdfEdit = {
	kind: EditKind;
	/** 1-based page number. */
	page: number;
	x: number;
	y: number;
	text?: string;
	/** Text size in points, 6 – 96. */
	size?: number;
	font?: EditFont;
	color?: "black" | "red" | "blue";
	/** Width and height of a highlight or cover box, again as fractions of the page. */
	width?: number;
	height?: number;
};

/** "2 pages" — kept local so this module does not pull in the utils for one string. */
const pageWordOf = (count: number) => `${count} page${count === 1 ? "" : "s"}`;

const EDIT_COLOURS: Record<"black" | "red" | "blue", [number, number, number]> = {
	black: [0.1, 0.1, 0.1],
	red: [0.72, 0.16, 0.14],
	blue: [0.14, 0.28, 0.65],
};

export const EDIT_BOX_DEFAULT = { width: 0.34, height: 0.06 };

/**
 * Adds notes, highlights, and cover boxes to the pages. The marks go on as their own layer:
 * every page's existing content stream is copied through untouched, so the document keeps
 * its own embedded fonts, links, and artwork, and the new words use an embedded standard font.
 *
 * A cover box hides what is underneath it but does not remove it from the file, which is why
 * the tool calls it a cover and not a redaction.
 */
export const applyEdits = (bytes: Uint8Array, edits: PdfEdit[]): Promise<Uint8Array> =>
	guard(async () => {
		if (!edits.length) throw new PdfInputError("Add a note, a highlight, or a cover box first.");
		const { StandardFonts, rgb } = await loadPdfLib();
		const document = await openDocument(bytes);
		const total = document.getPageCount();
		if (!total) throw new PdfInputError("This PDF has no pages.");
		const fonts = new Map<EditFont, Awaited<ReturnType<typeof document.embedFont>>>();
		const fontFor = async (font: EditFont) => {
			const existing = fonts.get(font);
			if (existing) return existing;
			const standard = font === "times" ? StandardFonts.TimesRoman : font === "courier" ? StandardFonts.Courier : StandardFonts.Helvetica;
			const embedded = await document.embedFont(standard);
			fonts.set(font, embedded);
			return embedded;
		};
		const clamp = (value: number | undefined, fallback: number) => Math.min(Math.max(Number.isFinite(value) ? (value as number) : fallback, 0), 1);

		for (const edit of edits) {
			if (!Number.isInteger(edit.page) || edit.page < 1 || edit.page > total) throw new PdfInputError(`This PDF has ${pageWordOf(total)}, so page ${edit.page} does not exist.`);
			const page = document.getPage(edit.page - 1);
			const { width, height } = page.getSize();
			const left = clamp(edit.x, 0) * width;
			const top = clamp(edit.y, 0) * height;
			const boxWidth = clamp(edit.width, EDIT_BOX_DEFAULT.width) * width;
			const boxHeight = clamp(edit.height, EDIT_BOX_DEFAULT.height) * height;

			if (edit.kind === "highlight") {
				page.drawRectangle({ x: left, y: height - top - boxHeight, width: boxWidth, height: boxHeight, color: rgb(1, 0.86, 0.2), opacity: 0.35 });
				continue;
			}
			if (edit.kind === "cover") {
				page.drawRectangle({ x: left, y: height - top - boxHeight, width: boxWidth, height: boxHeight, color: rgb(1, 1, 1) });
				continue;
			}
			const text = (edit.text ?? "").trim();
			if (!text) throw new PdfInputError("Type something for the note before saving.");
			const font = await fontFor(edit.font ?? "helvetica");
			const size = Math.min(Math.max(edit.size ?? 13, 6), 96);
			if (!isLatin(text, font)) throw new PdfInputError("The built-in note fonts cover Latin letters, digits, and common punctuation. Try shorter wording.");
			page.drawText(text, { x: left, y: height - top, size, font, color: rgb(...EDIT_COLOURS[edit.color ?? "black"]) });
		}
		return document.save({ useObjectStreams: true });
	});

/**
 * Grows the page and moves its content inwards, so a document gains a white margin for
 * binding, hole punching, or notes. Nothing is scaled and nothing is redrawn: the same
 * content stream is simply shifted, so text stays sharp and fonts stay embedded.
 */
export const addMargins = (bytes: Uint8Array, insets: CropInsets): Promise<Uint8Array> =>
	guard(async () => {
		const sides = [insets.top, insets.right, insets.bottom, insets.left];
		if (sides.some((side) => !Number.isFinite(side) || side < 0)) throw new PdfInputError("Margins cannot be negative.");
		if (sides.every((side) => side === 0)) throw new PdfInputError("Add a margin on at least one side.");
		if (Math.max(...sides) > 1440) throw new PdfInputError("That is more than 50 cm of margin — use a smaller number.");
		const document = await openDocument(bytes);
		for (const page of document.getPages()) {
			const { width, height } = page.getSize();
			page.setSize(width + insets.left + insets.right, height + insets.top + insets.bottom);
			page.translateContent(insets.left, insets.bottom);
		}
		return document.save({ useObjectStreams: true });
	});
