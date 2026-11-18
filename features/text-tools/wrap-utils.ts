export type WrapOptions = { width: number; mode: "wrap" | "unwrap"; breakLongWords: boolean; keepBlankLines: boolean };

export type WrapReport = { text: string; lines: number; longestLine: number; words: number; paragraphs: number };

const splitParagraphs = (source: string) => source.replace(/\r\n/gu, "\n").split(/\n{2,}/u).map((paragraph) => paragraph.trim());

const splitLongWord = (word: string, width: number) => {
	const chunks: string[] = [];
	for (let index = 0; index < word.length; index += width) chunks.push(word.slice(index, index + width));
	return chunks;
};

const wrapParagraph = (paragraph: string, width: number, breakLongWords: boolean) => {
	const words = paragraph.split(/\s+/u).filter(Boolean);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const pieces = word.length > width && breakLongWords ? splitLongWord(word, width) : [word];
		for (const piece of pieces) {
			if (!current) {
				current = piece;
			} else if (`${current} ${piece}`.length <= width) {
				current = `${current} ${piece}`;
			} else {
				lines.push(current);
				current = piece;
			}
		}
	}
	if (current) lines.push(current);
	return lines;
};

export const unwrapParagraph = (paragraph: string) =>
	paragraph
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.reduce((merged, line) => {
			if (!merged) return line;
			if (merged.endsWith("-") && /^[a-z]/u.test(line)) return `${merged.slice(0, -1)}${line}`;
			return `${merged} ${line}`;
		}, "");

export const wrapText = (source: string, options: Partial<WrapOptions> = {}): WrapReport => {
	if (!source.trim()) throw new Error("Paste some text to wrap first.");
	const settings: WrapOptions = { width: 80, mode: "wrap", breakLongWords: false, keepBlankLines: true, ...options };
	if (!Number.isInteger(settings.width) || settings.width < 3 || settings.width > 200) throw new Error("Line width must be a whole number between 3 and 200.");
	const paragraphs = splitParagraphs(source);
	const blocks = paragraphs.map((paragraph) =>
		settings.mode === "wrap" ? wrapParagraph(paragraph, settings.width, settings.breakLongWords).join("\n") : unwrapParagraph(paragraph),
	);
	const text = blocks.join(settings.keepBlankLines ? "\n\n" : "\n").trimEnd();
	const lines = text.split("\n");
	const words = text.split(/\s+/u).filter(Boolean).length;
	return {
		text,
		lines: lines.length,
		longestLine: lines.reduce((longest, line) => Math.max(longest, line.length), 0),
		words,
		paragraphs: paragraphs.length,
	};
};
