export type Rgb = { r: number; g: number; b: number };
export type Swatch = { hex: string; x: number; y: number };

export const MAX_SWATCHES = 12;
export const SAME_COLOUR_DISTANCE = 10;

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const toHex = ({ r, g, b }: Rgb) =>
	`#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;

export const hexToRgb = (hex: string): Rgb => {
	const value = hex.trim().replace(/^#/u, "");
	if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/iu.test(value)) throw new Error(`"${hex}" is not a hex colour.`);
	const full = value.length === 3 ? [...value].map((character) => character + character).join("") : value;
	return {
		r: Number.parseInt(full.slice(0, 2), 16),
		g: Number.parseInt(full.slice(2, 4), 16),
		b: Number.parseInt(full.slice(4, 6), 16),
	};
};

export const formatRgb = ({ r, g, b }: Rgb) => `${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}`;

export const formatHsl = ({ r, g, b }: Rgb) => {
	const [red, green, blue] = [r, g, b].map((channel) => clampByte(channel) / 255);
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const lightness = (max + min) / 2;
	const delta = max - min;
	if (delta === 0) return `hsl(0, 0%, ${Math.round(lightness * 100)}%)`;
	const saturation = delta / (1 - Math.abs(2 * lightness - 1));
	let hue: number;
	if (max === red) hue = ((green - blue) / delta) % 6;
	else if (max === green) hue = (blue - red) / delta + 2;
	else hue = (red - green) / delta + 4;
	hue *= 60;
	if (hue < 0) hue += 360;
	return `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`;
};

const linear = (channel: number) => {
	const value = clampByte(channel) / 255;
	return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

export const luminance = ({ r, g, b }: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** Black or white label for text sitting on the colour. */
export const textOn = (rgb: Rgb) => (luminance(rgb) > 0.35 ? "#252820" : "#ffffff");

/** Rough perceptual distance — enough to skip repeated pixels without a full Lab conversion. */
export const colourDistance = (left: Rgb, right: Rgb) => {
	const averageRed = (left.r + right.r) / 2;
	const deltaRed = left.r - right.r;
	const deltaGreen = left.g - right.g;
	const deltaBlue = left.b - right.b;
	return Math.sqrt((2 + averageRed / 256) * deltaRed ** 2 + 4 * deltaGreen ** 2 + (2 + (255 - averageRed) / 256) * deltaBlue ** 2) / 3;
};

export const isSameColour = (left: Rgb, right: Rgb) => colourDistance(left, right) < SAME_COLOUR_DISTANCE;

/** Add a swatch unless a near-identical one is already in the list. */
export const addSwatch = (swatches: Swatch[], swatch: Swatch, max = MAX_SWATCHES) => {
	const rgb = hexToRgb(swatch.hex);
	if (swatches.some((existing) => isSameColour(hexToRgb(existing.hex), rgb))) return swatches;
	return [swatch, ...swatches].slice(0, max);
};

/** Read one pixel out of RGBA data, with the channel order browsers use. */
export const samplePixel = (data: Uint8ClampedArray, width: number, x: number, y: number): Rgb & { a: number } => {
	const column = Math.max(0, Math.min(width - 1, Math.round(x)));
	const rows = Math.floor(data.length / 4 / width);
	const row = Math.max(0, Math.min(rows - 1, Math.round(y)));
	const offset = (row * width + column) * 4;
	return { r: data[offset] ?? 0, g: data[offset + 1] ?? 0, b: data[offset + 2] ?? 0, a: data[offset + 3] ?? 255 };
};

export const swatchesToCss = (swatches: Swatch[], prefix = "colour") =>
	[":root {", ...swatches.map((swatch, index) => `\t--${prefix}-${index + 1}: ${swatch.hex};`), "}"].join("\n");

export const swatchesToHexList = (swatches: Swatch[]) => swatches.map((swatch) => swatch.hex).join("\n");
