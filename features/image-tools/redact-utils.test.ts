import { describe, expect, it } from "vitest";
import {
	blurRadius,
	clampStrength,
	DEFAULT_STRENGTH,
	MAX_STRENGTH,
	MIN_STRENGTH,
	regionStrength,
	coveragePercent,
	describeRegions,
	isUsableRegion,
	MIN_REGION,
	normaliseRegion,
	pixelBlockSize,
	pointerToImage,
	redactedFileName,
	regionPercentStyle,
	REGION_MODES,
	resizeRegion,
} from "@/features/image-tools/redact-utils";

const size = { width: 1000, height: 500 };

describe("redaction regions", () => {
	it("normalises a drag in any direction", () => {
		expect(normaliseRegion({ x: 300, y: 200 }, { x: 100, y: 50 }, size)).toEqual({ x: 100, y: 50, width: 200, height: 150 });
		expect(normaliseRegion({ x: 100, y: 50 }, { x: 300, y: 200 }, size)).toEqual({ x: 100, y: 50, width: 200, height: 150 });
	});

	it("keeps a region inside the image", () => {
		expect(normaliseRegion({ x: -50, y: -20 }, { x: 1400, y: 900 }, size)).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
		expect(() => normaliseRegion({ x: 0, y: 0 }, { x: 1, y: 1 }, { width: 0, height: 0 })).toThrow(/Pick an image/u);
	});

	it("drops accidental taps", () => {
		expect(isUsableRegion({ width: MIN_REGION - 1, height: 40 })).toBe(false);
		expect(isUsableRegion({ width: 40, height: MIN_REGION })).toBe(true);
	});

	it("resizes and moves without leaving the picture", () => {
		const region = { id: "r1", x: 900, y: 400, width: 100, height: 100, mode: "solid" as const };
		const grown = resizeRegion(region, 500, 500, size);
		expect(grown.width).toBe(100);
		expect(grown.height).toBe(100);
		const shrunk = resizeRegion(region, -500, -500, size);
		expect(shrunk.width).toBe(MIN_REGION);
		expect(shrunk.x).toBe(900);
	});

	it("sizes the mosaic and blur effects so more strength hides more", () => {
		const region = { id: "r", x: 0, y: 0, width: 120, height: 60, mode: "pixelate" as const };
		expect(pixelBlockSize(region, MIN_STRENGTH)).toBe(2);
		expect(pixelBlockSize(region, 50)).toBe(15);
		expect(pixelBlockSize(region, MAX_STRENGTH)).toBe(30);
		expect(pixelBlockSize(region, 500)).toBe(30);
		expect(pixelBlockSize(region, 50) >= pixelBlockSize(region, 20)).toBe(true);
		expect(blurRadius(region, MIN_STRENGTH)).toBe(2);
		expect(blurRadius(region, 75)).toBe(15);
		expect(blurRadius(region, MAX_STRENGTH)).toBe(20);
	});

	it("keeps a strength per area, clamped to the slider", () => {
		expect(clampStrength(0)).toBe(MIN_STRENGTH);
		expect(clampStrength(500)).toBe(MAX_STRENGTH);
		expect(clampStrength(Number.NaN)).toBe(DEFAULT_STRENGTH);
		expect(regionStrength({ id: "a", x: 0, y: 0, width: 10, height: 10, mode: "blur" })).toBe(DEFAULT_STRENGTH);
		expect(regionStrength({ id: "b", x: 0, y: 0, width: 10, height: 10, mode: "blur", strength: 30 })).toBe(30);
		// An area's own strength wins over the default.
		expect(pixelBlockSize({ id: "c", x: 0, y: 0, width: 100, height: 100, mode: "pixelate", strength: 100 })).toBe(50);
	});

	it("reports how much of the image is covered", () => {
		const regions = [
			{ id: "a", x: 0, y: 0, width: 100, height: 100, mode: "solid" as const },
			{ id: "b", x: 0, y: 0, width: 100, height: 100, mode: "blur" as const },
		];
		expect(coveragePercent(regions, size)).toBe(4);
		expect(describeRegions(regions, size)).toBe("2 areas covering 4% of the image.");
		expect(describeRegions([regions[0]], size)).toBe("1 area covering 2% of the image.");
		expect(describeRegions([], size)).toBe("No areas marked yet.");
	});

	it("maps pointer positions onto the natural image size", () => {
		const rect = { left: 20, top: 10, width: 500, height: 250 };
		expect(pointerToImage({ x: 20, y: 10 }, rect, size)).toEqual({ x: 0, y: 0 });
		expect(pointerToImage({ x: 270, y: 135 }, rect, size)).toEqual({ x: 500, y: 250 });
		expect(pointerToImage({ x: 9999, y: 9999 }, rect, size)).toEqual({ x: 1000, y: 500 });
		expect(pointerToImage({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, size)).toEqual({ x: 0, y: 0 });
	});

	it("positions the preview overlay in percentages", () => {
		expect(regionPercentStyle({ id: "r", x: 250, y: 100, width: 500, height: 250, mode: "solid" }, size)).toEqual({
			left: "25%",
			top: "20%",
			width: "50%",
			height: "50%",
		});
	});

	it("names the download and lists the modes", () => {
		expect(redactedFileName("Screen Shot 2026-11-18.png", "png")).toBe("screen-shot-2026-11-18-redacted.png");
		expect(REGION_MODES.map((mode) => mode.id)).toEqual(["solid", "pixelate", "blur"]);
	});
});
