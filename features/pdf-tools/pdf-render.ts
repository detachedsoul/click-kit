/**
 * Page rendering, on demand.
 *
 * pdf.js is only pulled in when a tool actually needs to see a page — thumbnails,
 * PDF-to-image, or a text layer. Everything else (merging, splitting, rotating,
 * metadata) works on the page content itself through pdf-lib, so embedded fonts stay
 * embedded and the text stays selectable.
 */

export type RenderOptions = {
	/** Output width in CSS pixels; height follows the page's own aspect ratio. */
	width?: number;
	/** Hard cap on the rendered size, whichever dimension bites first. */
	maxSize?: number;
	type?: "image/png" | "image/jpeg" | "image/webp";
	quality?: number;
};

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Loads pdf.js once and points it at the worker we ship in /public. */
export const loadPdfjs = () => {
	if (!pdfjsPromise) {
		pdfjsPromise = import("pdfjs-dist").then((module) => {
			module.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
			return module;
		});
	}
	return pdfjsPromise;
};

type LoadingTask = ReturnType<PdfjsModule["getDocument"]>;
type PdfDocument = Awaited<LoadingTask["promise"]>;

/** Where the files copied by scripts/copy-pdf-worker.mjs live. */
const ASSET_ROOT = "/pdfjs/";

const sourceOptions = (bytes: Uint8Array) => ({
	// A copy, because pdf.js may hand the buffer to its worker and we still need ours.
	data: new Uint8Array(bytes),
	cMapUrl: `${ASSET_ROOT}cmaps/`,
	cMapPacked: true,
	standardFontDataUrl: `${ASSET_ROOT}standard_fonts/`,
	wasmUrl: `${ASSET_ROOT}wasm/`,
});

/** Opens a document and one page in it; destroy the task to release the worker. */
const openPage = async (bytes: Uint8Array, pageNumber: number) => {
	const pdfjs = await loadPdfjs();
	// pdf.js may hand the buffer to its worker; give it a copy we do not need back.
	const task: LoadingTask = pdfjs.getDocument(sourceOptions(bytes));
	const document: PdfDocument = await task.promise;
	const page = await document.getPage(pageNumber);
	return { page, task };
};

/** Renders one page to an image blob. */
export const renderPageImage = async (bytes: Uint8Array, pageNumber: number, options: RenderOptions = {}): Promise<Blob> => {
	const { page, task } = await openPage(bytes, pageNumber);
	try {
		const base = page.getViewport({ scale: 1 });
		const cap = options.maxSize ?? 1600;
		const wanted = options.width ?? cap;
		const viewport = page.getViewport({ scale: Math.min(wanted / base.width, cap / base.height, 4) });
		const canvas = globalThis.document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(viewport.width));
		canvas.height = Math.max(1, Math.round(viewport.height));
		await page.render({ canvas, viewport }).promise;
		const type = options.type ?? "image/png";
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, options.quality));
		if (!blob) throw new Error("This page could not be drawn.");
		return blob;
	} finally {
		page.cleanup();
		await task.destroy();
	}
};

/** A small preview of one page, as a data URL ready for an `<img src>`. */
export const renderPageThumbnail = async (bytes: Uint8Array, pageNumber: number, maxSize = 180): Promise<string> => {
	const blob = await renderPageImage(bytes, pageNumber, { maxSize, type: "image/jpeg", quality: 0.72 });
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
		reader.onerror = () => reject(new Error("This page could not be previewed."));
		reader.readAsDataURL(blob);
	});
};

/** Every page's text, joined by a blank line. */
export const extractPdfText = async (bytes: Uint8Array, pageNumbers?: number[]): Promise<{ page: number; text: string }[]> => {
	const pdfjs = await loadPdfjs();
	const task: LoadingTask = pdfjs.getDocument(sourceOptions(bytes));
	const document: PdfDocument = await task.promise;
	try {
		const wanted = pageNumbers ?? Array.from({ length: document.numPages }, (_, index) => index + 1);
		const out: { page: number; text: string }[] = [];
		for (const pageNumber of wanted) {
			const page = await document.getPage(pageNumber);
			const content = await page.getTextContent();
			const text = content.items
				.map((item) => ("str" in item ? item.str : ""))
				.join(" ")
				.replace(/[ \t]+/gu, " ")
				.replace(/ ?\n ?/gu, "\n")
				.trim();
			out.push({ page: pageNumber, text });
			page.cleanup();
		}
		return out;
	} finally {
		await task.destroy();
	}
};
