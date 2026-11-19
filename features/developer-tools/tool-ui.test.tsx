import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { choiceButtonClassName, SegmentedControl } from "@/features/developer-tools/tool-ui";

afterEach(cleanup);

describe("choice buttons", () => {
	it("gives the chosen button a solid fill and white text", () => {
		expect(choiceButtonClassName(true)).toContain("bg-forest");
		expect(choiceButtonClassName(true)).toContain("text-white");
		expect(choiceButtonClassName(true)).not.toContain("bg-surface");
	});

	it("gives the rest a light fill and dark text, never white on white", () => {
		const idle = choiceButtonClassName(false);
		expect(idle).toContain("bg-surface");
		expect(idle).toContain("text-ink");
		expect(idle).not.toContain("text-white");
	});

	it("never mixes the two fills in one button", () => {
		for (const active of [true, false]) {
			const classes = choiceButtonClassName(active);
			expect(classes.includes("bg-forest") && classes.includes("bg-surface")).toBe(false);
		}
	});

	it("wires the state up in a segmented control", () => {
		render(<SegmentedControl label="Colour" onChange={() => undefined} options={[{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }]} value="red" />);
		expect(screen.getByRole("button", { name: "Red" }).className).toContain("bg-forest");
		expect(screen.getByRole("button", { name: "Blue" }).className).toContain("bg-surface");
		expect(screen.getByRole("button", { name: "Blue" }).className).not.toContain("text-white");
	});
});

const sourceFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
	});

describe("a green button is never repainted light", () => {
	it("never composes the primary button with a background or text override", () => {
		// The bug this guards: `${primaryButtonClassName} ${idle ? "bg-surface text-ink" : ""}`.
		// Both halves are real utilities, so which one wins is stylesheet order — and the
		// result was a row of cream buttons with white words on them.
		const offenders = sourceFiles(join(process.cwd(), "features")).filter((path) => /primaryButtonClassName\}\s*\$\{/u.test(readFileSync(path, "utf-8")));
		expect(offenders).toEqual([]);
	});
});
