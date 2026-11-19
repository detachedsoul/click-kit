import { describe, expect, it } from "vitest";
import { isRtf, rtfParagraphCount, rtfToText, rtfWordCount } from "@/features/converter-tools/rtf";

const rtf = (body: string) => `{\\rtf1\\ansi\\deff0 ${body}}`;

describe("spotting an rtf file", () => {
	it("accepts something that opens with {\\rtf", () => {
		expect(isRtf('{\\rtf1\\ansi Hello}')).toBe(true);
		expect(isRtf("  \n{\\rtf1}")).toBe(true);
	});

	it("rejects anything else", () => {
		expect(isRtf("Hello there")).toBe(false);
		expect(isRtf("{\\notrtf1}")).toBe(false);
	});

	it("complains in plain words", () => {
		expect(() => rtfToText("just words")).toThrow(/does not look like RTF/u);
	});
});

describe("text", () => {
	it("reads the words and breaks the paragraphs", () => {
		expect(rtfToText(rtf("First line.\\par Second line."))).toBe("First line.\nSecond line.");
	});

	it("unescapes braces, backslashes, and special characters", () => {
		// One space after a control word is its delimiter and is not part of the text, which is
		// why writers put two spaces when a real space is wanted.
		expect(rtfToText(rtf("A \\{brace\\} and a \\\\slash \\emdash  and \\ldblquote a quote\\rdblquote"))).toBe("A {brace} and a \\slash — and “a quote”");
	});

	it("turns hex escapes back into letters", () => {
		expect(rtfToText(rtf("caf\\'e9 \\'93quoted\\'94"))).toBe("café “quoted”");
	});

	it("reads unicode escapes and swallows the fallback character", () => {
		expect(rtfToText(rtf("\\u8364?100 and \\u8212? a dash"))).toBe("€100 and — a dash");
	});

	it("keeps tabs and table cells apart", () => {
		expect(rtfToText(rtf("one\\tab two\\cell three\\row four"))).toBe("one\ttwo\tthree\nfour");
	});

	it("skips the font table, colour table, and generator", () => {
		const source = rtf('{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Riched20;}Real words here.');
		expect(rtfToText(source)).toBe("Real words here.");
	});

	it("skips a picture without eating the text beside it", () => {
		const source = rtf("{\\pict\\pngblip 89504e470d0a1a0a}After the picture.");
		expect(rtfToText(source)).toBe("After the picture.");
	});

	it("collapses the blank lines that paragraph marks leave behind", () => {
		expect(rtfToText(rtf("One\\par\\par\\par Two"))).toBe("One\n\nTwo");
	});

	it("gives nothing back for an empty document", () => {
		expect(rtfToText("{\\rtf1\\ansi}")).toBe("");
	});
});

describe("markdown", () => {
	it("wraps bold and italic runs", () => {
		expect(rtfToText(rtf("Some {\\b bold} and {\\i soft} words."))).toBe("Some **bold** and *soft* words.");
	});

	it("closes bold before a paragraph break", () => {
		expect(rtfToText(rtf("{\\b Loud}\\par Quiet"))).toBe("**Loud**\nQuiet");
	});

	it("never wraps blank space in markers", () => {
		expect(rtfToText(rtf("{\\b Important }and plain"))).toBe("**Important** and plain");
	});

	it("leaves the markers out for plain text", () => {
		expect(rtfToText(rtf("Some {\\b bold} words."), { format: "text" })).toBe("Some bold words.");
	});

	it("resets emphasis at \\pard", () => {
		expect(rtfToText(rtf("{\\b bold}\\pard  plain"))).toBe("**bold** plain");
	});
});

describe("counting", () => {
	it("counts words and paragraphs", () => {
		expect(rtfWordCount("one two  three")).toBe(3);
		expect(rtfWordCount("")).toBe(0);
		expect(rtfParagraphCount("one\n\ntwo\n\n\n")).toBe(2);
	});
});
