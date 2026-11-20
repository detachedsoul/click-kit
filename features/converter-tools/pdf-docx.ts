/**
 * PDF pages to a Word document.
 *
 * A PDF holds drawing instructions, not paragraphs, so there is no structure to recover —
 * only the words on each page. This lays the extracted text out as Word paragraphs, one per
 * line, repairing the soft wraps a PDF leaves behind, and starts a new Word page wherever the
 * PDF had one. Pictures, columns, tables, and the exact placement of anything are not carried
 * across, and the tool says so rather than pretending otherwise.
 */

import { type DocxBlock, writeDocx } from "@/features/converter-tools/docx-write";

export type PdfPage = { page: number; text: string };

const tidy = (line: string) => line.replace(/[ \t\u00a0]+/gu, " ").trim();

/** A line that was only wrapped by the page width, not ended by the writer. */
const continuesOn = (line: string, next: string) => {
	if (line.length < 60) return false;
	if (/[.!?:;”"’)]$/u.test(line)) return false;
	return /^[a-zà-ÿ(]/u.test(next);
};

/** The paragraphs a page's text amounts to, with soft wraps joined back up. */
export const pdfPageParagraphs = (text: string): string[] => {
	const lines = text.split(/\r?\n/u).map(tidy).filter(Boolean);
	const paragraphs: string[] = [];
	for (const line of lines) {
		const previous = paragraphs[paragraphs.length - 1];
		if (previous !== undefined && continuesOn(previous, line)) paragraphs[paragraphs.length - 1] = `${previous} ${line}`;
		else paragraphs.push(line);
	}
	return paragraphs;
};

/** Blocks for the whole document: every page's paragraphs, a page break between pages. */
export const pdfBlocks = (pages: PdfPage[]): DocxBlock[] => {
	const blocks: DocxBlock[] = [];
	pages.forEach((page, index) => {
		if (index > 0) blocks.push({ kind: "pageBreak" });
		const paragraphs = pdfPageParagraphs(page.text);
		if (!paragraphs.length) blocks.push({ kind: "paragraph", text: "" });
		for (const text of paragraphs) blocks.push({ kind: "paragraph", text });
	});
	return blocks;
};

/** The .docx bytes for the pages of a PDF. */
export const pdfPagesToDocx = (pages: PdfPage[]): Uint8Array => writeDocx(pdfBlocks(pages));

/** How many words the pages hold, for the summary the tool shows. */
export const pageWordCount = (pages: PdfPage[]) => pages.reduce((total, page) => total + page.text.split(/\s+/u).filter(Boolean).length, 0);
