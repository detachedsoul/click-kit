import { describe, expect, it } from "vitest";
import {
	cleanText,
	convertCase,
	countText,
	DEFAULT_CLEAN_TEXT_OPTIONS,
	diffText,
	TextDiffLimitError,
} from "@/features/text-tools/text-utils";

describe("countText", () => {
	it("returns zeroed statistics for empty and whitespace-only content", () => {
		expect(countText("")).toEqual({ words: 0, charactersWithSpaces: 0, charactersWithoutSpaces: 0, readingMinutes: 0 });
		expect(countText(" \n\t ")).toEqual({ words: 0, charactersWithSpaces: 4, charactersWithoutSpaces: 0, readingMinutes: 0 });
	});

	it("counts natural-language words, whitespace, and reading time", () => {
		expect(countText("One small step, isn't it?\n" )).toMatchObject({
			words: 5,
			charactersWithoutSpaces: 21,
			readingMinutes: 1,
		});
		expect(countText("word ".repeat(200)).readingMinutes).toBe(1);
		expect(countText("word ".repeat(201)).readingMinutes).toBe(2);
	});

	it("counts grapheme clusters rather than UTF-16 code units", () => {
		const statistics = countText("café 👩‍💻");
		expect(statistics.words).toBe(1);
		expect(statistics.charactersWithSpaces).toBe(6);
		expect(statistics.charactersWithoutSpaces).toBe(5);
	});
});

describe("convertCase", () => {
	it("converts regular case styles while preserving the original separators", () => {
		const text = "hELLO, wORLD!";
		expect(convertCase(text, "uppercase")).toBe("HELLO, WORLD!");
		expect(convertCase(text, "lowercase")).toBe("hello, world!");
		expect(convertCase(text, "title")).toBe("Hello, World!");
	});

	it("capitalizes the first letter of each sentence, including after closing punctuation", () => {
		expect(convertCase('hELLO.  "hoW are YOU? yes!', "sentence")).toBe('Hello.  "How are you? Yes!');
	});

	it("splits existing camel case and punctuation for code-friendly cases", () => {
		expect(convertCase("helloWorld and good-day", "camel")).toBe("helloWorldAndGoodDay");
		expect(convertCase("helloWorld and good-day", "kebab")).toBe("hello-world-and-good-day");
		expect(convertCase("helloWorld and good-day", "snake")).toBe("hello_world_and_good_day");
	});

	it("handles empty input", () => {
		expect(convertCase("", "camel")).toBe("");
	});
});

describe("cleanText", () => {
	it("trims line edges, collapses horizontal whitespace, and normalizes line endings", () => {
		expect(cleanText("  apples   and\tpears \r\n\t \nlast ")).toBe("apples and pears\n\nlast");
	});

	it("removes blank lines only when the user asks", () => {
		const options = { ...DEFAULT_CLEAN_TEXT_OPTIONS, removeBlankLines: true };
		expect(cleanText("first\n \n\nsecond", options)).toBe("first\nsecond");
	});

	it("allows spaces and blank lines to be preserved", () => {
		expect(cleanText("  keep   this  ", {
			trimLineWhitespace: false,
			collapseHorizontalWhitespace: false,
			removeBlankLines: false,
		})).toBe("  keep   this  ");
	});
});

describe("diffText", () => {
	it("marks insertions and removals while retaining unchanged text", () => {
		const result = diffText("I like cats.", "I really like dogs.");
		expect(result.added).toBe(2);
		expect(result.removed).toBe(1);
		expect(result.segments.filter((segment) => segment.kind === "added").map((segment) => segment.text).join("")).toContain("really ");
		expect(result.segments.filter((segment) => segment.kind === "removed").map((segment) => segment.text).join("")).toContain("cats.");
		expect(result.segments.filter((segment) => segment.kind === "same").map((segment) => segment.text).join("")).toContain("I like ");
	});

	it("treats identical and empty input as valid comparisons", () => {
		expect(diffText("", "")).toEqual({ segments: [], added: 0, removed: 0 });
		expect(diffText("same text", "same text")).toMatchObject({ added: 0, removed: 0 });
		expect(diffText("", "new words").added).toBe(2);
	});

	it("reconstructs both passages exactly around repeated words and reordered phrases", () => {
		const passagePairs = [
			["red blue red green", "red green red blue"],
			["first\nsecond\nthird", "first\nnew\nthird"],
			["punctuation, stays!", "punctuation stays?"],
		];

		for (const [original, revised] of passagePairs) {
			const { segments } = diffText(original, revised);
			const reconstructedOriginal = segments.filter((segment) => segment.kind !== "added").map((segment) => segment.text).join("");
			const reconstructedRevised = segments.filter((segment) => segment.kind !== "removed").map((segment) => segment.text).join("");
			expect(reconstructedOriginal).toBe(original);
			expect(reconstructedRevised).toBe(revised);
		}
	});

	it("rejects pathological input sizes with a clear error instead of attempting a huge comparison", () => {
		expect(() => diffText("x".repeat(20_001), "x")).toThrow(TextDiffLimitError);
		expect(() => diffText(Array.from({ length: 1_501 }, () => "a").join(" "), "")).toThrow(TextDiffLimitError);
	});
});
