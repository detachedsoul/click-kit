import type { Size } from "@/features/image-tools/crop-utils";

export type CompareOrientation = "horizontal" | "vertical";

export const ORIENTATIONS: { id: CompareOrientation; label: string }[] = [
	{ id: "horizontal", label: "Side by side" },
	{ id: "vertical", label: "Top to bottom" },
];

export const clampPosition = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50);

/** The canvas is big enough for both pictures, capped so a phone can still render it. */
export const compareCanvas = (before: Size, after: Size, limit = 4000): Size => {
	if (before.width < 1 || after.width < 1) throw new Error("Load both pictures to build the comparison.");
	return { width: Math.min(limit, Math.max(before.width, after.width)), height: Math.min(limit, Math.max(before.height, after.height)) };
};

/** Contain a picture inside the canvas without distortion, centred. */
export const containRect = (source: Size, box: Size) => {
	if (source.width < 1 || source.height < 1) throw new Error("This picture has no readable size.");
	const scale = Math.min(box.width / source.width, box.height / source.height);
	const width = source.width * scale;
	const height = source.height * scale;
	return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
};

/** The two halves an exported comparison is clipped to. */
export const compareHalves = (box: Size, position: number, orientation: CompareOrientation) => {
	const cut = clampPosition(position);
	if (orientation === "vertical") {
		const y = Math.round((box.height * cut) / 100);
		return {
			before: { x: 0, y: 0, width: box.width, height: y },
			after: { x: 0, y, width: box.width, height: box.height - y },
		};
	}
	const x = Math.round((box.width * cut) / 100);
	return {
		before: { x: 0, y: 0, width: x, height: box.height },
		after: { x, y: 0, width: box.width - x, height: box.height },
	};
};

/** CSS clip-path for the top layer in the live preview. */
export const revealClip = (position: number, orientation: CompareOrientation) => {
	const cut = clampPosition(position);
	return orientation === "vertical" ? `inset(0 0 ${100 - cut}% 0)` : `inset(0 0 0 ${cut}%)`;
};

/** Fraction of the pointer position along the preview box, as a percentage. */
export const pointerPercent = (point: { x: number; y: number }, rect: { left: number; top: number; width: number; height: number }, orientation: CompareOrientation) => {
	if (rect.width < 1 || rect.height < 1) return 50;
	const ratio = orientation === "vertical" ? (point.y - rect.top) / rect.height : (point.x - rect.left) / rect.width;
	return clampPosition(ratio * 100);
};

export const compareFileName = (beforeName: string, extension: string) => `${beforeName.replace(/\.[^./\\]+$/u, "")}-comparison.${extension}`;

/** Human wording for the size difference between two files. */
export const describeChange = (beforeBytes: number, afterBytes: number) => {
	const delta = afterBytes - beforeBytes;
	if (delta === 0) return "same size";
	const magnitude = Math.abs(delta);
	const size = magnitude < 1024 ? `${magnitude} B` : magnitude < 1024 * 1024 ? `${(magnitude / 1024).toFixed(1)} kB` : `${(magnitude / (1024 * 1024)).toFixed(2)} MB`;
	return delta < 0 ? `${size} smaller` : `${size} larger`;
};
