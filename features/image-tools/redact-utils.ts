import type { Size } from "@/features/image-tools/crop-utils";

export type RegionMode = "solid" | "pixelate" | "blur";
export type Point = { x: number; y: number };
export type Region = { id: string; x: number; y: number; width: number; height: number; mode: RegionMode; strength?: number };

export const REGION_MODES: { id: RegionMode; label: string; hint: string }[] = [
	{ id: "solid", label: "Solid block", hint: "Fills the area with black. The safest choice for text." },
	{ id: "pixelate", label: "Pixelate", hint: "Mosaic blocks — still readable if the area is large and the blocks are small." },
	{ id: "blur", label: "Blur", hint: "Softens the area. Light blur can sometimes be reversed; use a strong setting." },
];

export const MIN_REGION = 6;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const round = (value: number) => Math.round(value);

/** Drag in any direction and get a positive rectangle that stays inside the image. */
export const normaliseRegion = (from: Point, to: Point, size: Size): Omit<Region, "id" | "mode"> => {
	if (size.width < 1 || size.height < 1) throw new Error("Pick an image first.");
	const x1 = clamp(round(from.x), 0, size.width);
	const y1 = clamp(round(from.y), 0, size.height);
	const x2 = clamp(round(to.x), 0, size.width);
	const y2 = clamp(round(to.y), 0, size.height);
	return {
		x: Math.min(x1, x2),
		y: Math.min(y1, y2),
		width: Math.abs(x2 - x1),
		height: Math.abs(y2 - y1),
	};
};

export const isUsableRegion = (region: { width: number; height: number }) => region.width >= MIN_REGION && region.height >= MIN_REGION;

export const moveRegion = (region: Region, dx: number, dy: number, size: Size): Region => ({
	...region,
	x: clamp(round(region.x + dx), 0, Math.max(0, size.width - region.width)),
	y: clamp(round(region.y + dy), 0, Math.max(0, size.height - region.height)),
});

export const resizeRegion = (region: Region, dx: number, dy: number, size: Size): Region => ({
	...region,
	width: clamp(round(region.width + dx), MIN_REGION, size.width - region.x),
	height: clamp(round(region.height + dy), MIN_REGION, size.height - region.y),
});

export const MIN_STRENGTH = 5;
export const MAX_STRENGTH = 100;
export const DEFAULT_STRENGTH = 60;

/** More strength always means more hiding. */
export const clampStrength = (value: number) => clamp(round(Number.isFinite(value) ? value : DEFAULT_STRENGTH), MIN_STRENGTH, MAX_STRENGTH);

/** An area keeps its own strength; older regions without one fall back to the default. */
export const regionStrength = (region: Region) => clampStrength(region.strength ?? DEFAULT_STRENGTH);

/** Edge of one mosaic block in image pixels: more strength, bigger blocks, fewer of them. */
export const pixelBlockSize = (region: Region, strength = regionStrength(region)) =>
	Math.max(2, round((Math.min(region.width, region.height) * clampStrength(strength)) / 200));

/** Blur radius in image pixels: more strength, softer and wider. */
export const blurRadius = (region: Region, strength = regionStrength(region)) =>
	Math.max(2, round((Math.min(region.width, region.height) * clampStrength(strength)) / 300));

export const coveragePercent = (regions: Region[], size: Size) => {
	if (size.width < 1 || size.height < 1) return 0;
	const covered = regions.reduce((sum, region) => sum + region.width * region.height, 0);
	return Math.min(100, Math.round((covered / (size.width * size.height)) * 1000) / 10);
};

export const describeRegions = (regions: Region[], size: Size) => {
	if (regions.length === 0) return "No areas marked yet.";
	const covered = regions.length === 1 ? "1 area" : `${regions.length} areas`;
	return `${covered} covering ${coveragePercent(regions, size)}% of the image.`;
};

/** Turn a pointer position into image pixels, whatever size the picture is drawn at. */
export const pointerToImage = (point: Point, rect: { left: number; top: number; width: number; height: number }, size: Size): Point => {
	if (rect.width < 1 || rect.height < 1) return { x: 0, y: 0 };
	return {
		x: clamp(((point.x - rect.left) / rect.width) * size.width, 0, size.width),
		y: clamp(((point.y - rect.top) / rect.height) * size.height, 0, size.height),
	};
};

/** Percentages for drawing the same rectangle over a scaled preview. */
export const regionPercentStyle = (region: Region, size: Size) => ({
	left: `${(region.x / size.width) * 100}%`,
	top: `${(region.y / size.height) * 100}%`,
	width: `${(region.width / size.width) * 100}%`,
	height: `${(region.height / size.height) * 100}%`,
});

export const redactedFileName = (source: string, extension: string) => {
	const base = source.replace(/\.[^./\\]+$/u, "").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase();
	return `${base || "image"}-redacted.${extension}`;
};
