export type FilterValues = {
	grayscale: number;
	sepia: number;
	invert: number;
	blur: number;
	brightness: number;
	contrast: number;
	saturate: number;
};

export const DEFAULT_FILTERS: FilterValues = {
	grayscale: 0,
	sepia: 0,
	invert: 0,
	blur: 0,
	brightness: 100,
	contrast: 100,
	saturate: 100,
};

export const FILTER_CONTROLS: { key: keyof FilterValues; label: string; min: number; max: number; step: number; unit: string }[] = [
	{ key: "grayscale", label: "Grayscale", min: 0, max: 100, step: 1, unit: "%" },
	{ key: "sepia", label: "Sepia", min: 0, max: 100, step: 1, unit: "%" },
	{ key: "invert", label: "Invert", min: 0, max: 100, step: 1, unit: "%" },
	{ key: "blur", label: "Blur", min: 0, max: 20, step: 0.5, unit: "px" },
	{ key: "brightness", label: "Brightness", min: 20, max: 180, step: 1, unit: "%" },
	{ key: "contrast", label: "Contrast", min: 20, max: 180, step: 1, unit: "%" },
	{ key: "saturate", label: "Saturation", min: 0, max: 250, step: 1, unit: "%" },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The CSS filter string used for preview and canvas export alike. */
export const cssFilter = (values: FilterValues) =>
	[
		`grayscale(${clamp(Math.round(values.grayscale), 0, 100)}%)`,
		`sepia(${clamp(Math.round(values.sepia), 0, 100)}%)`,
		`invert(${clamp(Math.round(values.invert), 0, 100)}%)`,
		`blur(${clamp(values.blur, 0, 20)}px)`,
		`brightness(${clamp(Math.round(values.brightness), 20, 180)}%)`,
		`contrast(${clamp(Math.round(values.contrast), 20, 180)}%)`,
		`saturate(${clamp(Math.round(values.saturate), 0, 250)}%)`,
	].join(" ");

export const isIdentity = (values: FilterValues) =>
	(["grayscale", "sepia", "invert"] as const).every((key) => values[key] === 0) &&
	values.blur === 0 &&
	values.brightness === 100 &&
	values.contrast === 100 &&
	values.saturate === 100;

export const describeFilters = (values: FilterValues) => {
	const changed = FILTER_CONTROLS.filter((control) => values[control.key] !== DEFAULT_FILTERS[control.key]);
	if (changed.length === 0) return "No filters applied";
	return changed.map((control) => `${control.label.toLowerCase()} ${values[control.key]}${control.unit}`).join(", ");
};

export const filterFileName = (fileName: string, extension: string) => `${fileName.replace(/\.[^./\\]+$/u, "")}-filtered.${extension}`;
