export type EscapeMode = "json" | "javascript" | "sql" | "shell" | "regex" | "unicode";
export type EscapeDirection = "escape" | "unescape";

const regexSpecials = /[.*+?^${}()|[\]\\]/gu;

const toUnicode = (value: string) =>
	[...value]
		.map((character) => {
			const code = character.codePointAt(0)!;
			if (code < 128) return character;
			if (code > 0xffff) {
				const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
				const low = ((code - 0x10000) % 0x400) + 0xdc00;
				return `\\u${high.toString(16).padStart(4, "0")}\\u${low.toString(16).padStart(4, "0")}`;
			}
			return `\\u${code.toString(16).padStart(4, "0")}`;
		})
		.join("");

const fromUnicode = (value: string) => {
	if (/\\u\{[0-9a-fA-F]{1,6}\}/u.test(value)) throw new Error("\\u{…} escapes are not supported; use \\uXXXX pairs.");
	try {
		return value.replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
	} catch {
		throw new Error("Could not decode these Unicode escapes.");
	}
};

const escapeJavascript = (value: string) =>
	value
		.replaceAll("\\", "\\\\")
		.replaceAll("'", "\\'")
		.replaceAll("\n", "\\n")
		.replaceAll("\r", "\\r")
		.replaceAll("\t", "\\t")
		.replaceAll("\u2028", "\\u2028")
		.replaceAll("\u2029", "\\u2029");

const unescapeJavascript = (value: string) => {
	let output = "";
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character !== "\\") {
			output += character;
			continue;
		}
		const next = value[index + 1];
		if (next === undefined) throw new Error("The text ends with a dangling backslash.");
		const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0", "\\": "\\", "'": "'", '"': '"', "`": "`" };
		if (next in simple) {
			output += simple[next];
			index += 1;
			continue;
		}
		if (next === "u") {
			const hex = value.slice(index + 2, index + 6);
			if (!/^[0-9a-fA-F]{4}$/u.test(hex)) throw new Error("Invalid \\uXXXX escape.");
			output += String.fromCharCode(Number.parseInt(hex, 16));
			index += 5;
			continue;
		}
		if (next === "x") {
			const hex = value.slice(index + 2, index + 4);
			if (!/^[0-9a-fA-F]{2}$/u.test(hex)) throw new Error("Invalid \\xXX escape.");
			output += String.fromCharCode(Number.parseInt(hex, 16));
			index += 3;
			continue;
		}
		output += next;
		index += 1;
	}
	return output;
};

const escapeJson = (value: string) => JSON.stringify(value).slice(1, -1);

const unescapeJson = (value: string) => {
	try {
		return JSON.parse(`"${value}"`) as string;
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not decode JSON escapes: ${error.message}` : "Could not decode JSON escapes.");
	}
};

const escapeSql = (value: string) => value.replaceAll("'", "''");

const unescapeSql = (value: string) => value.replaceAll("''", "'");

const escapeShell = (value: string) => `'${value.replaceAll("'", `'\\''`)}'`;

const unescapeShell = (value: string) => {
	const trimmed = value.trim();
	if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
		return trimmed.slice(1, -1).replaceAll(`'\\''`, "'");
	}
	return trimmed.replace(/\\(.)/gu, "$1");
};

const escapeRegex = (value: string) => value.replace(regexSpecials, "\\$&");

const unescapeRegex = (value: string) => value.replace(/\\(.)/gu, "$1");

export const transformEscapes = (value: string, mode: EscapeMode, direction: EscapeDirection) => {
	if (!value) throw new Error("Paste text to transform first.");
	switch (mode) {
		case "json":
			return direction === "escape" ? escapeJson(value) : unescapeJson(value);
		case "javascript":
			return direction === "escape" ? escapeJavascript(value) : unescapeJavascript(value);
		case "sql":
			return direction === "escape" ? escapeSql(value) : unescapeSql(value);
		case "shell":
			return direction === "escape" ? escapeShell(value) : unescapeShell(value);
		case "regex":
			return direction === "escape" ? escapeRegex(value) : unescapeRegex(value);
		case "unicode":
			return direction === "escape" ? toUnicode(value) : fromUnicode(value);
	}
};

export const escapeExamples: Record<EscapeMode, string> = {
	json: 'Line one\nLine "two" with a \\ backslash',
	javascript: "It's a\nnew line",
	sql: "O'Hara said 'hello'",
	shell: "echo 'quoted' && say 'hi'",
	regex: "https://example.com/a+b?c=1",
	unicode: "Café — 東京 🚀",
};
