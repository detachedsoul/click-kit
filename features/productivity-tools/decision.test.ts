import { describe, expect, it } from "vitest";
import {
	isTie,
	rankOptions,
	scoreOption,
	summaryText,
	validateMatrix,
	verdict,
	winnerName,
	type Criterion,
	type MatrixOption,
	type Scores,
} from "@/features/productivity-tools/decision-utils";

const criteria: Criterion[] = [
	{ id: "c1", name: "Price", weight: 3 },
	{ id: "c2", name: "Battery", weight: 1 },
];
const options: MatrixOption[] = [
	{ id: "o1", name: "Laptop" },
	{ id: "o2", name: "Desktop" },
];
const scores: Scores = {
	o1: { c1: 5, c2: 3 },
	o2: { c1: 2, c2: 5 },
};

describe("decision matrix", () => {
	it("weights each criterion by its importance", () => {
		// Laptop: (5*3 + 3*1) / (4*5) = 90%; Desktop: (2*3 + 5*1) / 20 = 55%
		expect(scoreOption("o1", criteria, scores)).toBe(90);
		expect(scoreOption("o2", criteria, scores)).toBe(55);
		expect(scoreOption("missing", criteria, scores)).toBe(0);
	});

	it("ranks options and keeps the weighted points", () => {
		const ranked = rankOptions(criteria, options, scores);
		expect(ranked.map((entry) => entry.option.name)).toEqual(["Laptop", "Desktop"]);
		expect(ranked[0].points).toBe(18);
		expect(ranked[0].possible).toBe(20);
		expect(ranked.map((entry) => entry.score)).toEqual([90, 55]);
	});

	it("spots a tie and refuses to invent a winner", () => {
		const evenCriteria: Criterion[] = [
			{ id: "c1", name: "Price", weight: 2 },
			{ id: "c2", name: "Battery", weight: 2 },
		];
		const even: Scores = { o1: { c1: 4, c2: 2 }, o2: { c1: 2, c2: 4 } };
		const ranked = rankOptions(evenCriteria, options, even);
		expect(isTie(ranked)).toBe(true);
		expect(verdict(ranked)).toMatch(/level/u);
		expect(isTie(rankOptions(criteria, [options[0]], scores))).toBe(false);
	});

	it("writes a copyable summary", () => {
		expect(summaryText(rankOptions(criteria, options, scores))).toBe("1. Laptop — 90% (18 of 20 weighted points)\n2. Desktop — 55% (11 of 20 weighted points)");
		expect(winnerName(rankOptions(criteria, options, scores))).toBe("Laptop");
		expect(winnerName(rankOptions(criteria, options, {}))).toBe("");
		expect(verdict(rankOptions(criteria, options, scores))).toBe("Laptop comes out ahead at 90%.");
		expect(verdict([])).toMatch(/Add an option/u);
		expect(verdict(rankOptions(criteria, options, {}))).toMatch(/Score each option/u);
	});

	it("explains what is missing before scoring", () => {
		expect(validateMatrix(criteria, [options[0]])).toMatch(/two options/u);
		expect(validateMatrix([], options)).toMatch(/criterion/u);
		expect(validateMatrix([{ id: "c1", name: "Price", weight: 0 }], options)).toMatch(/weight above zero/u);
		expect(validateMatrix(criteria, options)).toBe("");
	});
});
