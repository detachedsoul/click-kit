import type { Size } from "@/features/image-tools/crop-utils";

export type Tile = { index: number; row: number; column: number; x: number; y: number; width: number; height: number };
export type GridOptions = { columns: number; rows: number; gap: number };

export const GRID_PRESETS: { id: string; label: string; columns: number; rows: number }[] = [
	{ id: "carousel", label: "Carousel strip (3 × 1)", columns: 3, rows: 1 },
	{ id: "thirds", label: "Nine squares (3 × 3)", columns: 3, rows: 3 },
	{ id: "quarters", label: "Quarters (2 × 2)", columns: 2, rows: 2 },
	{ id: "strips", label: "Four strips (1 × 4)", columns: 1, rows: 4 },
	{ id: "columns", label: "Two columns (2 × 1)", columns: 2, rows: 1 },
];

export const MAX_CELLS = 144;

const validate = (size: Size, options: GridOptions) => {
	if (size.width < 1 || size.height < 1) throw new Error("Pick an image first.");
	if (!Number.isInteger(options.columns) || options.columns < 1 || !Number.isInteger(options.rows) || options.rows < 1) {
		throw new Error("Rows and columns must be whole numbers of at least 1.");
	}
	if (options.columns * options.rows > MAX_CELLS) throw new Error(`Keep the grid under ${MAX_CELLS} tiles.`);
	if (!Number.isFinite(options.gap) || options.gap < 0) throw new Error("The gap cannot be negative.");
	const usableWidth = size.width - options.gap * (options.columns - 1);
	const usableHeight = size.height - options.gap * (options.rows - 1);
	if (usableWidth < options.columns || usableHeight < options.rows) throw new Error("The gap is too wide for this image.");
};

/** Split a picture into equal tiles. Any leftover pixels go to the earliest rows and columns. */
export const splitGrid = (size: Size, options: GridOptions): Tile[] => {
	validate(size, options);
	const { columns, rows, gap } = options;

	const span = (total: number, count: number) => {
		const usable = total - gap * (count - 1);
		const base = Math.floor(usable / count);
		const remainder = usable - base * count;
		const positions = Array.from({ length: count }, (_, index) => {
			const length = base + (index < remainder ? 1 : 0);
			return length;
		});
		const offsets: number[] = [];
		let cursor = 0;
		for (const length of positions) {
			offsets.push(cursor);
			cursor += length + gap;
		}
		return { lengths: positions, offsets };
	};

	const horizontal = span(size.width, columns);
	const vertical = span(size.height, rows);

	const tiles: Tile[] = [];
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			tiles.push({
				index: tiles.length + 1,
				row,
				column,
				x: horizontal.offsets[column],
				y: vertical.offsets[row],
				width: horizontal.lengths[column],
				height: vertical.lengths[row],
			});
		}
	}
	return tiles;
};

export const gridSummary = (tiles: Tile[]) => {
	if (tiles.length === 0) return { count: 0, widest: 0, tallest: 0, pixels: 0 };
	return {
		count: tiles.length,
		widest: Math.max(...tiles.map((tile) => tile.width)),
		tallest: Math.max(...tiles.map((tile) => tile.height)),
		pixels: tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0),
	};
};

export const tileFileName = (source: string, tile: Tile, extension: string) => {
	const base = source.replace(/\.[^./\\]+$/u, "").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase();
	const position = `r${tile.row + 1}c${tile.column + 1}`;
	return `${base || "image"}-${position}.${extension}`;
};

/** True when the tiles fill the image edge to edge, allowing for the gaps between them. */
export const coversWholeImage = (tiles: Tile[], size: Size, gap: number) => {
	if (tiles.length === 0) return false;
	const firstRow = tiles.filter((tile) => tile.row === 0);
	const firstColumn = tiles.filter((tile) => tile.column === 0);
	const spannedWidth = firstRow.reduce((sum, tile) => sum + tile.width, 0) + gap * (firstRow.length - 1);
	const spannedHeight = firstColumn.reduce((sum, tile) => sum + tile.height, 0) + gap * (firstColumn.length - 1);
	const inBounds = tiles.every((tile) => tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= size.width && tile.y + tile.height <= size.height);
	return inBounds && spannedWidth === size.width && spannedHeight === size.height;
};
