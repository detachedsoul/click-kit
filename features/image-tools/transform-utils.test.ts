import { describe, expect, it } from "vitest";
import { isUntouched, nextRotation, orientationLabel, rotatedSize } from "@/features/image-tools/rotate-utils";
import { anchorPosition, clampFontSize, clampLogoScaled, clampOpacity, logoBox, tilePositions, watermarkFileName, watermarkSummary } from "@/features/image-tools/watermark-utils";
import { clampDimension, placeholderFileName, placeholderFontSize, placeholderSvg, PRESET_SIZES } from "@/features/image-tools/placeholder-utils";
import { cssFilter, DEFAULT_FILTERS, describeFilters, filterFileName, isIdentity } from "@/features/image-tools/filters-utils";

describe("rotation helper", () => {
	it("turns in both directions and wraps at 360", () => {
		expect(nextRotation(0, 90)).toBe(90);
		expect(nextRotation(270, 90)).toBe(0);
		expect(nextRotation(0, -90)).toBe(270);
		expect(nextRotation(180, 180 as 90)).toBe(0);
	});

	it("swaps dimensions for quarter turns", () => {
		expect(rotatedSize({ width: 800, height: 600 }, 90)).toEqual({ width: 600, height: 800 });
		expect(rotatedSize({ width: 800, height: 600 }, 180)).toEqual({ width: 800, height: 600 });
		expect(rotatedSize({ width: 800, height: 600 }, 270)).toEqual({ width: 600, height: 800 });
	});

	it("describes the orientation in words", () => {
		expect(orientationLabel(0, false, false)).toBe("Original orientation");
		expect(orientationLabel(90, false, false)).toBe("Turned 90° clockwise");
		expect(orientationLabel(180, true, false)).toBe("Turned 180° clockwise, flipped horizontally");
		expect(orientationLabel(0, true, true)).toBe("flipped horizontally, flipped vertically");
		expect(isUntouched(0, false, false)).toBe(true);
		expect(isUntouched(0, true, false)).toBe(false);
	});
});

describe("watermark layout", () => {
	const canvas = { width: 1000, height: 600 };
	const box = { width: 200, height: 40 };

	it("pins the text to each corner with padding", () => {
		expect(anchorPosition(canvas, box, "top-left", 16)).toEqual({ x: 16, y: 16 });
		expect(anchorPosition(canvas, box, "bottom-right", 16)).toEqual({ x: 784, y: 544 });
		expect(anchorPosition(canvas, box, "center")).toEqual({ x: 400, y: 280 });
		expect(anchorPosition(canvas, box, "bottom-center")).toEqual({ x: 400, y: 544 });
	});

	it("never pushes the watermark outside the image", () => {
		const huge = { width: 2000, height: 900 };
		const position = anchorPosition(canvas, huge, "center");
		expect(position.x).toBe(0);
		expect(position.y).toBe(0);
	});

	it("repeats the watermark across the whole image", () => {
		const points = tilePositions(canvas, box, 20, 30);
		expect(points.length).toBeGreaterThan(6);
		expect(points.some((point) => point.y > canvas.height / 2)).toBe(true);
		expect(points.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true);
	});

	it("sizes a logo image without stretching it", () => {
		expect(logoBox(canvas, { width: 400, height: 200 }, 20)).toEqual({ width: 200, height: 100 });
		expect(logoBox(canvas, { width: 100, height: 400 }, 20)).toEqual({ width: 135, height: 540 });
		const tall = logoBox(canvas, { width: 10, height: 100 }, 90);
		expect(tall.height).toBe(540);
		expect(tall.width).toBe(54);
		expect(clampLogoScaled(500)).toBe(90);
		expect(clampLogoScaled(0)).toBe(2);
		expect(() => logoBox(canvas, { width: 0, height: 0 })).toThrow(/no readable size/u);
		expect(() => logoBox({ width: 0, height: 0 }, { width: 10, height: 10 })).toThrow(/Load the picture/u);
	});

	it("summarises what is being stamped", () => {
		expect(watermarkSummary("text", { text: "© Ada", tiled: false, anchorLabel: "Bottom right" })).toBe("© Ada · Bottom right");
		expect(watermarkSummary("image", { text: "", logoName: "logo.png", tiled: true, anchorLabel: "Centre" })).toBe("logo.png · tiled");
	});

	it("clamps opacity and font size to something usable", () => {
		expect(clampOpacity(2)).toBe(1);
		expect(clampOpacity(0)).toBe(0.05);
		expect(clampFontSize(9999, canvas)).toBe(300);
		expect(clampFontSize(4, canvas)).toBe(4);
		expect(watermarkFileName("holiday.JPG", "png")).toBe("holiday-watermarked.png");
	});
});

describe("placeholder generator", () => {
	it("ships sensible presets", () => {
		expect(PRESET_SIZES[0]).toMatchObject({ width: 1200, height: 630 });
		expect(PRESET_SIZES.length).toBeGreaterThan(3);
	});

	it("builds a self-contained SVG", () => {
		const svg = placeholderSvg({ width: 600, height: 300, background: "#f3f1e9", color: "#263b34", label: "Hero image" });
		expect(svg).toContain('width="600" height="300"');
		expect(svg).toContain('viewBox="0 0 600 300"');
		expect(svg).toContain('fill="#263b34"');
		expect(svg).toContain(">Hero image</text>");
		expect(svg.trim().endsWith("</svg>")).toBe(true);
	});

	it("escapes markup in the label and falls back to the size", () => {
		expect(placeholderSvg({ width: 10, height: 10, background: "#000", color: "#fff", label: '<script>&"x"' })).toContain("&lt;script&gt;&amp;&quot;x&quot;");
		expect(placeholderSvg({ width: 320, height: 180, background: "#000", color: "#fff", label: "  " })).toContain(">320 × 180</text>");
	});

	it("scales the type to the shorter side and clamps dimensions", () => {
		expect(placeholderFontSize({ width: 600, height: 300 })).toBe(43);
		expect(placeholderFontSize({ width: 600, height: 300, fontSize: 12 })).toBe(12);
		expect(clampDimension(0)).toBe(1);
		expect(clampDimension(99999)).toBe(8192);
		expect(placeholderFileName({ width: 600, height: 300, background: "", color: "", label: "Hero image" }, "svg")).toBe("hero-image-600x300.svg");
		expect(placeholderFileName({ width: 600, height: 300, background: "", color: "", label: "!!!" }, "png")).toBe("placeholder-600x300.png");
	});
});

describe("filter helper", () => {
	it("builds a CSS filter string", () => {
		expect(cssFilter({ ...DEFAULT_FILTERS, grayscale: 100 })).toContain("grayscale(100%)");
		expect(cssFilter({ ...DEFAULT_FILTERS, blur: 3 })).toContain("blur(3px)");
		expect(cssFilter({ ...DEFAULT_FILTERS, brightness: 500 })).toContain("brightness(180%)");
	});

	it("knows when nothing changed", () => {
		expect(isIdentity(DEFAULT_FILTERS)).toBe(true);
		expect(isIdentity({ ...DEFAULT_FILTERS, sepia: 20 })).toBe(false);
		expect(describeFilters(DEFAULT_FILTERS)).toBe("No filters applied");
		expect(describeFilters({ ...DEFAULT_FILTERS, sepia: 20, blur: 2 })).toBe("sepia 20%, blur 2px");
		expect(filterFileName("cat.jpeg", "webp")).toBe("cat-filtered.webp");
	});
});
