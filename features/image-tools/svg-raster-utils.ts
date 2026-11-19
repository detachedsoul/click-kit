export type SvgBox = {
	width: number | null;
	height: number | null;
	viewBox: { width: number; height: number } | null;
};

export type RasterPlan = { width: number; height: number; scale: number };

const NUMBER = /^(-?\d*\.?\d+)(?:px)?$/iu;

const parseLength = (value: string | undefined): number | null => {
	if (!value) return null;
	const match = NUMBER.exec(value.trim());
	if (!match) return null;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Read width/height/viewBox out of the opening <svg> tag. Percentages are ignored. */
export const parseSvgBox = (markup: string): SvgBox => {
	const opening = /<svg\b([^>]*)>/iu.exec(markup)?.[1] ?? "";
	const attribute = (name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu").exec(opening)?.[1];
	const viewBoxRaw = attribute("viewBox");
	let viewBox: SvgBox["viewBox"] = null;
	if (viewBoxRaw) {
		const parts = viewBoxRaw.split(/[\s,]+/u).map((part) => Number(part));
		if (parts.length === 4 && parts.every((part) => Number.isFinite(part)) && parts[2] > 0 && parts[3] > 0) {
			viewBox = { width: parts[2], height: parts[3] };
		}
	}
	return { width: parseLength(attribute("width")), height: parseLength(attribute("height")), viewBox };
};

/** Work out the pixel size for a raster export, keeping the aspect ratio and capping the longest side. */
export const rasterPlan = (box: SvgBox, targetWidth: number, maxSide = 8192): RasterPlan => {
	const fallback = box.width && box.height ? { width: box.width, height: box.height } : box.viewBox ?? { width: 300, height: 150 };
	const safeWidth = Math.min(Math.max(Math.round(targetWidth), 1), maxSide);
	const ratio = fallback.height / fallback.width;
	let width = safeWidth;
	let height = Math.max(1, Math.round(safeWidth * ratio));
	if (height > maxSide) {
		height = maxSide;
		width = Math.max(1, Math.round(maxSide / ratio));
	}
	return { width, height, scale: width / fallback.width };
};

/** A data URL that works offline and inside the sandboxed preview iframe. */
export const svgDataUrl = (markup: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.trim())}`;

/** Anything the browser cannot load into a canvas: external images, remote fonts, or scripts. */
export const svgRasterWarnings = (markup: string) => {
	const warnings: string[] = [];
	if (/<script\b/iu.test(markup)) warnings.push("Scripts inside the SVG are ignored when it is drawn to a canvas.");
	if (/\b(?:href|src)\s*=\s*["'](?:https?:)?\/\//iu.test(markup)) warnings.push("Remote images and fonts may not load, and can stop the export from working.");
	if (/\bfilter\s*=\s*["']url\(#/iu.test(markup)) warnings.push("Some SVG filters render differently in canvas; check the exported PNG.");
	return warnings;
};
