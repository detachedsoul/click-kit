const gcd = (left: number, right: number): number => (right === 0 ? Math.abs(left) : gcd(right, left % right));

export const commonRatios = [
	{ label: "1:1", width: 1, height: 1 },
	{ label: "4:3", width: 4, height: 3 },
	{ label: "3:2", width: 3, height: 2 },
	{ label: "16:10", width: 16, height: 10 },
	{ label: "16:9", width: 16, height: 9 },
	{ label: "21:9", width: 21, height: 9 },
	{ label: "2:3", width: 2, height: 3 },
	{ label: "3:4", width: 3, height: 4 },
	{ label: "9:16", width: 9, height: 16 },
	{ label: "9:21", width: 9, height: 21 },
];

const validate = (value: number, name: string) => {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
};

export const simplifyRatio = (width: number, height: number) => {
	validate(width, "Width");
	validate(height, "Height");
	const divisor = gcd(Math.round(width * 1000), Math.round(height * 1000));
	const simplifiedWidth = Math.round(width * 1000) / divisor;
	const simplifiedHeight = Math.round(height * 1000) / divisor;
	const decimal = width / height;
	const closest = [...commonRatios].sort((left, right) => Math.abs(left.width / left.height - decimal) - Math.abs(right.width / right.height - decimal))[0];
	return {
		width: simplifiedWidth,
		height: simplifiedHeight,
		label: `${simplifiedWidth}:${simplifiedHeight}`,
		decimal: Math.round(decimal * 10000) / 10000,
		closest,
		exact: Math.abs(closest.width / closest.height - decimal) < 0.0001,
		difference: Math.round((decimal - closest.width / closest.height) * 10000) / 10000,
	};
};

export const scaleByWidth = (width: number, ratioWidth: number, ratioHeight: number) => {
	validate(width, "Width");
	validate(ratioWidth, "Ratio width");
	validate(ratioHeight, "Ratio height");
	return { width: Math.round(width), height: Math.round((width * ratioHeight) / ratioWidth) };
};

export const scaleByHeight = (height: number, ratioWidth: number, ratioHeight: number) => {
	validate(height, "Height");
	validate(ratioWidth, "Ratio width");
	validate(ratioHeight, "Ratio height");
	return { width: Math.round((height * ratioWidth) / ratioHeight), height: Math.round(height) };
};

export const fitWithin = (maxWidth: number, maxHeight: number, ratioWidth: number, ratioHeight: number) => {
	validate(maxWidth, "Max width");
	validate(maxHeight, "Max height");
	validate(ratioWidth, "Ratio width");
	validate(ratioHeight, "Ratio height");
	const width = Math.min(maxWidth, (maxHeight * ratioWidth) / ratioHeight);
	return { width: Math.round(width), height: Math.round((width * ratioHeight) / ratioWidth), cropped: false };
};

export const coverBox = (boxWidth: number, boxHeight: number, ratioWidth: number, ratioHeight: number) => {
	validate(boxWidth, "Box width");
	validate(boxHeight, "Box height");
	validate(ratioWidth, "Ratio width");
	validate(ratioHeight, "Ratio height");
	const height = Math.max(boxHeight, (boxWidth * ratioHeight) / ratioWidth);
	return { width: Math.round((height * ratioWidth) / ratioHeight), height: Math.round(height) };
};

export const scaleTable = (ratioWidth: number, ratioHeight: number, widths: number[] = [640, 1280, 1920, 2560]) =>
	widths.map((width) => {
		const scaled = scaleByWidth(width, ratioWidth, ratioHeight);
		return `${width} × ${scaled.height}`;
	});
