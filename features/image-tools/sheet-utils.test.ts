import { describe, expect, it } from "vitest";
import { captionFor, clampCell, clampColumns, clampGap, coverRect, MAX_SHEET_CELLS, sheetFileName, sheetLayout, sheetRows } from "@/features/image-tools/sheet-utils";

const options = { count: 5, columns: 3, cell: 200, gap: 10, padding: 20, captionHeight: 22 };

describe("contact sheet", () => {
	it("lays out rows, columns, and the sheet size", () => {
		const layout = sheetLayout(options);
		expect(layout.rows).toBe(2);
		expect(layout.width).toBe(20 * 2 + 3 * 200 + 2 * 10);
		expect(layout.height).toBe(20 * 2 + 2 * 222 + 10);
		expect(layout.cells.map((cell) => ({ x: cell.x, y: cell.y }))).toEqual([
			{ x: 20, y: 20 },
			{ x: 230, y: 20 },
			{ x: 440, y: 20 },
			{ x: 20, y: 252 },
			{ x: 230, y: 252 },
		]);
		expect(layout.cells[0].captionY).toBe(220);
	});

	it("counts rows and guards the extremes", () => {
		expect(sheetRows(4, 2)).toBe(2);
		expect(sheetRows(5, 2)).toBe(3);
		expect(() => sheetRows(0, 2)).toThrow(/at least one image/u);
		expect(clampColumns(0)).toBe(1);
		expect(clampColumns(99)).toBe(8);
		expect(clampColumns(3)).toBe(3);
		expect(clampColumns(Number.NaN)).toBe(1);
		// Two pictures over four chosen columns still means four columns, one row.
		expect(sheetLayout({ count: 2, columns: 4, cell: 100, gap: 0, padding: 0, captionHeight: 0 })).toMatchObject({ columns: 4, rows: 1, width: 400, height: 100 });
		expect(clampCell(2)).toBe(16);
		expect(clampCell(5000)).toBe(1200);
		expect(clampGap(-4)).toBe(0);
		expect(MAX_SHEET_CELLS).toBe(48);
		expect(() => sheetLayout({ ...options, cell: 8 })).toThrow(/at least 16 pixels/u);
		expect(() => sheetLayout({ ...options, gap: -1 })).toThrow(/cannot be negative/u);
	});

	it("crops each photo to fill its square", () => {
		expect(coverRect({ width: 400, height: 200 }, 200)).toEqual({ x: -100, y: 0, width: 400, height: 200 });
		expect(coverRect({ width: 100, height: 400 }, 200)).toEqual({ x: 0, y: -300, width: 200, height: 800 });
		expect(() => coverRect({ width: 0, height: 10 }, 200)).toThrow(/no readable size/u);
	});

	it("names files and shortens captions", () => {
		expect(sheetFileName(3, 2, "png")).toBe("contact-sheet-3x2.png");
		expect(captionFor("Beach Day.jpg")).toBe("Beach Day");
		expect(captionFor("a very long photograph name here.png", 10)).toBe("a very lo…");
	});
});
