import { describe, expect, it } from "vitest";
import { clampCrop, cropPixels, enhancePixels } from "@/features/image-tools/ocr-utils";

describe("image OCR preprocessing helpers", () => {
	it("clamps crop coordinates and dimensions to the image bounds", () => {
		expect(clampCrop({ left: 80, top: 90, width: 50, height: 30 })).toEqual({ left: 80, top: 90, width: 20, height: 10 });
		expect(cropPixels(200, 100, { left: 10, top: 20, width: 50, height: 40 })).toEqual({ x: 20, y: 20, width: 100, height: 40 });
	});

	it("keeps a crop non-empty even when inputs are invalid", () => {
		expect(clampCrop({ left: -8, top: Number.NaN, width: 0, height: 0 })).toEqual({ left: 0, top: 0, width: 1, height: 1 });
	});

	it("converts colour pixels to a high-contrast black and white image", () => {
		const pixels = new Uint8ClampedArray([20, 20, 20, 255, 250, 250, 250, 255, 0, 150, 0, 255]);
		expect([...enhancePixels(pixels, 128)]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
	});
});
