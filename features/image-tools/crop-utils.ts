export type Size = { width: number; height: number };

export type CropRect = { x: number; y: number; width: number; height: number };

export type AspectPreset = { id: string; label: string; value: number | null };

export const ASPECT_PRESETS: AspectPreset[] = [
	{ id: "free", label: "Free", value: null },
	{ id: "square", label: "1:1", value: 1 },
	{ id: "four-three", label: "4:3", value: 4 / 3 },
	{ id: "three-two", label: "3:2", value: 3 / 2 },
	{ id: "sixteen-nine", label: "16:9", value: 16 / 9 },
	{ id: "portrait", label: "9:16", value: 9 / 16 },
	{ id: "stories", label: "4:5", value: 4 / 5 },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Largest centred rectangle of `aspect` (width / height) that fits inside `size`. */
export const fitAspectRect = (size: Size, aspect: number | null): CropRect => {
	const width = Math.max(1, Math.round(size.width));
	const height = Math.max(1, Math.round(size.height));
	if (!aspect) return { x: 0, y: 0, width, height };
	const source = width / height;
	if (source > aspect) {
		const cropWidth = Math.max(1, Math.round(height * aspect));
		return { x: Math.round((width - cropWidth) / 2), y: 0, width: cropWidth, height };
	}
	const cropHeight = Math.max(1, Math.round(width / aspect));
	return { x: 0, y: Math.round((height - cropHeight) / 2), width, height: cropHeight };
};

/** `zoom` of 2 halves the crop, `offset` (0–1 on each axis) moves it around the source. */
export const placeCrop = (size: Size, aspect: number | null, zoom = 1, offsetX = 0.5, offsetY = 0.5): CropRect => {
	const base = fitAspectRect(size, aspect);
	const factor = clamp(zoom, 1, 8);
	const width = Math.max(1, Math.round(base.width / factor));
	const height = Math.max(1, Math.round(base.height / factor));
	const x = Math.round(clamp(offsetX, 0, 1) * (size.width - width));
	const y = Math.round(clamp(offsetY, 0, 1) * (size.height - height));
	return clampRect({ x, y, width, height }, size);
};

/** Keep a crop inside the image and keep its numbers whole. */
export const clampRect = (rect: CropRect, size: Size): CropRect => {
	const width = Math.max(1, Math.min(Math.round(rect.width), Math.round(size.width)));
	const height = Math.max(1, Math.min(Math.round(rect.height), Math.round(size.height)));
	const x = clamp(Math.round(rect.x), 0, Math.max(0, Math.round(size.width) - width));
	const y = clamp(Math.round(rect.y), 0, Math.max(0, Math.round(size.height) - height));
	return { x, y, width, height };
};

/** Resize a crop rect by dragging a corner, keeping it inside the image. */
export const resizeRect = (rect: CropRect, size: Size, width: number, height: number): CropRect => clampRect({ ...rect, width, height }, size);

/** A tidy ratio label such as `16:9`, or `2.35:1` when the numbers are large. */
export const ratioLabel = ({ width, height }: Size) => {
	const divisor = gcd(Math.round(width), Math.round(height)) || 1;
	const left = Math.round(width) / divisor;
	const right = Math.round(height) / divisor;
	if (left <= 40 && right <= 40) return `${left}:${right}`;
	return `${(width / height).toFixed(2)}:1`;
};

/** Output format helpers shared by the crop and favicon tools. */
export const outputExtension = (mime: string) => (mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp");

export const stripExtension = (fileName: string) => fileName.replace(/\.[^./\\]+$/u, "");
