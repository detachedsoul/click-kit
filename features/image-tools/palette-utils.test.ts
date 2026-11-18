import { describe, expect, it } from "vitest";
import { extractPalette, paletteToCssVariables, paletteToHexList, paletteToTailwind, rgbToHex, rgbToHsl } from "@/features/image-tools/palette-utils";

const pixelsFrom = (colors: [number, number, number, number][]) => new Uint8ClampedArray(colors.flat());

describe("palette extraction", () => {
	it("finds the dominant colours of a two-tone image", () => {
		const pixels = pixelsFrom([
			[255, 0, 0, 255],
			[255, 0, 0, 255],
			[0, 0, 255, 255],
			[0, 0, 255, 255],
		]);
		const palette = extractPalette(pixels, 2);
		expect(palette).toHaveLength(2);
		expect(palette.map((color) => color.hex).sort()).toEqual(["#0000ff", "#ff0000"]);
		expect(palette[0].share).toBeCloseTo(0.5, 5);
	});

	it("ignores transparent pixels", () => {
		const pixels = pixelsFrom([
			[0, 255, 0, 0],
			[0, 255, 0, 255],
			[0, 255, 0, 255],
		]);
		const palette = extractPalette(pixels, 4);
		expect(palette).toHaveLength(1);
		expect(palette[0].hex).toBe("#00ff00");
		expect(palette[0].share).toBeCloseTo(1, 5);
	});

	it("returns nothing for a fully transparent image", () => {
		expect(extractPalette(pixelsFrom([[10, 20, 30, 0]]), 4)).toEqual([]);
	});

	it("never asks for more buckets than there are colours", () => {
		const pixels = pixelsFrom([
			[1, 2, 3, 255],
			[4, 5, 6, 255],
		]);
		expect(extractPalette(pixels, 12).length).toBeLessThanOrEqual(2);
		expect(extractPalette(pixels, 1)).toHaveLength(1);
	});

	it("formats colours as hex, CSS variables, and Tailwind config", () => {
		expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
		expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
		const palette = [{ hex: "#123456", rgb: { r: 18, g: 52, b: 86 }, share: 1 }];
		expect(paletteToHexList(palette)).toBe("#123456");
		expect(paletteToCssVariables(palette)).toContain("--color-1: #123456;");
		expect(JSON.parse(paletteToTailwind(palette)).theme.extend.colors["palette-1"]).toBe("#123456");
	});
});
