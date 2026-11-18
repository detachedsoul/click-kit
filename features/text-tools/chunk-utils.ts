export type ChunkMode = "paragraph" | "sentence" | "word" | "character";

export const CHUNK_MODES: { id: ChunkMode; label: string; hint: string }[] = [
	{ id: "paragraph", label: "Paragraphs", hint: "Never cuts a paragraph unless it is longer than the limit." },
	{ id: "sentence", label: "Sentences", hint: "Keeps whole sentences together where it can." },
	{ id: "word", label: "Words", hint: "Fills each piece as far as words allow, the usual choice for posts." },
	{ id: "character", label: "Characters", hint: "Hard cuts at the limit, useful for fixed-width fields." },
];

const splitParagraphs = (text: string) => text.split(/\n{2,}/u);

const splitSentences = (text: string) => {
	const output: string[] = [];
	for (const paragraph of splitParagraphs(text)) {
		let start = 0;
		for (let index = 0; index < paragraph.length; index += 1) {
			const next = paragraph[index + 1];
			if (/[.!?]/u.test(paragraph[index]) && next !== undefined && /\s/u.test(next)) {
				output.push(paragraph.slice(start, index + 1));
				start = index + 1;
			}
		}
		output.push(paragraph.slice(start));
	}
	return output;
};

const splitWords = (text: string) => text.split(/\s+/u).filter(Boolean);

const splitCharacters = (text: string) => Array.from(text);

const atomsFor = (text: string, mode: ChunkMode) => {
	if (mode === "paragraph") return splitParagraphs(text);
	if (mode === "sentence") return splitSentences(text);
	if (mode === "word") return splitWords(text);
	return splitCharacters(text);
};

const joinWith = (mode: ChunkMode) => (mode === "paragraph" ? "\n\n" : mode === "sentence" ? " " : mode === "word" ? " " : "");

/** Break an over-long atom into limit-sized pieces without splitting surrogate pairs. */
const hardSplit = (atom: string, limit: number) => {
	const characters = Array.from(atom);
	const pieces: string[] = [];
	for (let index = 0; index < characters.length; index += limit) pieces.push(characters.slice(index, index + limit).join(""));
	return pieces;
};

export const chunkText = (text: string, limit: number, mode: ChunkMode = "word") => {
	if (!Number.isInteger(limit) || limit < 1) throw new Error("The limit must be a whole number of at least 1.");
	const trimmed = text.replace(/\r\n/gu, "\n").trim();
	if (!trimmed) return [];
	const separator = joinWith(mode);
	const atoms = atomsFor(trimmed, mode).map((atom) => atom.trim()).filter(Boolean);
	const expanded = atoms.flatMap((atom) => (Array.from(atom).length > limit ? hardSplit(atom, limit) : [atom]));
	const chunks: string[] = [];
	let current = "";
	for (const atom of expanded) {
		if (!current) {
			current = atom;
			continue;
		}
		if (Array.from(current).length + separator.length + Array.from(atom).length <= limit) {
			current += separator + atom;
			continue;
		}
		chunks.push(current);
		current = atom;
	}
	if (current) chunks.push(current);
	return chunks;
};

export const chunkSummary = (chunks: string[]) => {
	const lengths = chunks.map((chunk) => Array.from(chunk).length);
	return {
		count: chunks.length,
		longest: lengths.length ? Math.max(...lengths) : 0,
		shortest: lengths.length ? Math.min(...lengths) : 0,
		total: lengths.reduce((sum, length) => sum + length, 0),
	};
};

export const numberedChunks = (chunks: string[], startAt = 1) =>
	chunks.map((chunk, index) => `${startAt + index}/${chunks.length}\n${chunk}`).join("\n\n");

export const CHUNK_PRESETS: { label: string; limit: number }[] = [
	{ label: "Tweet (280)", limit: 280 },
	{ label: "SMS (160)", limit: 160 },
	{ label: "Social post (2,200)", limit: 2200 },
	{ label: "Search snippet (155)", limit: 155 },
	{ label: "Email preview (90)", limit: 90 },
];
