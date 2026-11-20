import { describe, expect, it } from "vitest";
import { comparisonToMarkdown, comparePages, describeComparison, diffLines, summarise } from "@/features/pdf-tools/pdf-diff";

describe("line differences", () => {
	it("says nothing changed when nothing changed", () => {
		expect(diffLines(["a", "b"], ["a", "b"])).toEqual([
			{ kind: "same", text: "a" },
			{ kind: "same", text: "b" },
		]);
	});

	it("marks a rewritten line as one out and one in", () => {
		expect(diffLines(["a", "b", "c"], ["a", "B", "c"])).toEqual([
			{ kind: "same", text: "a" },
			{ kind: "removed", text: "b" },
			{ kind: "added", text: "B" },
			{ kind: "same", text: "c" },
		]);
	});

	it("copes with lines only on one side", () => {
		expect(diffLines([], ["new"])).toEqual([{ kind: "added", text: "new" }]);
		expect(diffLines(["old"], [])).toEqual([{ kind: "removed", text: "old" }]);
		expect(diffLines(["a", "b", "c"], ["a", "c"])).toEqual([
			{ kind: "same", text: "a" },
			{ kind: "removed", text: "b" },
			{ kind: "same", text: "c" },
		]);
	});

	it("keeps a repeated line once", () => {
		const diff = diffLines(["Total", "Total"], ["Total"]);
		expect(diff.filter((line) => line.kind === "same")).toHaveLength(1);
		expect(diff.filter((line) => line.kind === "removed")).toHaveLength(1);
	});

	it("still gives an answer when the pages are enormous", () => {
		const before = Array.from({ length: 900 }, (_, index) => `line ${index}`);
		const after = [...before];
		after[450] = "changed";
		const diff = diffLines(before, after);
		expect(diff.some((line) => line.kind === "removed" && line.text === "line 450")).toBe(true);
		expect(diff.some((line) => line.kind === "added" && line.text === "changed")).toBe(true);
	});
});

describe("page comparison", () => {
	it("lines pages up by number", () => {
		const changes = comparePages([["a"], ["b"]], [["a"], ["c"]]);
		expect(changes.map((change) => change.status)).toEqual(["same", "changed"]);
	});

	it("notices pages that exist on only one side", () => {
		const changes = comparePages([["a"], ["b"], ["c"]], [["a"]]);
		expect(changes.map((change) => change.status)).toEqual(["same", "removed", "removed"]);
		expect(comparePages([["a"]], [["a"], ["b"]])[1].status).toBe("added");
	});

	it("adds it up", () => {
		const summary = summarise(comparePages([["a"], ["b"], ["c"]], [["a"], ["B"], ["c"], ["d"]]));
		expect(summary).toEqual({ same: 2, changed: 1, added: 1, removed: 0, total: 4 });
	});
});

describe("the words around it", () => {
	it("says so when nothing moved", () => {
		expect(describeComparison({ same: 3, changed: 0, added: 0, removed: 0, total: 3 })).toContain("No differences");
		expect(describeComparison({ same: 0, changed: 0, added: 0, removed: 0, total: 0 })).toContain("empty");
	});

	it("counts out loud", () => {
		expect(describeComparison({ same: 1, changed: 2, added: 1, removed: 0, total: 4 })).toBe("2 pages changed, 1 added — 1 of 4 pages unchanged.");
	});

	it("writes the report out", () => {
		const markdown = comparisonToMarkdown(comparePages([["a", "b"]], [["a", "c"]]), "old.pdf", "new.pdf");
		expect(markdown).toContain("# Comparing old.pdf with new.pdf");
		expect(markdown).toContain("## Page 1 (changed)");
		expect(markdown).toContain("- b");
		expect(markdown).toContain("+ c");
		expect(comparisonToMarkdown(comparePages([["a"]], [["a"]]), "x", "y")).not.toContain("## Page");
	});
});
