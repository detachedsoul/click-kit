export type Rotation = 0 | 90 | 180 | 270;

export type Size = { width: number; height: number };

export const nextRotation = (current: Rotation, step: 90 | -90): Rotation => (((current + step) % 360) + 360) % 360 as Rotation;

export const rotatedSize = (size: Size, rotation: Rotation): Size =>
	rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : { width: size.width, height: size.height };

export const isUntouched = (rotation: Rotation, flipX: boolean, flipY: boolean) => rotation === 0 && !flipX && !flipY;

/** "Rotated 90° clockwise, flipped horizontally" — used for the live status line. */
export const orientationLabel = (rotation: Rotation, flipX: boolean, flipY: boolean) => {
	const parts: string[] = [];
	if (rotation) parts.push(`Turned ${rotation}° clockwise`);
	if (flipX) parts.push("flipped horizontally");
	if (flipY) parts.push("flipped vertically");
	return parts.length ? parts.join(", ") : "Original orientation";
};

/**
 * Draw `image` onto `context` with the chosen rotation and flips.
 * Callers size the canvas with `rotatedSize` first.
 */
export const drawTransformed = (
	context: CanvasRenderingContext2D,
	image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number },
	size: Size,
	rotation: Rotation,
	flipX: boolean,
	flipY: boolean,
) => {
	const sourceWidth = image.naturalWidth ?? image.width ?? size.width;
	const sourceHeight = image.naturalHeight ?? image.height ?? size.height;
	const output = rotatedSize({ width: sourceWidth, height: sourceHeight }, rotation);
	context.save();
	context.translate(output.width / 2, output.height / 2);
	context.rotate((rotation * Math.PI) / 180);
	context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
	context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
	context.restore();
	return output;
};
