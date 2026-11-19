/** WCAG 2.2 contrast helpers, used by the design-token tests and the source sweep. */

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
export const AA_GRAPHIC = 3;

export const normaliseHex = (value: string) => {
	const clean = value.trim().replace(/^#/u, "");
	if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/iu.test(clean)) throw new Error(`"${value}" is not a 3 or 6 digit hex colour.`);
	return `#${clean.length === 3 ? [...clean].map((character) => character + character).join("") : clean}`.toLowerCase();
};

const channel = (value: number) => {
	const ratio = value / 255;
	return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex: string) => {
	const clean = normaliseHex(hex).slice(1);
	const [r, g, b] = [0, 2, 4].map((offset) => channel(Number.parseInt(clean.slice(offset, offset + 2), 16)));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Ratio between 1 (identical) and 21 (black on white). */
export const contrastRatio = (foreground: string, background: string) => {
	const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
	return (lighter + 0.05) / (darker + 0.05);
};

export const meetsContrast = (foreground: string, background: string, threshold = AA_NORMAL) => contrastRatio(foreground, background) >= threshold;

/** Every pair that fails, with the ratio attached, so a test failure says what to change. */
export const failingPairs = (pairs: { foreground: string; background: string; threshold?: number; label?: string }[]) =>
	pairs
		.map((pair) => ({ ...pair, ratio: contrastRatio(pair.foreground, pair.background) }))
		.filter((pair) => pair.ratio < (pair.threshold ?? AA_NORMAL))
		.map((pair) => `${pair.label ?? `${pair.foreground} on ${pair.background}`}: ${pair.ratio.toFixed(2)} < ${pair.threshold ?? AA_NORMAL}`);
