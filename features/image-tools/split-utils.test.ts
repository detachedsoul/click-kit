import { describe, expect, it } from "vitest";
import { coversWholeImage, GRID_PRESETS, gridSummary, MAX_CELLS, splitGrid, tileFileName } from "@/features/image-tools/split-utils";

const size = { width: 900, height: 600 };

describe("image splitter", () => {
	it("splits into equal thirds with no gap", () => {
		const tiles = splitGrid(size, { columns: 3, rows: 3, gap: 0 });
		expect(tiles).toHaveLength(9);
		expect(tiles[0]).toEqual({ index: 1, row: 0, column: 0, x: 0, y: 0, width: 300, height: 200 });
		expect(tiles[8]).toMatchObject({ index: 9, row: 2, column: 2, x: 600, y: 400 });
		expect(coversWholeImage(tiles, size, 0)).toBe(true);
	});

	it("hands leftover pixels to the first tiles", () => {
		const tiles = splitGrid({ width: 1000, height: 500 }, { columns: 3, rows: 1, gap: 0 });
		expect(tiles.map((tile) => tile.width)).toEqual([334, 333, 333]);
		expect(tiles.map((tile) => tile.x)).toEqual([0, 334, 667]);
		expect(coversWholeImage(tiles, { width: 1000, height: 500 }, 0)).toBe(true);
	});

	it("leaves a gap between tiles", () => {
		const tiles = splitGrid({ width: 1000, height: 500 }, { columns: 2, rows: 3, gap: 10 });
		expect(tiles.every((tile) => tile.width === 495)).toBe(true);
		expect(tiles.filter((tile) => tile.column === 1).every((tile) => tile.x === 505)).toBe(true);
		expect(tiles.filter((tile) => tile.row === 1).every((tile) => tile.y === 170)).toBe(true);
		expect(coversWholeImage(tiles, { width: 1000, height: 500 }, 10)).toBe(true);
	});

	it("rejects impossible grids", () => {
		expect(() => splitGrid({ width: 0, height: 10 }, { columns: 1, rows: 1, gap: 0 })).toThrow(/Pick an image/u);
		expect(() => splitGrid(size, { columns: 0, rows: 1, gap: 0 })).toThrow(/whole numbers/u);
		expect(() => splitGrid(size, { columns: 20, rows: 20, gap: 0 })).toThrow(/144 tiles/u);
		expect(() => splitGrid(size, { columns: 3, rows: 1, gap: 500 })).toThrow(/gap is too wide/u);
		expect(MAX_CELLS).toBe(144);
	});

	it("summarises the grid and names each tile", () => {
		const tiles = splitGrid(size, { columns: 3, rows: 3, gap: 0 });
		expect(gridSummary(tiles)).toEqual({ count: 9, widest: 300, tallest: 200, pixels: 540000 });
		expect(gridSummary([])).toEqual({ count: 0, widest: 0, tallest: 0, pixels: 0 });
		expect(tileFileName("Holiday Photo.jpg", tiles[4], "png")).toBe("holiday-photo-r2c2.png");
		expect(GRID_PRESETS.every((preset) => preset.columns * preset.rows <= MAX_CELLS)).toBe(true);
	});
});
