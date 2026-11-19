import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The site is set in fixed pixel sizes chosen on a desktop. On a phone those sizes are read at
 * arm's length and, for form fields, trigger iOS's focus zoom. These rules live in one place at
 * the bottom of globals.css; the test keeps them from being trimmed away unnoticed.
 */

const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

/** Every `@media (max-width: 640px)` block joined, which is where the phone scale lives. */
const phoneBlocks = () => {
	const blocks = css.split("@media (max-width: 640px)").slice(1);
	expect(blocks.length, "at least one max-width 640px block").toBeGreaterThan(0);
	return blocks.join("\n");
};

/** The font size a given `text-[Npx]` utility is given on a phone. */
const floor = (token: string) => {
	const at = phoneBlocks().indexOf(`text-\\[${token}\\] {`);
	expect(at, `text-[${token}] has a phone size`).toBeGreaterThan(-1);
	const rule = /font-size: ([\d.]+)px;/u.exec(phoneBlocks().slice(at));
	expect(rule, `text-[${token}] sets a font size`).not.toBeNull();
	return Number(rule?.[1]);
};

describe("phone type scale", () => {
	it("lifts every small fixed size instead of shrinking it", () => {
		expect(floor("11px")).toBeGreaterThanOrEqual(12);
		expect(floor("10px")).toBeGreaterThanOrEqual(11);
		expect(floor("9px")).toBeGreaterThanOrEqual(11);
		expect(floor("8px")).toBeGreaterThanOrEqual(10);
	});

	it("keeps text-xs and text-sm readable on a phone", () => {
		const blocks = phoneBlocks();
		expect(blocks).toMatch(/\.text-xs \{\s*font-size: 0\.8125rem;/u);
		expect(blocks).toMatch(/\.text-sm \{\s*font-size: 0\.9375rem;/u);
	});

	it("stops iOS from zooming into a field", () => {
		expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*?input:not\(\[type="checkbox"\][\s\S]*?font-size: 16px !important;/u);
	});

	it("grows touch targets and respects reduced motion", () => {
		expect(phoneBlocks()).toMatch(/\.min-h-9,[\s\S]*?min-height: 2\.75rem;/u);
		expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?scroll-behavior: auto;/u);
	});
});
