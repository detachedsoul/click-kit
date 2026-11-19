import { describe, expect, it } from "vitest";
import { BATCH_TARGETS, batchFileName, batchZipName, describeBatch, fitWithin, isDownscaling, MAX_BATCH_FILES, planBatch, targetFor, uniqueBatchName } from "@/features/image-tools/batch-utils";

const file = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type: "image/png" });

describe("batch image converter", () => {
	it("scales down without distorting or upscaling", () => {
		expect(fitWithin({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 });
		expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 });
		expect(fitWithin({ width: 9000, height: 10 }, 20000)).toEqual({ width: 8192, height: 9 });
		expect(isDownscaling({ width: 4000, height: 3000 }, 1600)).toBe(true);
		expect(isDownscaling({ width: 800, height: 600 }, 1600)).toBe(false);
		expect(() => fitWithin({ width: 0, height: 0 }, 100)).toThrow(/no readable size/u);
		expect(() => fitWithin({ width: 10, height: 10 }, 0)).toThrow(/Maximum width/u);
	});

	it("names outputs from the target format", () => {
		expect(batchFileName("Beach Day.JPG", "webp")).toBe("beach-day.webp");
		expect(batchFileName("!!!.png", "jpg")).toBe("image.jpg");
		expect(uniqueBatchName("photo.webp", new Set(["photo.webp"]))).toBe("photo-2.webp");
		expect(uniqueBatchName("photo.webp", new Set(["photo.webp", "photo-2.webp"]))).toBe("photo-3.webp");
		expect(batchZipName(targetFor("image/webp"))).toBe("converted-webp.zip");
	});

	it("plans a batch with unique names", () => {
		const plan = planBatch([file("holiday.png"), file("holiday.jpg"), file("Holiday.png")], targetFor("image/webp"));
		expect(plan.map((item) => item.outputName)).toEqual(["holiday.webp", "holiday-2.webp", "holiday-3.webp"]);
		expect(plan[0].target.lossy).toBe(true);
		expect(() => planBatch([], targetFor("image/webp"))).toThrow(/at least one image/u);
		expect(() => planBatch(Array.from({ length: MAX_BATCH_FILES + 1 }, (_, index) => file(`p${index}.png`)), targetFor("image/png"))).toThrow(/up to 30/u);
	});

	it("summarises the queue", () => {
		expect(describeBatch([file("a.png", 100), file("b.png", 250)])).toEqual({ count: 2, bytes: 350 });
		expect(BATCH_TARGETS.map((target) => target.extension)).toEqual(["webp", "jpg", "png"]);
	});
});
