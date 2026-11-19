import { describe, expect, it } from "vitest";
import { CHUNK_PRESETS, chunkSummary, chunkText, numberedChunks } from "@/features/text-tools/chunk-utils";

describe("text chunker", () => {
	it("fills chunks with whole words and never exceeds the limit", () => {
		const chunks = chunkText("one two three four five six seven", 13, "word");
		expect(chunks).toEqual(["one two three", "four five six", "seven"]);
		expect(chunks.every((chunk) => chunk.length <= 13)).toBe(true);
	});

	it("keeps paragraphs together when they fit", () => {
		const text = "First para here.\n\nSecond para here.\n\nThird.";
		expect(chunkText(text, 35, "paragraph")).toEqual(["First para here.\n\nSecond para here.", "Third."]);
		expect(chunkText(text, 24, "paragraph")).toHaveLength(3);
	});

	it("splits on sentence boundaries", () => {
		const chunks = chunkText("One thing. Two things! Three things? Four.", 24, "sentence");
		expect(chunks).toEqual(["One thing. Two things!", "Three things? Four."]);
	});

	it("hard-splits an atom longer than the limit", () => {
		expect(chunkText("abcdefghij", 4, "character")).toEqual(["abcd", "efgh", "ij"]);
		expect(chunkText("supercalifragilistic", 6, "word")).toEqual(["superc", "alifra", "gilist", "ic"]);
	});

	it("reports stats and numbered pieces", () => {
		const chunks = chunkText("alpha beta gamma delta", 12, "word");
		expect(chunks).toEqual(["alpha beta", "gamma delta"]);
		expect(chunkSummary(chunks)).toEqual({ count: 2, longest: 11, shortest: 10, total: 21 });
		expect(numberedChunks(chunks).split("\n\n")[0]).toBe("1/2\nalpha beta");
		expect(numberedChunks(["x"], 3)).toContain("3/1");
	});

	it("handles empty input, CRLF, and guard rails", () => {
		expect(chunkText("   ", 10)).toEqual([]);
		expect(chunkText("a\r\n\r\nb", 3, "paragraph")).toEqual(["a", "b"]);
		expect(chunkText("a\r\n\r\nb", 10, "paragraph")).toEqual(["a\n\nb"]);
		expect(() => chunkText("abc", 0)).toThrow(/whole number/u);
		expect(CHUNK_PRESETS.every((preset) => preset.limit > 0)).toBe(true);
	});
});
