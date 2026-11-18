export type Anchor =
	| "top-left"
	| "top-center"
	| "top-right"
	| "middle-left"
	| "center"
	| "middle-right"
	| "bottom-left"
	| "bottom-center"
	| "bottom-right";

export const ANCHORS: { id: Anchor; label: string }[] = [
	{ id: "top-left", label: "Top left" },
	{ id: "top-center", label: "Top centre" },
	{ id: "top-right", label: "Top right" },
	{ id: "middle-left", label: "Middle left" },
	{ id: "center", label: "Centre" },
	{ id: "middle-right", label: "Middle right" },
	{ id: "bottom-left", label: "Bottom left" },
	{ id: "bottom-center", label: "Bottom centre" },
	{ id: "bottom-right", label: "Bottom right" },
];

export type Box = { width: number; height: number };
export type Point = { x: number; y: number };

const clampPosition = (value: number, limit: number) => Math.max(0, Math.min(value, Math.max(0, limit)));

/** Top-left corner for a watermark of `box` inside `canvas`, honouring the anchor and padding. */
export const anchorPosition = (canvas: Box, box: Box, anchor: Anchor, padding = 16): Point => {
	const [vertical, horizontal] = anchor.split("-") as [string, string];
	const x =
		horizontal === "left" ? padding : horizontal === "right" ? canvas.width - box.width - padding : (canvas.width - box.width) / 2;
	const y =
		vertical === "top" ? padding : vertical === "bottom" ? canvas.height - box.height - padding : (canvas.height - box.height) / 2;
	return { x: clampPosition(Math.round(x), canvas.width - box.width), y: clampPosition(Math.round(y), canvas.height - box.height) };
};

/** Diagonal rows of watermarks, spaced so the text stays readable but cannot be cropped away. */
export const tilePositions = (canvas: Box, box: Box, padding = 24, gap = 40): Point[] => {
	const stepX = Math.max(1, box.width + gap * 2);
	const stepY = Math.max(1, box.height + gap);
	const points: Point[] = [];
	for (let y = padding - box.height; y < canvas.height + box.height; y += stepY) {
		const rowIndex = Math.round((y - padding + box.height) / stepY);
		const offset = rowIndex % 2 === 0 ? padding : padding - stepX / 2;
		for (let x = offset; x < canvas.width; x += stepX) {
			points.push({ x: Math.round(x), y: Math.round(y) });
		}
	}
	return points;
};

export const clampOpacity = (value: number) => Math.min(1, Math.max(0.05, value));
export const clampFontSize = (value: number, canvas: Box) => Math.min(Math.max(1, Math.round(value)), Math.round(Math.min(canvas.width, canvas.height) / 2));

export const watermarkFileName = (fileName: string, extension: string) => `${fileName.replace(/\.[^./\\]+$/u, "")}-watermarked.${extension}`;
