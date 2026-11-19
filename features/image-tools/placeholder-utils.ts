export type PlaceholderOptions = {
	width: number;
	height: number;
	background: string;
	color: string;
	label: string;
	fontSize?: number;
};

export const PRESET_SIZES: { id: string; label: string; width: number; height: number }[] = [
	{ id: "social", label: "Social card (1200 × 630)", width: 1200, height: 630 },
	{ id: "open-graph", label: "Open Graph (1200 × 1200)", width: 1200, height: 1200 },
	{ id: "hd", label: "HD (1920 × 1080)", width: 1920, height: 1080 },
	{ id: "square", label: "Square (600 × 600)", width: 600, height: 600 },
	{ id: "portrait", label: "Portrait (1080 × 1350)", width: 1080, height: 1350 },
	{ id: "thumbnail", label: "Thumbnail (320 × 180)", width: 320, height: 180 },
	{ id: "banner", label: "Banner (1600 × 400)", width: 1600, height: 400 },
];

const escapeXml = (value: string) =>
	value
		.replace(/&/gu, "&amp;")
		.replace(/</gu, "&lt;")
		.replace(/>/gu, "&gt;")
		.replace(/"/gu, "&quot;")
		.replace(/'/gu, "&apos;");

export const clampDimension = (value: number, max = 8192) => Math.max(1, Math.min(Math.round(value), max));

/** Text scales with the shorter side so a 320×180 tile and a 1920×1080 banner both read well. */
export const placeholderFontSize = ({ width, height, fontSize }: Pick<PlaceholderOptions, "width" | "height" | "fontSize">) =>
	Math.max(10, Math.round(fontSize ?? Math.min(width, height) / 7));

/** A self-contained SVG placeholder — no uploads, no fonts, no network. */
export const placeholderSvg = (options: PlaceholderOptions) => {
	const width = clampDimension(options.width);
	const height = clampDimension(options.height);
	const fontSize = placeholderFontSize({ ...options, width, height });
	const label = options.label.trim() || `${width} × ${height}`;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(label)}">`,
		`\t<rect width="${width}" height="${height}" fill="${escapeXml(options.background)}"/>`,
		`\t<text x="50%" y="50%" fill="${escapeXml(options.color)}" font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`,
		"</svg>",
	].join("\n");
};

export const placeholderFileName = (options: PlaceholderOptions, extension: string) => {
	const slug = options.label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "");
	return `${slug || "placeholder"}-${clampDimension(options.width)}x${clampDimension(options.height)}.${extension}`;
};
