import type { Size } from "@/features/image-tools/crop-utils";

export type BatchTarget = { id: string; label: string; extension: string; lossy: boolean };

export const BATCH_TARGETS: BatchTarget[] = [
	{ id: "image/webp", label: "WebP (smallest)", extension: "webp", lossy: true },
	{ id: "image/jpeg", label: "JPEG (photos)", extension: "jpg", lossy: true },
	{ id: "image/png", label: "PNG (lossless)", extension: "png", lossy: false },
];

export const MAX_BATCH_FILES = 30;
export const MAX_BATCH_BYTES = 120 * 1024 * 1024;

export const targetFor = (id: string) => BATCH_TARGETS.find((target) => target.id === id) ?? BATCH_TARGETS[0];

/** Scale down to a maximum width, never up, and never past the canvas ceiling. */
export const fitWithin = (size: Size, maxWidth: number): Size => {
	if (size.width < 1 || size.height < 1) throw new Error("This file has no readable size.");
	if (!Number.isFinite(maxWidth) || maxWidth < 1) throw new Error("Maximum width must be at least 1 pixel.");
	const width = Math.min(size.width, Math.round(maxWidth), 8192);
	const scale = width / size.width;
	const height = Math.max(1, Math.round(size.height * scale));
	return { width, height };
};

export const isDownscaling = (size: Size, maxWidth: number) => size.width > maxWidth;

export const batchFileName = (source: string, extension: string) => {
	const base = source.replace(/\.[^./\\]+$/u, "").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase();
	return `${base || "image"}.${extension}`;
};

export const uniqueBatchName = (name: string, taken: Set<string>) => {
	if (!taken.has(name)) return name;
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name;
	const extension = dot > 0 ? name.slice(dot) : "";
	let index = 2;
	while (taken.has(`${base}-${index}${extension}`)) index += 1;
	return `${base}-${index}${extension}`;
};

export type BatchPlanItem = { file: File; outputName: string; target: BatchTarget };

/** Name each output and keep duplicates apart before any pixels are touched. */
export const planBatch = (files: File[], target: BatchTarget) => {
	if (files.length === 0) throw new Error("Add at least one image.");
	if (files.length > MAX_BATCH_FILES) throw new Error(`Convert up to ${MAX_BATCH_FILES} images at a time.`);
	const taken = new Set<string>();
	return files.map<BatchPlanItem>((file) => {
		const outputName = uniqueBatchName(batchFileName(file.name, target.extension), taken);
		taken.add(outputName);
		return { file, outputName, target };
	});
};

export const describeBatch = (files: File[]) => ({
	count: files.length,
	bytes: files.reduce((sum, file) => sum + file.size, 0),
});

export const batchZipName = (target: BatchTarget) => `converted-${target.extension}.zip`;
