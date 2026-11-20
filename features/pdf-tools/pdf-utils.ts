export const ACCEPTED_PDF_TYPES = "application/pdf";
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_TOTAL_BYTES = 200 * 1024 * 1024;

export const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/iu.test(file.name);

/** "report.final.pdf" → "report.final", so suffixes stack tidily. */
export const pdfBaseName = (name: string) => {
	const trimmed = name.trim().replace(/\.pdf$/iu, "");
	return trimmed.length > 0 ? trimmed : "document";
};

export const pdfOutputName = (base: string, suffix: string) => `${pdfBaseName(base)}-${suffix}.pdf`;

/**
 * A name the browser will happily save. Anything that means something to a file system —
 * slashes, colons, question marks, control characters — becomes a dash, and a .pdf suffix
 * is added once, so a typed "handout.pdf" does not turn into "handout.pdf.pdf".
 */
export const pdfFileName = (input: string, fallback: string): string => {
	const trimmed = input.trim().replace(/\.pdf$/iu, "");
	const safe = trimmed
		.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "-")
		.replace(/\s+/gu, " ")
		.replace(/^[.\s-]+|[.\s-]+$/gu, "")
		.slice(0, 90)
		.replace(/[.\s-]+$/gu, "");
	return `${safe || pdfBaseName(fallback)}.pdf`;
};

export const pageWord = (count: number) => `${count} page${count === 1 ? "" : "s"}`;

/**
 * Keywords as a list. Some writers put commas between them, others only a space (pdf-lib
 * joins with a space), so a comma-separated list keeps its phrases and a bare list splits
 * on whitespace.
 */
export const splitKeywords = (value: string | null | undefined) => {
	const text = (value ?? "").trim();
	if (!text) return [];
	if (!/[,;]/u.test(text)) return text.split(/\s+/u).filter(Boolean);
	return text
		.split(/[,;]/u)
		.map((part) => part.trim())
		.filter(Boolean);
};

/** Human list of the pages a tool produced: "1, 2, 5–7". */
export const formatPageList = (pages: number[]) => {
	const sorted = [...new Set(pages)].sort((left, right) => left - right);
	const parts: string[] = [];
	let start: number | null = null;
	let previous: number | null = null;
	for (const page of sorted) {
		if (start === null || previous === null) {
			start = page;
			previous = page;
			continue;
		}
		if (page === previous + 1) {
			previous = page;
			continue;
		}
		parts.push(start === previous ? String(start) : `${start}–${previous}`);
		start = page;
		previous = page;
	}
	if (start !== null && previous !== null) parts.push(start === previous ? String(start) : `${start}–${previous}`);
	return parts.join(", ");
};

/**
 * Reads a page selection such as "1-3, 5, 8-" into page numbers. Ranges are inclusive,
 * "8-" runs to the last page, and "-3" means the first three pages.
 */
export const parsePageRange = (input: string, pageCount: number): number[] => {
	if (!Number.isFinite(pageCount) || pageCount < 1) throw new Error("Add a PDF first.");
	const text = input.trim();
	if (!text) throw new Error("Enter at least one page, for example 1-3.");
	const pages: number[] = [];
	for (const rawPart of text.split(",")) {
		const piece = rawPart.trim();
		if (!piece) throw new Error(`“${text}” has an empty part — check the commas.`);
		const range = /^(\d+)?\s*[-–]\s*(\d+)?$/u.exec(piece);
		if (range) {
			if (!range[1] && !range[2]) throw new Error(`“${piece}” is not a page range.`);
			const start = range[1] ? Number(range[1]) : 1;
			const end = range[2] ? Number(range[2]) : pageCount;
			if (start < 1 || end < 1) throw new Error("Pages start at 1.");
			if (start > end) throw new Error(`“${piece}” runs backwards.`);
			if (end > pageCount) throw new Error(`This PDF has ${pageWord(pageCount)}, so page ${end} does not exist.`);
			for (let page = start; page <= end; page += 1) pages.push(page);
			continue;
		}
		if (!/^\d+$/u.test(piece)) throw new Error(`“${piece}” is not a page number.`);
		const page = Number(piece);
		if (page < 1) throw new Error("Pages start at 1.");
		if (page > pageCount) throw new Error(`This PDF has ${pageWord(pageCount)}, so page ${page} does not exist.`);
		pages.push(page);
	}
	return pages;
};

/** A split plan: each `;` part becomes its own file. "1-3; 4-6; 7" → three documents. */
export const parseRangeGroups = (input: string, pageCount: number): number[][] => {
	const groups = input
		.split(";")
		.map((part) => part.trim())
		.filter(Boolean);
	if (!groups.length) throw new Error("Enter at least one range, for example 1-3; 4-6.");
	return groups.map((group) => parsePageRange(group, pageCount));
};

/** Plain-language name for a group of pages, used in the download list. */
export const groupLabel = (pages: number[]) => {
	if (!pages.length) return "empty";
	const sorted = [...pages].sort((left, right) => left - right);
	const first = sorted[0];
	const last = sorted.at(-1) ?? first;
	return sorted.length === 1 ? `page-${first}` : `pages-${first}-${last}`;
};

/** Turns a pdf-lib failure into something worth reading. */
export const pdfErrorMessage = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	if (/encrypted/iu.test(message)) return "This PDF is password protected. Save an unlocked copy, then try again.";
	if (/No PDF header|InvalidPDF|Failed to parse|parse/iu.test(message)) return "That file is not a readable PDF — it may be damaged or renamed.";
	if (/encrypted|password/iu.test(message)) return "This PDF is password protected.";
	return "That PDF could not be read. Try another file.";
};

export const validatePdfFile = (file: File) => {
	if (!isPdf(file)) return "Choose a PDF file.";
	if (file.size < 1) return "That file is empty.";
	if (file.size > MAX_PDF_BYTES) return "Choose a PDF smaller than 50 MB.";
	return "";
};

export const validatePdfFiles = (files: File[]) => {
	if (!files.length) return "Choose at least one PDF.";
	const total = files.reduce((sum, file) => sum + file.size, 0);
	if (total > MAX_PDF_TOTAL_BYTES) return "Keep the whole batch under 200 MB.";
	for (const file of files) {
		const problem = validatePdfFile(file);
		if (problem) return `${file.name}: ${problem}`;
	}
	return "";
};
