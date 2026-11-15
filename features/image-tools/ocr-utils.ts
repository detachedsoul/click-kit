export type CropPercent = { left: number; top: number; width: number; height: number };
export const clampCrop = (crop: CropPercent): CropPercent => {
	const left = Math.max(0, Math.min(99, Number.isFinite(crop.left) ? crop.left : 0));
	const top = Math.max(0, Math.min(99, Number.isFinite(crop.top) ? crop.top : 0));
	return {
		left,
		top,
		width: Math.max(1, Math.min(100 - left, Number.isFinite(crop.width) ? crop.width : 100)),
		height: Math.max(1, Math.min(100 - top, Number.isFinite(crop.height) ? crop.height : 100)),
	};
};

export const cropPixels = (width: number, height: number, crop: CropPercent) => {
	const safe = clampCrop(crop);
	const x = Math.floor(width * safe.left / 100);
	const y = Math.floor(height * safe.top / 100);
	return {
		x,
		y,
		width: Math.max(1, Math.min(width - x, Math.round(width * safe.width / 100))),
		height: Math.max(1, Math.min(height - y, Math.round(height * safe.height / 100))),
	};
};

export const enhancePixels = (data: Uint8ClampedArray, threshold: number) => {
	for (let i = 0; i < data.length; i += 4) {
		const grey = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
		const value = grey >= threshold ? 255 : 0;
		data[i] = value;
		data[i + 1] = value;
		data[i + 2] = value;
	}
	return data;
};

export const makeOcrCanvas = (image: HTMLImageElement, rotation: number, crop: CropPercent, threshold: number | null) => {
	const turn = ((rotation % 360) + 360) % 360;
	const rotatedWidth = turn % 180 === 0 ? image.naturalWidth : image.naturalHeight;
	const rotatedHeight = turn % 180 === 0 ? image.naturalHeight : image.naturalWidth;
	const rotated = document.createElement("canvas");
	rotated.width = rotatedWidth;
	rotated.height = rotatedHeight;
	const context = rotated.getContext("2d");
	if (!context) throw new Error("Canvas image processing is unavailable in this browser.");
	context.translate(rotatedWidth / 2, rotatedHeight / 2);
	context.rotate(turn * Math.PI / 180);
	context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
	const rect = cropPixels(rotatedWidth, rotatedHeight, crop);
	const output = document.createElement("canvas");
	output.width = rect.width;
	output.height = rect.height;
	const outContext = output.getContext("2d", { willReadFrequently: true });
	if (!outContext) throw new Error("Canvas image processing is unavailable in this browser.");
	outContext.drawImage(rotated, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
	if (threshold !== null) {
		const pixels = outContext.getImageData(0, 0, rect.width, rect.height);
		enhancePixels(pixels.data, threshold);
		outContext.putImageData(pixels, 0, 0);
	}
	return output;
};
