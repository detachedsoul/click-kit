export type InvisibleCategory = "zero-width" | "space" | "bidi" | "control";

type InvisibleDefinition = {
	code: number;
	label: string;
	category: InvisibleCategory;
	replaceWith: string;
};

export const invisibleCharacters: InvisibleDefinition[] = [
	{ code: 0x00a0, label: "No-break space", category: "space", replaceWith: " " },
	{ code: 0x1680, label: "Ogham space mark", category: "space", replaceWith: " " },
	{ code: 0x2000, label: "En quad", category: "space", replaceWith: " " },
	{ code: 0x2001, label: "Em quad", category: "space", replaceWith: " " },
	{ code: 0x2002, label: "En space", category: "space", replaceWith: " " },
	{ code: 0x2003, label: "Em space", category: "space", replaceWith: " " },
	{ code: 0x2004, label: "Three-per-em space", category: "space", replaceWith: " " },
	{ code: 0x2005, label: "Four-per-em space", category: "space", replaceWith: " " },
	{ code: 0x2006, label: "Six-per-em space", category: "space", replaceWith: " " },
	{ code: 0x2007, label: "Figure space", category: "space", replaceWith: " " },
	{ code: 0x2008, label: "Punctuation space", category: "space", replaceWith: " " },
	{ code: 0x2009, label: "Thin space", category: "space", replaceWith: " " },
	{ code: 0x200a, label: "Hair space", category: "space", replaceWith: " " },
	{ code: 0x202f, label: "Narrow no-break space", category: "space", replaceWith: " " },
	{ code: 0x205f, label: "Medium mathematical space", category: "space", replaceWith: " " },
	{ code: 0x3000, label: "Ideographic space", category: "space", replaceWith: " " },
	{ code: 0x200b, label: "Zero-width space", category: "zero-width", replaceWith: "" },
	{ code: 0x200c, label: "Zero-width non-joiner", category: "zero-width", replaceWith: "" },
	{ code: 0x200d, label: "Zero-width joiner", category: "zero-width", replaceWith: "" },
	{ code: 0x2060, label: "Word joiner", category: "zero-width", replaceWith: "" },
	{ code: 0xfeff, label: "Byte-order mark / zero-width no-break space", category: "zero-width", replaceWith: "" },
	{ code: 0x180e, label: "Mongolian vowel separator", category: "zero-width", replaceWith: "" },
	{ code: 0x00ad, label: "Soft hyphen", category: "zero-width", replaceWith: "" },
	{ code: 0x200e, label: "Left-to-right mark", category: "bidi", replaceWith: "" },
	{ code: 0x200f, label: "Right-to-left mark", category: "bidi", replaceWith: "" },
	{ code: 0x202a, label: "Left-to-right embedding", category: "bidi", replaceWith: "" },
	{ code: 0x202b, label: "Right-to-left embedding", category: "bidi", replaceWith: "" },
	{ code: 0x202c, label: "Pop directional formatting", category: "bidi", replaceWith: "" },
	{ code: 0x202d, label: "Left-to-right override", category: "bidi", replaceWith: "" },
	{ code: 0x202e, label: "Right-to-left override", category: "bidi", replaceWith: "" },
	{ code: 0x2066, label: "Left-to-right isolate", category: "bidi", replaceWith: "" },
	{ code: 0x2067, label: "Right-to-left isolate", category: "bidi", replaceWith: "" },
	{ code: 0x2068, label: "First-strong isolate", category: "bidi", replaceWith: "" },
	{ code: 0x2069, label: "Pop directional isolate", category: "bidi", replaceWith: "" },
	{ code: 0x0000, label: "Null control", category: "control", replaceWith: "" },
	{ code: 0x0008, label: "Backspace", category: "control", replaceWith: "" },
	{ code: 0x000b, label: "Vertical tab", category: "control", replaceWith: " " },
	{ code: 0x000c, label: "Form feed", category: "control", replaceWith: "\n" },
	{ code: 0x001b, label: "Escape", category: "control", replaceWith: "" },
	{ code: 0x007f, label: "Delete", category: "control", replaceWith: "" },
	{ code: 0x2028, label: "Line separator", category: "control", replaceWith: "\n" },
	{ code: 0x2029, label: "Paragraph separator", category: "control", replaceWith: "\n\n" },
];

const byCode = new Map(invisibleCharacters.map((character) => [character.code, character]));

export const hexCode = (code: number) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

export const describeCode = (code: number) => byCode.get(code)?.label ?? "Unknown character";

export type InvisibleFinding = {
	index: number;
	line: number;
	column: number;
	code: number;
	label: string;
	category: InvisibleCategory;
};

export type InvisibleCount = {
	code: number;
	label: string;
	category: InvisibleCategory;
	count: number;
};

export const scanInvisible = (text: string) => {
	const findings: InvisibleFinding[] = [];
	const counts = new Map<number, number>();
	let line = 1;
	let column = 1;
	let index = 0;
	for (const character of text) {
		const code = character.codePointAt(0) ?? 0;
		const definition = byCode.get(code);
		if (definition) {
			findings.push({ index, line, column, code, label: definition.label, category: definition.category });
			counts.set(code, (counts.get(code) ?? 0) + 1);
		}
		if (character === "\n") {
			line += 1;
			column = 1;
		} else {
			column += 1;
		}
		index += character.length;
	}
	const totals: InvisibleCount[] = [...counts.entries()]
		.map(([code, count]) => ({ code, count, label: describeCode(code), category: byCode.get(code)!.category }))
		.sort((left, right) => right.count - left.count || left.code - right.code);
	return {
		findings,
		totals,
		total: findings.length,
		lines: text ? text.split("\n").length : 0,
		characters: [...text].length,
		visible: [...text].filter((character) => !byCode.has(character.codePointAt(0) ?? 0)).length,
	};
};

export type CleanInvisibleOptions = {
	spacesToSpaces: boolean;
};

export const cleanInvisible = (text: string, options: CleanInvisibleOptions = { spacesToSpaces: true }) => {
	let output = "";
	for (const character of text) {
		const code = character.codePointAt(0) ?? 0;
		if (code === 0x000a || code === 0x0009) {
			output += character;
			continue;
		}
		const definition = byCode.get(code);
		if (!definition) {
			output += character;
			continue;
		}
		if (definition.category === "space") output += options.spacesToSpaces ? " " : "";
		else output += definition.replaceWith;
	}
	return options.spacesToSpaces ? output.replace(/ {2,}/gu, " ").replace(/[ \t]+$/gmu, "") : output;
};
