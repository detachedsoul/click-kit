export type Rgb = { r: number; g: number; b: number };
export type Shade = { label: string; hex: string; name: string };

export const SHADE_LABELS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const;
export const SHADE_STEPS = SHADE_LABELS.length;

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const parseHex = (input: string): Rgb => {
	const value = input.trim().replace(/^#/u, "");
	if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/iu.test(value)) throw new Error(`"${input}" is not a 3 or 6 digit hex colour.`);
	const expanded = value.length === 3 ? value.split("").map((character) => character + character).join("") : value;
	return {
		r: Number.parseInt(expanded.slice(0, 2), 16),
		g: Number.parseInt(expanded.slice(2, 4), 16),
		b: Number.parseInt(expanded.slice(4, 6), 16),
	};
};

export const toHex = ({ r, g, b }: Rgb) =>
	`#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`;

export const toRgbString = ({ r, g, b }: Rgb) => `rgb(${clampChannel(r)} ${clampChannel(g)} ${clampChannel(b)})`;

/** Linear mix in sRGB, which is what most design tools show for a tint or shade. */
export const mixColours = (from: Rgb, to: Rgb, amount: number): Rgb => {
	const ratio = Math.max(0, Math.min(1, amount));
	return {
		r: from.r + (to.r - from.r) * ratio,
		g: from.g + (to.g - from.g) * ratio,
		b: from.b + (to.b - from.b) * ratio,
	};
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/**
 * A ten-step ramp from 50 (lightest) to 900 (darkest) with the source colour
 * sitting exactly at 500. `strength` controls how far the ends travel.
 */
export const buildShades = (input: string, strength = 0.9): Shade[] => {
	if (!Number.isFinite(strength) || strength <= 0 || strength > 1) throw new Error("Strength must be between 0 and 1.");
	const base = parseHex(input);
	const anchor = SHADE_LABELS.indexOf("500");
	return SHADE_LABELS.map((label, index) => {
		const distance = index - anchor;
		const hex =
			distance === 0
				? toHex(base)
				: distance < 0
					? toHex(mixColours(base, WHITE, (Math.abs(distance) / anchor) * strength))
					: toHex(mixColours(base, BLACK, (distance / (SHADE_LABELS.length - 1 - anchor)) * strength));
		return { label, hex, name: hex };
	});
};

export const shadeVariables = (shades: Shade[], prefix = "colour") =>
	[":root {", ...shades.map((shade) => `\t--${prefix}-${shade.label}: ${shade.hex};`), "}"].join("\n");

export const tailwindShades = (shades: Shade[]) =>
	["module.exports = {", "\ttheme: {", "\t\textend: {", "\t\t\tcolors: {", "\t\t\t\tbrand: {", ...shades.map((shade) => `\t\t\t\t\t${shade.label}: "${shade.hex}",`), "\t\t\t\t},", "\t\t\t},", "\t\t},", "\t},", "};"].join("\n");

/** Black or white text over a swatch, whichever reads better. */
export const readableTextOn = (hex: string) => {
	const { r, g, b } = parseHex(hex);
	const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
	return luminance > 0.62 ? "#1b1c18" : "#ffffff";
};

export const shadeFileName = (input: string, extension: string) => {
	const slug = input
		.trim()
		.replace(/^#/u, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "");
	return `${slug || "colour"}-shades.${extension}`;
};
