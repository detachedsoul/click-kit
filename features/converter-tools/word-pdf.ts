/**
 * Word documents (.docx) to PDF.
 *
 * The text is read out of `word/document.xml`, with its headings, its bold and italic runs, its
 * lists, and its tables, and then laid out again on fresh A4 or Letter pages with pdf-lib.
 * Nothing is rasterised: the result is real text you can select and search. Word-only extras —
 * comments, tracked changes, text boxes, images, footnotes — are left behind, and the tool says
 * so rather than quietly dropping them.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { readZipFile } from "@/features/converter-tools/zip-reader";

const children = (element: Element) => Array.from(element.children);
const local = (element: Element) => element.localName;

const attribute = (element: Element | undefined, ...names: string[]) => {
	if (!element) return "";
	for (const name of names) {
		const value = element.getAttribute(`w:${name}`) ?? element.getAttribute(name);
		if (value) return value;
	}
	return "";
};

/** WinAnsi is what the standard fonts can draw; anything else becomes the nearest plain mark. */
const LOOKALIKES: Record<string, string> = {
	"\u2018": "'",
	"\u2019": "'",
	"\u201a": "'",
	"\u201b": "'",
	"\u201c": '"',
	"\u201d": '"',
	"\u201e": '"',
	"\u2013": "-",
	"\u2014": "\u2014",
	"\u2192": "->",
	"\u2190": "<-",
	"\u2212": "-",
	"\u2264": "<=",
	"\u2265": ">=",
	"\u2248": "~",
	"\u00a0": " ",
	"\u2009": " ",
	"\u202f": " ",
	"\u200b": "",
	"\ufeff": "",
};

const WIN_ANSI_EXTRAS = new Set(["Œ", "œ", "Š", "š", "Ÿ", "Ž", "ž", "ƒ", "ˆ", "˜", "–", "—", "‘", "’", "‚", "“", "”", "„", "†", "‡", "•", "…", "‰", "‹", "›", "€", "™"]);

/** Letters the standard fonts can draw, with everything else folded to something close. */
export const printable = (text: string) =>
	Array.from(text)
		.map((letter) => {
			if (letter === "\n" || letter === "\r" || letter === "\t") return " ";
			const code = letter.codePointAt(0) ?? 0;
			if (code < 0x20) return "";
			if (code >= 0x20 && code <= 0x7e) return letter;
			if (code >= 0xa0 && code <= 0xff) return letter;
			if (WIN_ANSI_EXTRAS.has(letter)) return letter;
			return LOOKALIKES[letter] ?? "?";
		})
		.join("");

export type Run = { bold: boolean; italic: boolean; text: string };

export type DocBlock =
	| { kind: "heading"; level: number; runs: Run[] }
	| { kind: "list"; level: number; marker: string; runs: Run[] }
	| { kind: "paragraph"; runs: Run[] }
	| { kind: "table"; rows: string[][] };

const textOf = (element: Element) => {
	let text = "";
	for (const node of children(element)) {
		const name = local(node);
		if (name === "t") text += node.textContent ?? "";
		else if (name === "tab") text += " ";
		else if (name === "br" || name === "cr") text += " ";
		else if (name === "noBreakHyphen") text += "-";
	}
	return text;
};

const runOf = (run: Element): Run => {
	const properties = children(run).find((node) => local(node) === "rPr");
	const on = (name: string) => {
		if (!properties) return false;
		const flag = children(properties).find((node) => local(node) === name);
		if (!flag) return false;
		const value = attribute(flag, "val");
		return value !== "0" && value !== "false";
	};
	return { bold: on("b") || on("bCs"), italic: on("i") || on("iCs"), text: textOf(run) };
};

/** Every run of a paragraph, hyperlink runs included, in the order they are read. */
const runsOf = (paragraph: Element): Run[] => {
	const runs: Run[] = [];
	const walk = (element: Element) => {
		for (const node of children(element)) {
			const name = local(node);
			if (name === "r") runs.push(runOf(node));
			else if (name === "hyperlink" || name === "smartTag" || name === "ins" || name === "sdt" || name === "sdtContent") walk(node);
			else if (name === "del") continue;
		}
	};
	walk(paragraph);
	return runs.filter((run) => run.text !== "");
};

const paragraphProperties = (paragraph: Element) => children(paragraph).find((node) => local(node) === "pPr");

const headingLevel = (paragraph: Element) => {
	const properties = paragraphProperties(paragraph);
	const style = properties ? children(properties).find((node) => local(node) === "pStyle") : undefined;
	const name = attribute(style, "val").toLowerCase();
	if (name === "title") return 1;
	if (name === "subtitle") return 2;
	const match = /heading\s*(\d)/u.exec(name);
	if (match) return Math.min(Number(match[1]), 4);
	return 0;
};

const numberingOf = (paragraph: Element) => {
	const properties = paragraphProperties(paragraph);
	const numbering = properties ? children(properties).find((node) => local(node) === "numPr") : undefined;
	if (!numbering) return null;
	const id = attribute(children(numbering).find((node) => local(node) === "numId"), "val");
	const level = Number(attribute(children(numbering).find((node) => local(node) === "ilvl"), "val") || "0");
	return { id, level: Math.min(Math.max(level, 0), 4) };
};

/** Which numbering ids draw numbers and which draw bullets, per level. */
const readNumbering = (xml: string | null) => {
	const formats = new Map<string, Map<number, "bullet" | "ordered">>();
	if (!xml) return formats;
	const parsed = new DOMParser().parseFromString(xml, "text/xml");
	const abstract = new Map<string, Map<number, "bullet" | "ordered">>();
	for (const element of Array.from(parsed.getElementsByTagName("*"))) {
		if (element.localName !== "abstractNum") continue;
		const levels = new Map<number, "bullet" | "ordered">();
		for (const level of children(element)) {
			if (local(level) !== "lvl") continue;
			const index = Number(attribute(level, "ilvl") || "0");
			const format = attribute(children(level).find((node) => local(node) === "numFmt"), "val");
			levels.set(index, format === "bullet" ? "bullet" : "ordered");
		}
		abstract.set(attribute(element, "abstractNumId"), levels);
	}
	for (const element of Array.from(parsed.getElementsByTagName("*"))) {
		if (element.localName !== "num") continue;
		const reference = attribute(children(element).find((node) => local(node) === "abstractNumId"), "val");
		const levels = abstract.get(reference);
		if (levels) formats.set(attribute(element, "numId"), levels);
	}
	return formats;
};

const tableRows = (table: Element): string[][] => {
	const rows: string[][] = [];
	for (const row of children(table)) {
		if (local(row) !== "tr") continue;
		const cells: string[] = [];
		for (const cell of children(row)) {
			if (local(cell) !== "tc") continue;
			const text = children(cell)
				.filter((node) => local(node) === "p")
				.map((paragraph) => runsOf(paragraph).map((run) => run.text).join(""))
				.join(" ")
				.trim();
			cells.push(text);
		}
		if (cells.length) rows.push(cells);
	}
	return rows;
};

/** The blocks of a Word document, in reading order. */
export const readDocxBlocks = async (bytes: Uint8Array): Promise<DocBlock[]> => {
	const xml = await readZipFile(bytes, "word/document.xml");
	if (!xml) throw new Error("That file has no word/document.xml, so it is not a Word document.");
	const parsed = new DOMParser().parseFromString(xml, "text/xml");
	if (parsed.querySelector("parsererror")) throw new Error("This Word file could not be read — its document.xml is damaged.");
	const numbering = readNumbering(await readZipFile(bytes, "word/numbering.xml"));
	const body = Array.from(parsed.getElementsByTagName("*")).find((element) => element.localName === "body");
	if (!body) throw new Error("This Word file has no body to read.");

	const blocks: DocBlock[] = [];
	const counters: number[] = [];
	for (const node of children(body)) {
		const name = local(node);
		if (name === "tbl") {
			const rows = tableRows(node);
			if (rows.length) blocks.push({ kind: "table", rows });
			counters.length = 0;
			continue;
		}
		if (name !== "p") continue;
		const runs = runsOf(node);
		if (!runs.some((run) => run.text.trim())) continue;
		const level = headingLevel(node);
		if (level) {
			blocks.push({ kind: "heading", level, runs });
			counters.length = 0;
			continue;
		}
		const numberingHere = numberingOf(node);
		if (numberingHere) {
			const format = numbering.get(numberingHere.id)?.get(numberingHere.level) ?? "bullet";
			let marker = "•";
			if (format === "ordered") {
				counters[numberingHere.level] = (counters[numberingHere.level] ?? 0) + 1;
				counters.length = numberingHere.level + 1;
				marker = `${counters[numberingHere.level]}.`;
			}
			blocks.push({ kind: "list", level: numberingHere.level, marker, runs });
			continue;
		}
		counters.length = 0;
		blocks.push({ kind: "paragraph", runs });
	}
	return blocks;
};

type Piece = { bold: boolean; italic: boolean; text: string; width: number };

const PAGE_SIZES = { a4: [595.28, 841.89] as const, letter: [612, 792] as const };
const MARGIN = 56.7;
const INK = rgb(0.09, 0.1, 0.08);

const BODY_SIZE = 10.5;
const LINE = 1.4;

type Face = { bold: boolean; italic: boolean };
const faceKey = (face: Face) => (face.bold ? (face.italic ? "bi" : "b") : face.italic ? "i" : "r");

const headingSize = (level: number) => (level <= 1 ? 20 : level === 2 ? 16 : level === 3 ? 13 : 11.5);
const headingSpace = (level: number) => (level <= 1 ? 18 : level === 2 ? 14 : 10);

export type WordPdfOptions = { pageSize?: "a4" | "letter" };
export type WordPdfResult = { bytes: Uint8Array; pageCount: number; wordCount: number };

/**
 * Renders the text of a .docx onto fresh pages. Throws when the document has nothing to say,
 * because an empty PDF is not a useful answer.
 */
export const docxToPdf = async (bytes: Uint8Array, options: WordPdfOptions = {}): Promise<WordPdfResult> => {
	const blocks = await readDocxBlocks(bytes);
	const wordCount = blocks.reduce((total, block) => {
		if (block.kind === "table") return total + block.rows.flat().join(" ").split(/\s+/u).filter(Boolean).length;
		return total + block.runs.reduce((sum, run) => sum + run.text.split(/\s+/u).filter(Boolean).length, 0);
	}, 0);
	if (!blocks.length) throw new Error("This document has no text — it may be images only.");

	const pdf = await PDFDocument.create();
	const [pageWidth, pageHeight] = PAGE_SIZES[options.pageSize ?? "a4"];
	const fonts = {
		b: await pdf.embedFont(StandardFonts.HelveticaBold),
		bi: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
		i: await pdf.embedFont(StandardFonts.HelveticaOblique),
		r: await pdf.embedFont(StandardFonts.Helvetica),
	};
	let page = pdf.addPage([pageWidth, pageHeight]);
	let top = MARGIN;
	const contentWidth = pageWidth - MARGIN * 2;

	const measure = (text: string, face: Face, size: number) => fonts[faceKey(face)].widthOfTextAtSize(text, size);

	const newPage = () => {
		page = pdf.addPage([pageWidth, pageHeight]);
		top = MARGIN;
	};

	const roomFor = (height: number) => {
		if (top + height <= pageHeight - MARGIN) return true;
		newPage();
		return true;
	};

	const drawPieces = (pieces: Piece[], size: number, left: number) => {
		let cursor = left;
		for (const piece of pieces) {
			page.drawText(piece.text, { color: INK, font: fonts[faceKey(piece)], size, x: cursor, y: pageHeight - top - size * 0.85 });
			cursor += piece.width;
		}
	};

	/** Greedy wrapping: words join a line until the next one would not fit. */
	const wrap = (runs: Run[], size: number, maxWidth: number): Piece[][] => {
		const lines: Piece[][] = [];
		let line: Piece[] = [];
		let width = 0;
		const push = (text: string, face: Face) => {
			const piece = { ...face, text, width: measure(text, face, size) };
			line.push(piece);
			width += piece.width;
		};
		for (const run of runs) {
			const face = { bold: run.bold, italic: run.italic };
			for (const token of printable(run.text).split(/(\s+)/u).filter(Boolean)) {
				if (!token.trim()) {
					if (line.length) push(" ", face);
					continue;
				}
				const wordWidth = measure(token, face, size);
				if (width + wordWidth > maxWidth && line.length) {
					// Drop the space that ended the line before starting the next one.
					while (line.length && !line[line.length - 1].text.trim()) {
						width -= line[line.length - 1].width;
						line.pop();
					}
					lines.push(line);
					line = [];
					width = 0;
				}
				if (wordWidth > maxWidth) {
					// A single unbroken word wider than the page: break it by characters.
					let chunk = "";
					for (const letter of token) {
						if (measure(chunk + letter, face, size) > maxWidth) {
							push(chunk, face);
							lines.push(line);
							line = [];
							width = 0;
							chunk = letter;
						} else chunk += letter;
					}
					if (chunk) push(chunk, face);
					continue;
				}
				push(token, face);
			}
		}
		if (line.length) lines.push(line);
		return lines;
	};

	const writeLines = (runs: Run[], size: number, left: number, maxWidth: number, gapAfter: number) => {
		const lineHeight = size * LINE;
		for (const line of wrap(runs, size, maxWidth)) {
			roomFor(lineHeight);
			drawPieces(line, size, left);
			top += lineHeight;
		}
		top += gapAfter;
	};

	const writeTable = (rows: string[][]) => {
		const columns = Math.max(...rows.map((row) => row.length));
		const columnWidth = contentWidth / columns;
		const size = 9;
		const lineHeight = size * LINE;
		for (const row of rows) {
			const cells = Array.from({ length: columns }, (_value, index) => wrap([{ bold: false, italic: false, text: row[index] ?? "" }], size, columnWidth - 8));
			const height = Math.max(1, ...cells.map((cell) => cell.length)) * lineHeight + 6;
			if (top + height > pageHeight - MARGIN) newPage();
			const rowTop = top + 3;
			cells.forEach((cell, index) => {
				top = rowTop;
				for (const line of cell) {
					drawPieces(line, size, MARGIN + index * columnWidth + 4);
					top += lineHeight;
				}
			});
			top = rowTop + height - 3;
			page.drawLine({ color: rgb(0.72, 0.71, 0.67), end: { x: MARGIN + contentWidth, y: pageHeight - top }, start: { x: MARGIN, y: pageHeight - top }, thickness: 0.5 });
			top += 6;
		}
		top += 4;
	};

	for (const block of blocks) {
		if (block.kind === "table") {
			writeTable(block.rows);
			continue;
		}
		if (block.kind === "heading") {
			top += headingSpace(block.level);
			const size = headingSize(block.level);
			writeLines(
				block.runs.map((run) => ({ ...run, bold: true })),
				size,
				MARGIN,
				contentWidth,
				8,
			);
			continue;
		}
		if (block.kind === "list") {
			const indent = 18 * block.level;
			const marker = printable(block.marker);
			const markerWidth = measure(`${marker} `, { bold: false, italic: false }, BODY_SIZE);
			// The marker and the first line have to stay together, so ask for two lines of room.
			roomFor(BODY_SIZE * LINE * 2);
			page.drawText(marker, { color: INK, font: fonts.r, size: BODY_SIZE, x: MARGIN + indent, y: pageHeight - top - BODY_SIZE * 0.85 });
			writeLines(block.runs, BODY_SIZE, MARGIN + indent + markerWidth, contentWidth - indent - markerWidth, 2);
			continue;
		}
		writeLines(block.runs, BODY_SIZE, MARGIN, contentWidth, 8);
	}

	return { bytes: new Uint8Array(await pdf.save()), pageCount: pdf.getPageCount(), wordCount };
};
