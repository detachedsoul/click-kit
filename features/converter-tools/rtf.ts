/**
 * RTF to text and Markdown, read here in the tab. RTF is a plain-text format of nested groups
 * and control words, so this walks the source rather than reaching for a library: font and
 * colour tables, pictures, and field codes are skipped, while the words people wrote survive.
 */

export type RtfOptions = { format?: "text" | "markdown" };

/** Control words whose whole group is machinery, not writing. */
const SKIPPED = new Set([
	"fonttbl",
	"colortbl",
	"stylesheet",
	"info",
	"pict",
	"object",
	"objdata",
	"header",
	"headerl",
	"headerr",
	"headerf",
	"footer",
	"footerl",
	"footerr",
	"footerf",
	"footnote",
	"annotation",
	"field",
	"fldinst",
	"listtable",
	"listoverridetable",
	"listtext",
	"rsidtbl",
	"generator",
	"xmlnstbl",
	"themedata",
	"datastore",
	"latentstyles",
	"filetbl",
	"revtbl",
	"htmltag",
	"mmathPr",
	"pgdsctbl",
	"bkmkstart",
	"bkmkend",
	"xe",
	"tc",
	"shpinst",
	"nonshppict",
	"private",
]);

/** The windows-1252 range that is not the same as Latin-1. */
const CP1252: Record<number, string> = {
	0x80: "€",
	0x82: "‚",
	0x83: "ƒ",
	0x84: "„",
	0x85: "…",
	0x86: "†",
	0x87: "‡",
	0x88: "ˆ",
	0x89: "‰",
	0x8a: "Š",
	0x8b: "‹",
	0x8c: "Œ",
	0x8e: "Ž",
	0x91: "‘",
	0x92: "’",
	0x93: "“",
	0x94: "”",
	0x95: "•",
	0x96: "–",
	0x97: "—",
	0x98: "˜",
	0x99: "™",
	0x9a: "š",
	0x9b: "›",
	0x9c: "œ",
	0x9e: "ž",
	0x9f: "Ÿ",
};

const byteToChar = (byte: number): string => CP1252[byte] ?? String.fromCharCode(byte);

type State = { skip: boolean; bold: boolean; italic: boolean };

export const isRtf = (source: string): boolean => /^\s*\{\\rtf/iu.test(source);

export const rtfToText = (source: string, options: RtfOptions = {}): string => {
	if (!isRtf(source)) throw new Error("That does not look like RTF — a real file starts with {\\rtf.");
	const markdown = (options.format ?? "markdown") === "markdown";

	const stack: State[] = [{ skip: false, bold: false, italic: false }];
	const top = () => stack[stack.length - 1];
	let out = "";
	let openBold = false;
	let openItalic = false;
	let pendingSpace = "";

	const closeEmphasis = () => {
		if (!markdown) return;
		if (openItalic) out += "*";
		if (openBold) out += "**";
		openItalic = false;
		openBold = false;
	};

	const flushPending = () => {
		if (!pendingSpace) return;
		out += pendingSpace;
		pendingSpace = "";
	};

	const emit = (text: string) => {
		if (!text || top().skip) return;
		if (!markdown) {
			out += text;
			return;
		}
		// Whitespace inside a bold run must not split it in two, so hold it back until the
		// markers either stay open or close. Trailing spaces never end up inside markers.
		if (!text.trim()) {
			if (openBold || openItalic) pendingSpace += text;
			else out += text;
			return;
		}
		const wantBold = top().bold;
		const wantItalic = top().italic;
		if (wantBold !== openBold || wantItalic !== openItalic) {
			closeEmphasis();
			flushPending();
		} else {
			flushPending();
		}
		if (wantBold && !openBold) {
			out += "**";
			openBold = true;
		}
		if (wantItalic && !openItalic) {
			out += "*";
			openItalic = true;
		}
		out += text;
	};

	/** Closes any open run and lets the whitespace it was trailing settle after it. */
	const endRun = () => {
		closeEmphasis();
		flushPending();
	};

	let index = 0;
	while (index < source.length) {
		const character = source[index];

		if (character === "{") {
			stack.push({ ...top() });
			index += 1;
			continue;
		}

		if (character === "}") {
			if (stack.length > 1) stack.pop();
			index += 1;
			continue;
		}

		if (character === "\r" || character === "\n") {
			index += 1;
			continue;
		}

		if (character !== "\\") {
			emit(character);
			index += 1;
			continue;
		}

		const next = source[index + 1] ?? "";

		if (next === "*") {
			top().skip = true;
			index += 2;
			continue;
		}

		if (next === "'") {
			const byte = Number.parseInt(source.slice(index + 2, index + 4), 16);
			emit(Number.isFinite(byte) ? byteToChar(byte) : "");
			index += 4;
			continue;
		}

		if (next === "\\" || next === "{" || next === "}") {
			emit(next);
			index += 2;
			continue;
		}

		if (next === "~") {
			emit("\u00a0");
			index += 2;
			continue;
		}

		if (next === "_") {
			emit("-");
			index += 2;
			continue;
		}

		if (next === "-" || next === "|" || next === ":" || next === "\n" || next === "\r") {
			index += 2;
			continue;
		}

		if (!/[a-zA-Z]/u.test(next)) {
			index += 2;
			continue;
		}

		const word = /^([a-zA-Z]+)(-?\d+)?[ ]?/u.exec(source.slice(index + 1));
		if (!word) {
			index += 1;
			continue;
		}
		const name = word[1];
		const parameter = word[2] === undefined ? null : Number(word[2]);
		index += 1 + word[0].length;

		if (name === "u" && parameter !== null) {
			const code = parameter < 0 ? parameter + 65536 : parameter;
			emit(String.fromCodePoint(code));
			// The writer follows \u with a fallback character; skip one so it is not doubled.
			if (index < source.length && !/[\\{}]/u.test(source[index])) index += 1;
			continue;
		}

		switch (name) {
			case "par":
			case "line":
			case "sect":
			case "page":
			case "row":
				endRun();
				emit("\n");
				break;
			case "cell":
				emit("\t");
				break;
			case "tab":
				emit("\t");
				break;
			case "emdash":
				emit("—");
				break;
			case "endash":
				emit("–");
				break;
			case "emspace":
				emit("\u2003");
				break;
			case "enspace":
				emit("\u2002");
				break;
			case "lquote":
				emit("‘");
				break;
			case "rquote":
				emit("’");
				break;
			case "ldblquote":
				emit("“");
				break;
			case "rdblquote":
				emit("”");
				break;
			case "bullet":
				emit("•");
				break;
			case "b":
				endRun();
				top().bold = parameter !== 0;
				break;
			case "i":
				endRun();
				top().italic = parameter !== 0;
				break;
			case "plain":
			case "pard":
				endRun();
				top().bold = false;
				top().italic = false;
				break;
			default:
				if (SKIPPED.has(name)) {
					endRun();
					top().skip = true;
				}
				break;
		}
	}

	endRun();

	return out
		.replace(/\r\n?/gu, "\n")
		.replace(/[ \t]+\n/gu, "\n")
		.replace(/\n{3,}/gu, "\n\n")
		.replace(/[ \t]{2,}/gu, " ")
		.trim();
};

export const rtfParagraphCount = (text: string): number => text.split(/\n\s*\n/u).filter((block) => block.trim()).length;

export const rtfWordCount = (text: string): number => text.split(/\s+/u).filter(Boolean).length;
