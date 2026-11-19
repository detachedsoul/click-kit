import { describe, expect, it } from "vitest";
import { clampPosition, compareCanvas, compareFileName, compareHalves, containRect, describeChange, pointerPercent, revealClip } from "@/features/image-tools/compare-utils";

describe("image comparison", () => {
	it("sizes the canvas for both pictures and caps it", () => {
		expect(compareCanvas({ width: 800, height: 600 }, { width: 1200, height: 400 })).toEqual({ width: 1200, height: 600 });
		expect(compareCanvas({ width: 9000, height: 9000 }, { width: 10, height: 10 })).toEqual({ width: 4000, height: 4000 });
		expect(() => compareCanvas({ width: 0, height: 0 }, { width: 10, height: 10 })).toThrow(/both pictures/u);
	});

	it("contains a picture inside the canvas", () => {
		expect(containRect({ width: 1000, height: 500 }, { width: 1000, height: 1000 })).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
		expect(containRect({ width: 200, height: 400 }, { width: 400, height: 400 })).toEqual({ x: 100, y: 0, width: 200, height: 400 });
		expect(() => containRect({ width: 0, height: 4 }, { width: 10, height: 10 })).toThrow(/no readable size/u);
	});

	it("splits the export at the divider", () => {
		const box = { width: 1000, height: 400 };
		expect(compareHalves(box, 30, "horizontal")).toEqual({
			before: { x: 0, y: 0, width: 300, height: 400 },
			after: { x: 300, y: 0, width: 700, height: 400 },
		});
		expect(compareHalves(box, 25, "vertical")).toEqual({
			before: { x: 0, y: 0, width: 1000, height: 100 },
			after: { x: 0, y: 100, width: 1000, height: 300 },
		});
		expect(compareHalves(box, 250, "horizontal").before.width).toBe(1000);
	});

	it("maps positions to clip paths and pointer percentages", () => {
		expect(clampPosition(-20)).toBe(0);
		expect(clampPosition(120)).toBe(100);
		expect(clampPosition(Number.NaN)).toBe(50);
		expect(revealClip(35, "horizontal")).toBe("inset(0 0 0 35%)");
		expect(revealClip(70, "vertical")).toBe("inset(0 0 30% 0)");
		const rect = { left: 100, top: 50, width: 200, height: 400 };
		expect(pointerPercent({ x: 200, y: 0 }, rect, "horizontal")).toBe(50);
		expect(pointerPercent({ x: 0, y: 250 }, rect, "vertical")).toBe(50);
		expect(pointerPercent({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, "horizontal")).toBe(50);
		expect(compareFileName("holiday.JPG", "png")).toBe("holiday-comparison.png");
		expect(describeChange(2048, 1024)).toBe("1.0 kB smaller");
		expect(describeChange(100, 100)).toBe("same size");
		expect(describeChange(0, 3 * 1024 * 1024)).toBe("3.00 MB larger");
	});
});
