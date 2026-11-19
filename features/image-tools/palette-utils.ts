export type Rgb = { r: number; g: number; b: number };

export type PaletteColor = {
	hex: string;
	rgb: Rgb;
	share: number;
};

const toHexPair = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");

export const rgbToHex = ({ r, g, b }: Rgb) => `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`.toLowerCase();

export const rgbToHsl = ({ r, g, b }: Rgb) => {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const lightness = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l: Math.round(lightness * 100) };
	const delta = max - min;
	const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
	let hue = 0;
	if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
	else if (max === green) hue = ((blue - red) / delta + 2) / 6;
	else hue = ((red - green) / delta + 4) / 6;
	return { h: Math.round(hue * 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
};

type Bucket = { pixels: Rgb[]; share: number };

const averageColor = (pixels: Rgb[]): Rgb => {
	const sum = pixels.reduce((total, pixel) => ({ r: total.r + pixel.r, g: total.g + pixel.g, b: total.b + pixel.b }), { r: 0, g: 0, b: 0 });
	return { r: sum.r / pixels.length, g: sum.g / pixels.length, b: sum.b / pixels.length };
};

const widestChannel = (pixels: Rgb[]) => {
	const ranges = (["r", "g", "b"] as const).map((channel) => {
		let min = 255;
		let max = 0;
		for (const pixel of pixels) {
			if (pixel[channel] < min) min = pixel[channel];
			if (pixel[channel] > max) max = pixel[channel];
		}
		return { channel, range: max - min };
	});
	return ranges.sort((a, b) => b.range - a.range)[0];
};

/**
 * Median-cut quantisation: split the sampled pixels into `count` buckets along
 * their widest colour channel, then average each bucket.
 */
export const extractPalette = (
	pixels: ArrayLike<number>,
	count = 6,
	options: { alphaThreshold?: number; sampleStep?: number } = {},
): PaletteColor[] => {
	const alphaThreshold = options.alphaThreshold ?? 125;
	const sampleStep = Math.max(1, Math.floor(options.sampleStep ?? 1));
	const wanted = Math.max(1, Math.min(Math.round(count), 24));
	const colors: Rgb[] = [];
	for (let index = 0; index + 3 < pixels.length; index += 4 * sampleStep) {
		if (pixels[index + 3] < alphaThreshold) continue;
		colors.push({ r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] });
	}
	if (colors.length === 0) return [];
	const buckets: Bucket[] = [{ pixels: colors, share: 1 }];
	while (buckets.length < wanted) {
		let target = -1;
		let targetRange = 0;
		buckets.forEach((bucket, index) => {
			if (bucket.pixels.length < 2) return;
			const { range } = widestChannel(bucket.pixels);
			if (range > targetRange) {
				targetRange = range;
				target = index;
			}
		});
		if (target < 0) break;
		const bucket = buckets[target];
		const { channel } = widestChannel(bucket.pixels);
		const sorted = [...bucket.pixels].sort((a, b) => a[channel] - b[channel]);
		const middle = Math.floor(sorted.length / 2);
		buckets.splice(
			target,
			1,
			{ pixels: sorted.slice(0, middle), share: (bucket.share * middle) / sorted.length },
			{ pixels: sorted.slice(middle), share: (bucket.share * (sorted.length - middle)) / sorted.length },
		);
	}
	return buckets
		.filter((bucket) => bucket.pixels.length > 0)
		.map((bucket) => {
			const rgb = averageColor(bucket.pixels);
			return { hex: rgbToHex(rgb), rgb, share: bucket.share };
		})
		.sort((a, b) => b.share - a.share);
};

export const paletteToHexList = (palette: PaletteColor[]) => palette.map((color) => color.hex).join("\n");

export const paletteToCssVariables = (palette: PaletteColor[]) =>
	[":root {", ...palette.map((color, index) => `\t--color-${index + 1}: ${color.hex};`), "}"].join("\n");

/** Tailwind v4 CSS-first theme: drop into a stylesheet that imports tailwindcss. */
export const paletteToTailwindV4 = (palette: PaletteColor[], prefix = "palette") =>
	["@theme {", ...palette.map((color, index) => `\t--color-${prefix}-${index + 1}: ${color.hex};`), "}"].join("\n");

/** Utility names a v4 theme exposes, handy for copy under the swatches. */
export const tailwindV4ClassNames = (palette: PaletteColor[], prefix = "palette") =>
	palette.map((_, index) => `bg-${prefix}-${index + 1} text-${prefix}-${index + 1} border-${prefix}-${index + 1}`);

export const paletteToTailwind = (palette: PaletteColor[]) =>
	JSON.stringify(
		{
			theme: {
				extend: {
					colors: Object.fromEntries(palette.map((color, index) => [`palette-${index + 1}`, color.hex])),
				},
			},
		},
		null,
		2,
	);
