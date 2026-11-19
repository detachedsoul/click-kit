import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_LARGE, AA_NORMAL, contrastRatio, failingPairs, meetsContrast, normaliseHex, relativeLuminance } from "@/lib/contrast";

/** The `@theme` block in app/globals.css, kept in step by hand because CSS is not importable here. */
const TOKENS = {
	paper: "#f3f1e9",
	surface: "#fffdf8",
	ink: "#252820",
	muted: "#5f6259",
	line: "#dedbd1",
	field: "#8a8779",
	accent: "#b64b31",
	accentDark: "#873b28",
	forest: "#263b34",
	sage: "#e2eadc",
};

/** Light surfaces that body copy actually sits on. */
const LIGHT_SURFACES = [TOKENS.paper, TOKENS.surface, "#f8f7f3", "#fbfaf7", "#f7f5ee", TOKENS.sage];

/** Colours that are only ever used on the dark forest panels. */
const ON_DARK_TEXT = new Set(["#f6f4eb", "#e7e8dd", "#d4ddcb", "#c6cec3", "#f1c891", "#adc89a", "#ffffff", "#fff", "#fffdf8"]);

const sourceFiles = () => {
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			if (["node_modules", ".next", ".git"].includes(entry)) continue;
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) walk(full);
			else if (/\.tsx$/u.test(full) && !full.includes(".test.")) files.push(full);
		}
	};
	for (const dir of ["app", "components", "features"]) walk(dir);
	return files;
};

describe("contrast helpers", () => {
	it("follows the WCAG reference values", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
		expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
		expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
		expect(relativeLuminance("#000000")).toBe(0);
		expect(normaliseHex("#ABC")).toBe("#aabbcc");
		expect(() => normaliseHex("#12")).toThrow(/hex colour/u);
		expect(meetsContrast("#000000", "#ffffff")).toBe(true);
		expect(meetsContrast("#b9b6ab", "#ffffff")).toBe(false);
	});
});

describe("design tokens", () => {
	it("keeps body text readable on every light surface", () => {
		const pairs = LIGHT_SURFACES.flatMap((background) => [
			{ foreground: TOKENS.ink, background, label: `ink on ${background}` },
			{ foreground: TOKENS.muted, background, label: `muted on ${background}` },
			{ foreground: TOKENS.accentDark, background, label: `accent-dark on ${background}` },
			{ foreground: TOKENS.forest, background, label: `forest on ${background}` },
		]);
		expect(failingPairs(pairs)).toEqual([]);
	});

	it("draws form boundaries at 3:1 so fields are visible", () => {
		// Fields only ever sit on paper, surface, and the two card tints — never on the sage info panels.
		for (const background of LIGHT_SURFACES.filter((colour) => colour !== TOKENS.sage)) expect(contrastRatio(TOKENS.field, background)).toBeGreaterThanOrEqual(AA_LARGE);
	});

	it("keeps the brand accent legible as a graphic and on paper", () => {
		expect(contrastRatio(TOKENS.accent, TOKENS.paper)).toBeGreaterThanOrEqual(AA_NORMAL);
		for (const background of LIGHT_SURFACES) expect(contrastRatio(TOKENS.accent, background)).toBeGreaterThanOrEqual(AA_LARGE);
	});

	it("keeps light text on the dark forest panels readable", () => {
		for (const colour of ON_DARK_TEXT) expect(contrastRatio(colour, TOKENS.forest)).toBeGreaterThanOrEqual(AA_NORMAL);
	});
});

describe("hard-coded text colours", () => {
	it("never drops a text colour below AA on the light surfaces", () => {
		const offenders: string[] = [];
		for (const file of sourceFiles()) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(/text-\[(#[0-9a-fA-F]{3,8})\]/gu)) {
				const colour = normaliseHex(match[1]);
				// Disabled text is exempt from the contrast requirement.
				const start = Math.max(0, match.index - 12);
				if (source.slice(start, match.index).includes("disabled:")) continue;
				if (ON_DARK_TEXT.has(colour)) continue;
				const worst = Math.min(...LIGHT_SURFACES.map((background) => contrastRatio(colour, background)));
				if (worst < AA_NORMAL) offenders.push(`${file}: ${colour} is ${worst.toFixed(2)}:1`);
			}
		}
		expect([...new Set(offenders)]).toEqual([]);
	});
});
