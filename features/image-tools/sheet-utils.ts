import type { Size } from "@/features/image-tools/crop-utils";

export type SheetOptions = {
	count: number;
	columns: number;
	cell: number;
	gap: number;
	padding: number;
	captionHeight: number;
};

export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 8;
export const MAX_SHEET_CELLS = 48;

/** A column count is the person's choice, not a function of how many pictures are queued. */
export const clampColumns = (value: number) => Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(Number.isFinite(value) ? value : MIN_COLUMNS)));

/** Rows needed for a set number of pictures, with the last row filled as far as it can be. */
export const sheetRows = (count: number, columns: number) => {
	if (!Number.isFinite(count) || count < 1) throw new Error("Add at least one image to build a sheet.");
	const width = Math.max(1, Math.round(columns));
	return Math.ceil(count / width);
};

/** Where each cell sits, including its sizing caption strip. */
export const sheetLayout = (options: SheetOptions) => {
	const { count, cell, gap, padding, captionHeight } = options;
	const columns = clampColumns(options.columns);
	if (!Number.isFinite(cell) || cell < 16) throw new Error("Cell size must be at least 16 pixels.");
	if (!Number.isFinite(gap) || gap < 0) throw new Error("Gap cannot be negative.");
	const rows = sheetRows(count, columns);
	const cellHeight = cell + captionHeight;
	const width = padding * 2 + columns * cell + (columns - 1) * gap;
	const height = padding * 2 + rows * cellHeight + (rows - 1) * gap;
	const cells = Array.from({ length: count }, (_, index) => {
		const column = index % columns;
		const row = Math.floor(index / columns);
		return {
			index,
			column,
			row,
			x: padding + column * (cell + gap),
			y: padding + row * (cellHeight + gap),
			size: { width: cell, height: cell } as Size,
			captionY: padding + row * (cellHeight + gap) + cell,
		};
	});
	return { columns, rows, width, height, cellHeight, cells };
};

/** Fill the cell without distortion: the image is cropped, never squashed. */
export const coverRect = (source: Size, cell: number) => {
	if (source.width < 1 || source.height < 1) throw new Error("This image has no readable size.");
	const scale = Math.max(cell / source.width, cell / source.height);
	const width = source.width * scale;
	const height = source.height * scale;
	return { x: (cell - width) / 2, y: (cell - height) / 2, width, height };
};

export const sheetFileName = (columns: number, rows: number, extension: string) => `contact-sheet-${columns}x${rows}.${extension}`;

export const captionFor = (name: string, max = 22) => {
	const cleaned = name.replace(/\.[^./\\]+$/u, "").replace(/\s+/gu, " ").trim();
	return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
};

export const clampCell = (value: number) => Math.max(16, Math.min(1200, Math.round(Number.isFinite(value) ? value : 240)));
export const clampGap = (value: number) => Math.max(0, Math.min(80, Math.round(Number.isFinite(value) ? value : 12)));

export const SHEET_BACKGROUNDS: { id: string; label: string }[] = [
	{ id: "#ffffff", label: "White" },
	{ id: "#f3f1e9", label: "Paper" },
	{ id: "#252820", label: "Ink" },
];
