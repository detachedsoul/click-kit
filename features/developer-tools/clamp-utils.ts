export type ClampOptions = {
	minSize: number;
	maxSize: number;
	minViewport: number;
	maxViewport: number;
	rootFontSize: number;
	useRem: boolean;
};

export type ClampResult = {
	css: string;
	customProperty: string;
	slope: number;
	intercept: number;
	preferred: string;
	preferredRem: string;
	minRem: number;
	maxRem: number;
};

const round = (value: number) => Math.round(value * 1000) / 1000;
const trim = (value: number) => String(round(value));

export const buildClamp = (options: ClampOptions): ClampResult => {
	const { minSize, maxSize, minViewport, maxViewport, rootFontSize } = options;
	if (![minSize, maxSize, minViewport, maxViewport, rootFontSize].every((value) => Number.isFinite(value))) {
		throw new Error("Every value must be a number.");
	}
	if (minSize <= 0 || maxSize <= 0) throw new Error("Font sizes must be greater than zero.");
	if (minViewport <= 0 || maxViewport <= 0) throw new Error("Viewport widths must be greater than zero.");
	if (minViewport >= maxViewport) throw new Error("The minimum viewport must be smaller than the maximum viewport.");
	if (minSize > maxSize) throw new Error("The minimum font size cannot exceed the maximum.");
	if (rootFontSize <= 0) throw new Error("Root font size must be greater than zero.");
	const slope = (maxSize - minSize) / (maxViewport - minViewport);
	const intercept = minSize - slope * minViewport;
	const vw = round(slope * 100);
	const toUnit = (pixels: number) => (options.useRem ? `${trim(pixels / rootFontSize)}rem` : `${trim(pixels)}px`);
	const preferred = `calc(${trim(vw)}vw + ${toUnit(intercept)})`;
	const css = `clamp(${toUnit(minSize)}, ${preferred}, ${toUnit(maxSize)})`;
	return {
		css,
		customProperty: `--fluid-size: ${css};`,
		slope: round(slope),
		intercept: round(intercept),
		preferred,
		preferredRem: `calc(${trim(vw)}vw + ${trim(intercept / rootFontSize)}rem)`,
		minRem: round(minSize / rootFontSize),
		maxRem: round(maxSize / rootFontSize),
	};
};

export const clampPresets = [
	{ label: "Body copy", options: { minSize: 16, maxSize: 19, minViewport: 360, maxViewport: 1280, rootFontSize: 16, useRem: true } },
	{ label: "H1", options: { minSize: 32, maxSize: 64, minViewport: 360, maxViewport: 1280, rootFontSize: 16, useRem: true } },
	{ label: "H2", options: { minSize: 24, maxSize: 40, minViewport: 360, maxViewport: 1280, rootFontSize: 16, useRem: true } },
	{ label: "Small print", options: { minSize: 12, maxSize: 14, minViewport: 360, maxViewport: 1280, rootFontSize: 16, useRem: true } },
];

export const sizeAtViewport = (options: ClampOptions, viewport: number) => {
	const { minSize, maxSize, minViewport, maxViewport } = options;
	const slope = (maxSize - minSize) / (maxViewport - minViewport);
	return Math.min(maxSize, Math.max(minSize, minSize + slope * (viewport - minViewport)));
};
