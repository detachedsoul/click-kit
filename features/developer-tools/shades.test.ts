import { describe, expect, it } from "vitest";
import { buildShades, mixColours, parseHex, readableTextOn, shadeFileName, shadeVariables, toHex, toRgbString } from "@/features/developer-tools/shades-utils";

describe("colour shade ramp", () => {
	it("parses short and long hex values", () => {
		expect(parseHex("#abc")).toEqual({ r: 170, g: 187, b: 204 });
		expect(parseHex("2f4f2f")).toEqual({ r: 47, g: 79, b: 47 });
		expect(() => parseHex("#12")).toThrow(/hex colour/u);
	});

	it("round-trips colour strings", () => {
		expect(toHex(mixColours({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5))).toBe("#808080");
		expect(toRgbString({ r: 12, g: 34, b: 56 })).toBe("rgb(12 34 56)");
	});

	it("keeps the source colour at 500 and walks to near white and black", () => {
		const shades = buildShades("#3f6b4a");
		expect(shades).toHaveLength(10);
		expect(shades[5]).toEqual({ label: "500", hex: "#3f6b4a", name: "#3f6b4a" });
		expect(shades[0].label).toBe("50");
		expect(shades[9].label).toBe("900");
		expect(parseHex(shades[0].hex).r).toBeGreaterThan(parseHex(shades[5].hex).r);
		expect(parseHex(shades[9].hex).r).toBeLessThan(parseHex(shades[5].hex).r);
		expect(shades.map((shade) => shade.hex)).toHaveLength(new Set(shades.map((shade) => shade.hex)).size);
		expect(() => buildShades("#3f6b4a", 0)).toThrow(/Strength/u);
	});

	it("emits CSS variables and picks readable swatch text", () => {
		const css = shadeVariables(buildShades("#3f6b4a"), "brand");
		expect(css.startsWith(":root {")).toBe(true);
		expect(css).toContain("--brand-500: #3f6b4a;");
		expect(readableTextOn("#f7f5ee")).toBe("#1b1c18");
		expect(readableTextOn("#263b34")).toBe("#ffffff");
		expect(shadeFileName("#3F6B4A", "css")).toBe("3f6b4a-shades.css");
	});
});
