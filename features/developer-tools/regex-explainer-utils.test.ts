import { describe, expect, it } from "vitest";
import { explainRegexFlags, findCommonRegexIssues, parseRegex } from "@/features/developer-tools/regex-explainer-utils";

describe("regex explainer parser", () => {
	it("tokenizes common syntax and explains repetition", () => {
		const parsed = parseRegex("^\\w{2,4}\\.$");
		expect(parsed.tokens.map((token) => token.raw)).toEqual(["^", "\\w", "{2,4}", "\\.", "$"]);
		expect(parsed.tokens.find((token) => token.raw === "{2,4}")?.explanation).toContain("2 to 4 times");
		expect(parsed.tree.label).toBe("Sequence");
	});

	it("describes alternation, capturing groups, and named group highlighting", () => {
		const parsed = parseRegex("(?<who>cat|dog)(?:s)?");
		expect(parsed.groups).toEqual([{ number: 1, label: "Named capture group “who”", raw: "(?<who>" }]);
		expect(parsed.tokens.some((token) => token.raw === "|" && token.explanation.includes("either"))).toBe(true);
		expect(parsed.tokens.filter((token) => token.groupNumber === 1).map((token) => token.raw)).toEqual(["(?<who>", "c", "a", "t", "|", "d", "o", "g", ")"]);
		expect(parsed.tree.kind).toBe("sequence");
	});

	it("understands lookaheads, classes, anchors, and lazy quantifiers", () => {
		const parsed = parseRegex("(?=https?)\\w+?[.!]$");
		expect(parsed.tokens.find((token) => token.raw === "(?=")?.explanation).toContain("Positive lookahead");
		expect(parsed.tokens.find((token) => token.raw === "+?")?.explanation).toContain("lazy matching");
		expect(parsed.tokens.find((token) => token.raw === "[.!]")?.kind).toBe("character-class");
	});

	it("reports malformed group, class, escape, and repetition syntax", () => {
		for (const pattern of ["(abc", "[abc", "\\", "*abc", "{2}a"]) {
			expect(() => parseRegex(pattern), pattern).toThrow();
		}
		expect(() => parseRegex("x".repeat(501))).toThrow(/500 characters/u);
	});

	it("highlights likely mistakes and explains selected flags", () => {
		const warnings = findCommonRegexIssues("^.*(cat|dog)$");
		expect(warnings.join(" ")).toContain("greedy");
		expect(warnings.join(" ")).toContain("capture");
		expect(findCommonRegexIssues("")).toContain("Enter a pattern to see its tokens and expression tree.");
		expect(explainRegexFlags(["i", "m", "u"])).toEqual(expect.arrayContaining([expect.stringContaining("uppercase"), expect.stringContaining("each line"), expect.stringContaining("Unicode")]));
	});
});
