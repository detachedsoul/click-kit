import type { Size } from "@/features/image-tools/crop-utils";

export type FrameBackground = { id: string; label: string; from: string; to: string | null };
export type FrameAspect = "auto" | "square" | "portrait" | "wide";

export const FRAME_BACKGROUNDS: FrameBackground[] = [
	{ id: "paper", label: "Warm paper", from: "#f3f1e9", to: null },
	{ id: "forest", label: "Forest", from: "#263b34", to: null },
	{ id: "dusk", label: "Dusk", from: "#3b2f4a", to: "#7a4b6d" },
	{ id: "sunrise", label: "Sunrise", from: "#f0c987", to: "#b64b31" },
	{ id: "sea", label: "Sea", from: "#1f4e5f", to: "#4a8f8b" },
	{ id: "ink", label: "Ink", from: "#252820", to: "#4b4f45" },
];

export const FRAME_ASPECTS: { id: FrameAspect; label: string; ratio: number | null }[] = [
	{ id: "auto", label: "Same as image", ratio: null },
	{ id: "square", label: "Square 1:1", ratio: 1 },
	{ id: "portrait", label: "Portrait 4:5", ratio: 4 / 5 },
	{ id: "wide", label: "Wide 16:9", ratio: 16 / 9 },
];

export type FrameOptions = {
	image: Size;
	padding: number;
	aspect: FrameAspect;
	radius: number;
	shadow: boolean;
};

export type FrameLayout = {
	canvas: Size;
	image: Size & { x: number; y: number };
	radius: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Where the screenshot sits inside the framed canvas, including padding and any forced aspect ratio. */
export const frameLayout = ({ image, padding, aspect, radius, shadow }: FrameOptions): FrameLayout => {
	if (image.width < 1 || image.height < 1) throw new Error("Pick an image first.");
	if (!Number.isFinite(padding) || padding < 0 || padding > 40) throw new Error("Padding must be between 0 and 40 percent.");
	const ratio = FRAME_ASPECTS.find((option) => option.id === aspect)?.ratio ?? null;
	const pad = clamp(padding, 0, 40) / 100;
	const baseWidth = image.width * (1 + pad * 2);
	const baseHeight = image.height * (1 + pad * 2);
	const canvas = ratio === null
		? { width: Math.round(baseWidth), height: Math.round(baseHeight) }
		: (() => {
				const widthFromHeight = Math.round(baseHeight * ratio);
				const heightFromWidth = Math.round(baseWidth / ratio);
				// Grow whichever side is short so the picture keeps its size and the frame fills out.
				return widthFromHeight >= baseWidth ? { width: widthFromHeight, height: Math.round(baseHeight) } : { width: Math.round(baseWidth), height: heightFromWidth };
			})();
	const x = Math.round((canvas.width - image.width) / 2);
	const y = Math.round((canvas.height - image.height) / 2);
	const shortest = Math.min(image.width, image.height);
	const shadowRoom = shadow ? Math.round(shortest * 0.045) : 0;
	return {
		canvas,
		image: { width: image.width, height: image.height, x, y: Math.max(shadowRoom, y) },
		radius: Math.round(clamp(radius, 0, 100) / 100 * (shortest / 2)),
	};
};

/** Gradient stops for a background preset, used for both the canvas and the CSS preview. */
export const backgroundStops = (background: FrameBackground) => (background.to ? [background.from, background.to] : [background.from]);

export const backgroundCss = (background: FrameBackground) =>
	background.to ? `linear-gradient(145deg, ${background.from}, ${background.to})` : background.from;

/** Black or white caption-safe text over the framed background. */
export const frameTextOn = (background: FrameBackground) => {
	const hex = background.from.replace("#", "");
	const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? "#252820" : "#f6f4eb";
};

export const frameFileName = (source: string, extension: string) => {
	const base = source.replace(/\.[^./\\]+$/u, "").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase();
	return `${base || "image"}-framed.${extension}`;
};
