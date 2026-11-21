import { describe, expect, it } from "vitest";
import {
	attemptWhen,
	averageAccuracy,
	averageWpm,
	bestWpm,
	clock,
	compareTyped,
	customTarget,
	DURATIONS,
	extrasOf,
	HISTORY_KEY,
	MAX_ATTEMPTS,
	MIN_CUSTOM_LENGTH,
	PASSAGES,
	passageFor,
	recordAttempt,
	reviveHistory,
	statsFor,
	targetLengthFor,
	type Attempt,
} from "@/features/productivity-tools/typing-utils";

const attempt = (wpm: number, accuracy = 100): Attempt => ({ at: 1, accuracy, correct: 100, cpm: 200, duration: 30, incorrect: 0, level: "medium", wpm });

describe("typing arithmetic", () => {
	it("counts five characters to a word", () => {
		// 300 correct characters in a minute is 60 wpm.
		expect(statsFor("a".repeat(300), "a".repeat(300), 60).wpm).toBe(60);
		// The same work in half the time doubles the rate.
		expect(statsFor("a".repeat(300), "a".repeat(300), 30).wpm).toBe(120);
	});

	it("counts characters per minute on every keystroke, right or wrong", () => {
		const stats = statsFor("abcd", "abxd", 60);
		expect(stats.typed).toBe(4);
		expect(stats.correct).toBe(3);
		expect(stats.incorrect).toBe(1);
		expect(stats.cpm).toBe(4);
	});

	it("takes only the correct characters into the words per minute", () => {
		// 4 of 5 right: 4 characters is 0.8 words in a minute.
		const stats = statsFor("abcde", "abcdx", 60);
		expect(stats.wpm).toBe(1);
		expect(stats.accuracy).toBe(80);
	});

	it("is a hundred percent accurate before anything is typed", () => {
		const stats = statsFor("hello", "", 10);
		expect(stats.accuracy).toBe(100);
		expect(stats.wpm).toBe(0);
		expect(stats.cpm).toBe(0);
	});

	it("counts characters typed past the end as mistakes", () => {
		const stats = statsFor("ab", "abcd", 60);
		expect(stats.correct).toBe(2);
		expect(stats.incorrect).toBe(2);
		expect(stats.accuracy).toBe(50);
		expect(extrasOf("ab", "abcd")).toBe("cd");
		expect(extrasOf("abcd", "ab")).toBe("");
	});

	it("rounds accuracy to one decimal", () => {
		expect(statsFor("abc", "abx", 60).accuracy).toBe(66.7);
	});

	it("marks each character of the passage once", () => {
		expect(compareTyped("abc", "ax")).toEqual(["correct", "incorrect", "pending"]);
		expect(compareTyped("abc", "")).toEqual(["pending", "pending", "pending"]);
		expect(compareTyped("a b", "a b")).toEqual(["correct", "correct", "correct"]);
	});
});

describe("passages", () => {
	it("gives a passage long enough for the test and ends on a word", () => {
		const text = passageFor("easy", 400, () => 0.5);
		expect(text.length).toBeGreaterThanOrEqual(400);
		expect(text.endsWith(" ")).toBe(false);
		// A whole word: trimming happens at a space, so the last word is complete.
		expect(PASSAGES.easy.some((passage) => passage.includes(text.split(" ").at(-1) ?? ""))).toBe(true);
	});

	it("keeps every passage to what its level promises", () => {
		for (const passage of PASSAGES.easy) expect(passage).toMatch(/^[a-z ,.]+$/u);
		for (const passage of PASSAGES.hard) expect(passage).toMatch(/[0-9]/u);
		expect(PASSAGES.medium.length).toBeGreaterThan(2);
	});

	it("never repeats the same passage when the dice move", () => {
		const picks = new Set([0, 0.3, 0.6, 0.9].map((value) => passageFor("medium", 200, () => value)));
		expect(picks.size).toBeGreaterThan(1);
	});

	it("fills the longest test without saying the same thing twice", () => {
		for (const level of ["easy", "medium", "hard"] as const) {
			const text = passageFor(level, targetLengthFor(120), () => 0.13);
			const repeated = PASSAGES[level].filter((passage) => text.split(passage).length - 1 > 1);
			expect(repeated).toEqual([]);
		}
	});

	it("keeps a page of sentences for each level, more than the longest test needs", () => {
		for (const level of ["easy", "medium", "hard"] as const) {
			expect(PASSAGES[level].length).toBeGreaterThanOrEqual(15);
			expect(PASSAGES[level].join(" ").length).toBeGreaterThan(targetLengthFor(120));
		}
	});

	it("asks for more text on a longer test", () => {
		expect(targetLengthFor(120)).toBeGreaterThan(targetLengthFor(15));
		// Half a minute is a paragraph, not a line.
		expect(targetLengthFor(30)).toBeGreaterThanOrEqual(600);
		expect(DURATIONS).toEqual([15, 30, 60, 120]);
	});

	it("repeats custom text until it can fill the test", () => {
		const target = customTarget("pack my box", 60);
		expect(target.length).toBeGreaterThanOrEqual(60);
		expect(target.startsWith("pack my box pack")).toBe(true);
		expect(customTarget("   ", 60)).toBe("");
	});

	it("keeps the shortest useful custom text", () => {
		expect(MIN_CUSTOM_LENGTH).toBeGreaterThan(0);
	});
});

describe("the clock", () => {
	it("reads like a stopwatch", () => {
		expect(clock(15)).toBe("0:15");
		expect(clock(60)).toBe("1:00");
		expect(clock(120)).toBe("2:00");
		expect(clock(0.4)).toBe("0:01");
		expect(clock(-2)).toBe("0:00");
	});
});

describe("history", () => {
	it("keeps the newest attempt first and stops at the shelf", () => {
		const many = Array.from({ length: MAX_ATTEMPTS + 5 }, (_value, index) => attempt(index));
		const capped = many.slice(0, MAX_ATTEMPTS);
		expect(recordAttempt(capped, attempt(999))[0].wpm).toBe(999);
		expect(recordAttempt(capped, attempt(999))).toHaveLength(MAX_ATTEMPTS);
	});

	it("drops anything it cannot read", () => {
		expect(reviveHistory(null)).toEqual([]);
		expect(reviveHistory("nonsense")).toEqual([]);
		expect(reviveHistory([{ nope: true }, attempt(40)])).toHaveLength(1);
		expect(reviveHistory(Array.from({ length: 40 }, () => attempt(30)))).toHaveLength(MAX_ATTEMPTS);
	});

	it("sums up best, average, and accuracy", () => {
		expect(bestWpm([])).toBe(0);
		expect(averageWpm([])).toBe(0);
		expect(averageAccuracy([])).toBe(0);
		const history = [attempt(40, 90), attempt(60, 100), attempt(50, 95)];
		expect(bestWpm(history)).toBe(60);
		expect(averageWpm(history)).toBe(50);
		expect(averageAccuracy(history)).toBe(95);
	});

	it("names the day of an attempt", () => {
		expect(attemptWhen(new Date(2026, 10, 20, 9, 5).getTime())).toContain("20");
		expect(attemptWhen(new Date(2026, 10, 20, 9, 5).getTime())).toContain("09:05");
	});

	it("has a key of its own", () => {
		expect(HISTORY_KEY).toContain("typing");
	});
});
