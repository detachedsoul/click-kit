import { describe, expect, it } from "vitest";
import {
	addSwatch,
	colourDistance,
	formatHsl,
	formatRgb,
	hexToRgb,
	isSameColour,
	luminance,
	MAX_SWATCHES,
	samplePixel,
	swatchesToCss,
	swatchesToHexList,
	textOn,
	toHex,
} from "@/features/image-tools/eyedropper-utils";

describe("colour picker", () => {
	it("converts between hex and rgb", () => {
		expect(hexToRgb("#B64B31")).toEqual({ r: 182, g: 75, b: 49 });
		expect(hexToRgb("fff")).toEqual({ r: 255, g: 255, b: 255 });
		expect(toHex({ r: 182, g: 75, b: 49 })).toBe("#b64b31");
		expect(toHex({ r: 300, g: -20, b: 12.6 })).toBe("#ff000d");
		expect(() => hexToRgb("#12")).toThrow(/hex colour/u);
	});

	it("formats rgb and hsl strings", () => {
		expect(formatRgb({ r: 182, g: 75, b: 49 })).toBe("182, 75, 49");
		expect(formatHsl({ r: 182, g: 75, b: 49 })).toBe("hsl(12, 58%, 45%)");
		expect(formatHsl({ r: 255, g: 255, b: 255 })).toBe("hsl(0, 0%, 100%)");
		expect(formatHsl({ r: 0, g: 0, b: 0 })).toBe("hsl(0, 0%, 0%)");
	});

	it("picks readable label text and measures distance", () => {
		expect(textOn({ r: 255, g: 255, b: 255 })).toBe("#252820");
		expect(textOn({ r: 0, g: 0, b: 0 })).toBe("#ffffff");
		expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
		expect(isSameColour({ r: 10, g: 10, b: 10 }, { r: 12, g: 11, b: 10 })).toBe(true);
		expect(isSameColour({ r: 10, g: 10, b: 10 }, { r: 200, g: 10, b: 10 })).toBe(false);
		expect(colourDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
	});

	it("skips repeat swatches and caps the list", () => {
		let swatches = [{ hex: "#112233", x: 0, y: 0 }];
		swatches = addSwatch(swatches, { hex: "#112234", x: 5, y: 5 });
		expect(swatches).toHaveLength(1);
		swatches = addSwatch(swatches, { hex: "#ffffff", x: 9, y: 9 });
		expect(swatches[0]).toEqual({ hex: "#ffffff", x: 9, y: 9 });
		for (let index = 0; index < 40; index += 1) swatches = addSwatch(swatches, { hex: `#${(index * 5).toString(16).padStart(2, "0")}0000`, x: index, y: index });
		expect(swatches.length).toBeLessThanOrEqual(MAX_SWATCHES);
	});

	it("samples pixels out of RGBA data", () => {
		const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 9, 9, 9, 128]);
		expect(samplePixel(data, 2, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(samplePixel(data, 2, 1, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
		expect(samplePixel(data, 2, 0, 1)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
		expect(samplePixel(data, 2, 9, 9)).toEqual({ r: 9, g: 9, b: 9, a: 128 });
	});

	it("exports the swatches", () => {
		const swatches = [
			{ hex: "#b64b31", x: 1, y: 2 },
			{ hex: "#263b34", x: 3, y: 4 },
		];
		expect(swatchesToCss(swatches)).toBe(":root {\n\t--colour-1: #b64b31;\n\t--colour-2: #263b34;\n}");
		expect(swatchesToHexList(swatches)).toBe("#b64b31\n#263b34");
	});
});
