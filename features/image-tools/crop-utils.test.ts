import { describe, expect, it } from "vitest";
import { clampRect, fitAspectRect, outputExtension, placeCrop, ratioLabel, resizeRect, stripExtension } from "@/features/image-tools/crop-utils";

describe("crop geometry", () => {
	it("uses the whole image when the aspect is free", () => {
		expect(fitAspectRect({ width: 1200, height: 800 }, null)).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
	});

	it("fits a wide aspect inside a tall image", () => {
		expect(fitAspectRect({ width: 1000, height: 500 }, 1)).toEqual({ x: 250, y: 0, width: 500, height: 500 });
	});

	it("fits a 16:9 crop inside a wider-than-needed image", () => {
		const rect = fitAspectRect({ width: 1000, height: 500 }, 16 / 9);
		expect(rect.height).toBe(500);
		expect(rect.width).toBe(889);
		expect(rect.x).toBe(56);
		expect(rect.y).toBe(0);
	});

	it("zooms in and moves the crop around", () => {
		expect(placeCrop({ width: 1000, height: 500 }, 1, 2)).toEqual({ x: 375, y: 125, width: 250, height: 250 });
		expect(placeCrop({ width: 1000, height: 500 }, null, 2)).toEqual({ x: 250, y: 125, width: 500, height: 250 });
		expect(placeCrop({ width: 1000, height: 500 }, null, 1, 0, 0)).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
		const bottomRight = placeCrop({ width: 1000, height: 500 }, null, 2, 1, 1);
		expect(bottomRight).toEqual({ x: 500, y: 250, width: 500, height: 250 });
	});

	it("keeps awkward input inside the image", () => {
		expect(clampRect({ x: -20, y: -5, width: 5000, height: 4000 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0, width: 800, height: 600 });
		expect(clampRect({ x: 700, y: 500, width: 400, height: 400 }, { width: 800, height: 600 })).toEqual({ x: 400, y: 200, width: 400, height: 400 });
	});

	it("resizes from a numeric corner without escaping the image", () => {
		expect(resizeRect({ x: 100, y: 100, width: 200, height: 200 }, { width: 400, height: 400 }, 300, 300)).toEqual({ x: 100, y: 100, width: 300, height: 300 });
		expect(resizeRect({ x: 100, y: 100, width: 200, height: 200 }, { width: 400, height: 400 }, 900, 900)).toEqual({ x: 0, y: 0, width: 400, height: 400 });
	});

	it("labels ratios and output files", () => {
		expect(ratioLabel({ width: 1920, height: 1080 })).toBe("16:9");
		expect(ratioLabel({ width: 1000, height: 1000 })).toBe("1:1");
		expect(ratioLabel({ width: 1000, height: 423 })).toBe("2.36:1");
		expect(outputExtension("image/jpeg")).toBe("jpg");
		expect(outputExtension("image/webp")).toBe("webp");
		expect(stripExtension("holiday.photo.jpg")).toBe("holiday.photo");
	});
});
