/**
 * PowerPoint decks to Markdown, read here in the tab.
 *
 * A .pptx is a zip of XML: each slide is `ppt/slides/slideN.xml`, and the slide's own
 * relationships point at its notes. We take the words — titles, body lines, and speaker
 * notes — and leave the layout, the theme, and the pictures behind.
 */

import { readZipEntries, type ZipEntry } from "@/features/converter-tools/zip-reader";

export type PptSlide = { number: number; title: string; lines: string[]; notes: string };
export type PptDeck = { slides: PptSlide[]; skipped: number };
export type PptFormat = "markdown" | "text";

const decoder = new TextDecoder("utf-8");

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");

const elements = (root: Document | Element, name: string) => Array.from(root.getElementsByTagName("*")).filter((node) => node.localName === name);

const textOf = (element: Element) => (element.textContent ?? "").replace(/\s+/gu, " ").trim();

/** Paragraphs, each one a line on the slide, with a flag for the ones that are titles. */
const paragraphsOf = (slide: Document): { text: string; isTitle: boolean }[] => {
	const out: { text: string; isTitle: boolean }[] = [];
	for (const shape of elements(slide, "sp")) {
		const placeholder = elements(shape, "ph")[0]?.getAttribute("type") ?? "";
		const isTitle = placeholder === "title" || placeholder === "ctrTitle";
		for (const paragraph of elements(shape, "p")) {
			// A paragraph holds runs; fields (slide numbers, dates) are skipped as noise.
			const runs = elements(paragraph, "r")
				.map((run) => textOf(run))
				.filter(Boolean);
			const text = runs.join(" ").trim();
			if (text) out.push({ text, isTitle });
		}
	}
	return out;
};

const notesOf = (notes: Document): string => {
	const paragraphs: string[] = [];
	for (const shape of elements(notes, "sp")) {
		const placeholder = elements(shape, "ph")[0]?.getAttribute("type") ?? "";
		// The slide number and the slide image live in placeholders we do not want.
		if (placeholder === "sldNum" || placeholder === "sldImg" || placeholder === "hdr" || placeholder === "ftr" || placeholder === "dt") continue;
		for (const paragraph of elements(shape, "p")) {
			const text = elements(paragraph, "r")
				.map((run) => textOf(run))
				.filter(Boolean)
				.join(" ")
				.trim();
			if (text) paragraphs.push(text);
		}
	}
	return paragraphs.join("\n");
};

/** Joins an archive-relative path with a relationship target, walking out of ".." folders. */
export const resolvePath = (base: string, target: string): string => {
	const clean = target.split("#")[0];
	if (!clean) return "";
	if (clean.startsWith("/")) return clean.slice(1);
	const out: string[] = [];
	for (const part of `${base}${clean}`.split("/")) {
		if (part === "" || part === ".") continue;
		if (part === "..") out.pop();
		else out.push(part);
	}
	return out.join("/");
};

/** `ppt/slides/_rels/slide3.xml.rels` → `ppt/notesSlides/notesSlide1.xml`, if there is one. */
const notesPathFor = (slidePath: string, entries: Map<string, ZipEntry>): string | null => {
	const relsPath = slidePath.replace(/([^/]+)$/u, "_rels/$1.rels");
	const rels = entries.get(relsPath.toLowerCase());
	if (!rels) return null;
	const parsed = parseXml(decoder.decode(rels.bytes));
	for (const relationship of elements(parsed, "Relationship")) {
		const target = relationship.getAttribute("Target") ?? "";
		if (!/notesSlide\d+\.xml$/iu.test(target)) continue;
		const base = slidePath.slice(0, slidePath.lastIndexOf("/") + 1);
		const clean = resolvePath(base, target);
		if (entries.has(clean.toLowerCase())) return clean;
	}
	return null;
};

export const readPptx = async (bytes: Uint8Array): Promise<PptDeck> => {
	const entries = new Map<string, ZipEntry>();
	for (const entry of await readZipEntries(bytes)) entries.set(entry.name.toLowerCase(), entry);
	const slides = [...entries.keys()]
		.filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
		.sort((left, right) => Number(/(\d+)\.xml$/u.exec(left)?.[1] ?? 0) - Number(/(\d+)\.xml$/u.exec(right)?.[1] ?? 0));
	if (!slides.length) throw new Error("That file has no slides in it — save it again as a .pptx.");

	const out: PptSlide[] = [];
	let skipped = 0;
	for (const [index, path] of slides.entries()) {
		const entry = entries.get(path);
		if (!entry) continue;
		const slide = parseXml(decoder.decode(entry.bytes));
		const paragraphs = paragraphsOf(slide);
		const title = paragraphs.find((paragraph) => paragraph.isTitle)?.text ?? "";
		const lines = paragraphs.filter((paragraph) => !paragraph.isTitle).map((paragraph) => paragraph.text);
		const notesPath = notesPathFor(path, entries);
		const notesEntry = notesPath ? entries.get(notesPath.toLowerCase()) : undefined;
		const notes = notesEntry ? notesOf(parseXml(decoder.decode(notesEntry.bytes))) : "";
		if (!title && !lines.length && !notes) skipped += 1;
		out.push({ number: index + 1, title, lines, notes });
	}
	return { slides: out, skipped };
};

export const deckToMarkdown = (deck: PptDeck): string => {
	const blocks = deck.slides.map((slide, index) => {
		const lines: string[] = [`## Slide ${index + 1}${slide.title ? `: ${slide.title}` : ""}`];
		if (slide.lines.length) lines.push("", ...slide.lines.map((line) => `- ${line}`));
		if (slide.notes) lines.push("", ...slide.notes.split("\n").map((line) => `> ${line}`));
		return lines.join("\n");
	});
	return blocks.join("\n\n").trim();
};

export const deckToText = (deck: PptDeck): string =>
	deck.slides
		.map((slide, index) => {
			const head = `Slide ${index + 1}${slide.title ? ` — ${slide.title}` : ""}`;
			const body = slide.lines.join("\n");
			const notes = slide.notes ? `Notes: ${slide.notes.split("\n").join(" ")}` : "";
			return [head, body, notes].filter(Boolean).join("\n");
		})
		.join("\n\n")
		.trim();

export const deckWordCount = (deck: PptDeck): number =>
	deck.slides.reduce(
		(sum, slide) => sum + `${slide.title} ${slide.lines.join(" ")} ${slide.notes}`.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length,
		0,
	);
