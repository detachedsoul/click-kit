import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards two layout rules that keep breaking when new tools are added:
 * 1. a checkbox never sits directly in a field grid (it has no caption, so it
 *    drifts out of line with the labelled inputs beside it);
 * 2. every <select> uses the shared `select-input` class, which is the only
 *    thing keeping the caret inset equal to the text inset.
 */

const ROOT = join(process.cwd(), "features");
const CSS = join(process.cwd(), "app", "globals.css");
const TOOL_UI = join(process.cwd(), "features", "developer-tools", "tool-ui.tsx");

const sourceFiles = (): string[] => {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) {
				if (entry === "node_modules" || entry.startsWith(".")) continue;
				walk(path);
			} else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
				out.push(path);
			}
		}
	};
	walk(ROOT);
	return out;
};

const indentOf = (line: string) => line.length - line.trimStart().length;

type Violation = string;

/** Checkboxes nested straight inside a grid that also holds labelled fields. */
const checkboxGridViolations = (file: string, lines: string[]): Violation[] => {
	const violations: Violation[] = [];
	lines.forEach((line, index) => {
		if (!line.trimStart().startsWith("<CheckboxField")) return;
		const depth = indentOf(line);
		// Collect the whole tag so an alignment override on a later line still counts.
		let tag = line;
		for (let cursor = index; !tag.includes("/>") && cursor < lines.length - 1; ) {
			cursor += 1;
			tag += `\n${lines[cursor]}`;
		}
		// A checkbox is fine when it aligns itself against the row it shares.
		if (tag.includes("self-center") || tag.includes("self-end")) return;
		// The nearest shallower JSX opener is the element this checkbox is a child of.
		let ancestorIndex = -1;
		for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
			const trimmed = lines[cursor].trimStart();
			if (!trimmed || indentOf(lines[cursor]) >= depth) continue;
			if (trimmed.startsWith("<")) {
				ancestorIndex = cursor;
				break;
			}
		}
		if (ancestorIndex < 0) return;
		const ancestor = lines[ancestorIndex];
		if (!/\bgrid\b/.test(ancestor) || /\bflex\b/.test(ancestor)) return;
		// A grid of nothing but checkboxes is a deliberate option grid, not a mixed field row.
		const block = lines.slice(ancestorIndex, ancestorIndex + 40).join("\n");
		if (!/labelClassName|fieldClass|SelectField/.test(block)) return;
		violations.push(`${file.split("features/")[1]}:${index + 1}`);
	});
	return violations;
};

/** Selects that bypass the shared class, and therefore lose the symmetric caret padding. */
const selectClassViolations = (file: string, source: string): Violation[] => {
	const violations: Violation[] = [];
	const tagPattern = /<select\b[^>]*>/g;
	let match = tagPattern.exec(source);
	while (match) {
		const tag = match[0];
		const line = source.slice(0, match.index).split("\n").length;
		const className = /className=(\{[^}]*\}|"[^"]*")/.exec(tag)?.[1] ?? "";
		const usesSharedClass = className.includes("selectClassName") || className.includes("select-input");
		if (!usesSharedClass) violations.push(`${file.split("features/")[1]}:${line} (${className || "no className"})`);
		match = tagPattern.exec(source);
	}
	return violations;
};

/** Selects whose own class list re-adds padding or spacing, which is what desynced the caret and the caption. */
const selectOverrideViolations = (file: string, source: string): Violation[] => {
	const violations: Violation[] = [];
	const pattern = /<SelectField\b[^>]*>/g;
	let match = pattern.exec(source);
	while (match) {
		const tag = match[0];
		const line = source.slice(0, match.index).split("\n").length;
		const where = `${file.split("features/")[1]}:${line}`;
		const className = /className="([^"]*)"/.exec(tag)?.[1] ?? "";
		const container = /containerClassName="([^"]*)"/.exec(tag)?.[1] ?? "";
		if (/(^|\s)(p|px|pl|pr)-/.test(className)) violations.push(`${where} (pads itself: ${className})`);
		// A caption gap belongs to select-input; adding one here would double it.
		if (/(^|\s)m[tb]?-/.test(container) || /(^|\s)m[tb]?-/.test(className.replaceAll("mt-0", ""))) {
			violations.push(`${where} (adds its own margin: ${container || className})`);
		}
		match = pattern.exec(source);
	}
	return violations;
};

/** The caption gap: what sits between a label and its control must match for inputs and selects. */
const captionGap = () => {
	const css = readFileSync(CSS, "utf8");
	const block = /\.select-input \{([\s\S]*?)\n\t\}/.exec(css)?.[1] ?? "";
	const selectGap = /margin-top:\s*([\d.]+)rem/.exec(block)?.[1];
	const fieldClass = /export const fieldClassName =\s*"([^"]*)"/.exec(readFileSync(TOOL_UI, "utf8"))?.[1] ?? "";
	const inputGap = /\bmt-(\d+(?:\.\d+)?)\b/.exec(fieldClass)?.[1];
	return { selectGap: Number(selectGap), inputGap: Number(inputGap) * 0.25 };
};

describe("tool layout contract", () => {
	it("keeps checkboxes out of field grids", () => {
		const violations = sourceFiles().flatMap((file) => checkboxGridViolations(file, readFileSync(file, "utf8").split("\n")));
		expect(violations, `Wrap these checkboxes in <CheckboxRow> instead of adding them as grid cells:\n${violations.join("\n")}`).toEqual([]);
	});

	it("keeps select overrides out of the shared padding and spacing", () => {
		const violations = sourceFiles().flatMap((file) => selectOverrideViolations(file, readFileSync(file, "utf8")));
		expect(violations, `Let select-input own the padding and the caption gap:\n${violations.join("\n")}`).toEqual([]);
	});

	it("gives selects the same caption gap as text inputs", () => {
		const { selectGap, inputGap } = captionGap();
		expect(selectGap).toBeGreaterThan(0);
		expect(selectGap).toBeCloseTo(inputGap, 5);
	});

	it("gives every select the shared select-input class", () => {
		const violations = sourceFiles().flatMap((file) => selectClassViolations(file, readFileSync(file, "utf8")));
		expect(violations, `Use selectClassName (the select-input class) so the caret padding stays symmetric:\n${violations.join("\n")}`).toEqual([]);
	});
});
