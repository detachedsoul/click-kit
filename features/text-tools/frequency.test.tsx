import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { frequencyToCsv, tokenize, wordFrequency } from "@/features/text-tools/frequency-utils";
import { FrequencyTool } from "@/features/text-tools/frequency-tool";

afterEach(cleanup);

describe("word and phrase frequency", () => {
	it("tokenizes words, numbers, and contractions", () => {
		expect(tokenize("Don't stop — 42 times, ok?", true)).toEqual(["don't", "stop", "42", "times", "ok"]);
	});

	it("counts words with share percentages", () => {
		const report = wordFrequency("Brave new world. Brave new ideas. Brave world.");
		expect(report.words).toBe(8);
		expect(report.rows[0]).toEqual({ phrase: "brave", count: 3, share: 37.5 });
		expect(report.rows.find((row) => row.phrase === "world")).toEqual({ phrase: "world", count: 2, share: 25 });
		expect(report.total).toBe(8);
		expect(report.unique).toBe(4);
	});

	it("supports bigrams, stop-word removal, and minimum length", () => {
		const bigrams = wordFrequency("the quick brown fox jumps over the lazy dog", { ngram: 2 });
		expect(bigrams.rows[0].phrase.split(" ")).toHaveLength(2);
		const withoutStop = wordFrequency("the the the quick quick fox", { removeStopWords: true });
		expect(withoutStop.rows[0]).toEqual({ phrase: "quick", count: 2, share: 66.7 });
		const longWords = wordFrequency("a bb ccc dddd", { minimumLength: 3 });
		expect(longWords.rows.map((row) => row.phrase)).toEqual(["ccc", "dddd"]);
	});

	it("respects case sensitivity and limits", () => {
		expect(wordFrequency("Skip skip SKIP", { ignoreCase: true }).rows[0].count).toBe(3);
		expect(wordFrequency("Skip skip SKIP", { ignoreCase: false }).rows.map((row) => row.phrase).sort()).toEqual(["SKIP", "Skip", "skip"]);
		expect(wordFrequency("a b c d e f g h", { limit: 3 }).rows).toHaveLength(3);
	});

	it("validates input and options", () => {
		expect(() => wordFrequency("   ")).toThrow(/Paste some text/u);
		expect(() => wordFrequency("!!! ???")).toThrow(/No words found/u);
		expect(() => wordFrequency("the and of", { removeStopWords: true })).toThrow(/filtered out/u);
		expect(() => wordFrequency("word", { limit: 0 })).toThrow(/between 1 and 500/u);
	});

	it("exports CSV", () => {
		expect(frequencyToCsv([{ phrase: "say \"hi\"", count: 2, share: 50 }])).toBe('phrase,count,share\n"say ""hi""",2,50');
	});

	it("renders the ranked list", () => {
		render(<FrequencyTool />);
		expect(screen.getAllByText("paragraph").length).toBeGreaterThan(0);
		fireEvent.click(screen.getByLabelText("Remove stop words"));
		expect(screen.getByLabelText("Result")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Phrase length"), { target: { value: "2" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain(" ");
		fireEvent.change(screen.getByLabelText("Your text"), { target: { value: "   " } });
		expect(screen.getByRole("alert").textContent).toContain("Paste some text");
	});
});
