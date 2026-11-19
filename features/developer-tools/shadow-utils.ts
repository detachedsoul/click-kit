export type ShadowLayer = {
	id: string;
	x: number;
	y: number;
	blur: number;
	spread: number;
	color: string;
	opacity: number;
	inset: boolean;
};

export const MAX_SHADOW = 200;

export const clampShadow = (value: number, min = -MAX_SHADOW, max = MAX_SHADOW) =>
	Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : 0;

export const clampOpacity = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 100);

export const isHex = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/iu.test(value.trim());

/** "#b64b31" + 32% → "rgba(182, 75, 49, 0.32)" */
export const rgbaFromHex = (hex: string, opacity = 100) => {
	const clean = hex.trim().replace(/^#/u, "");
	const full = clean.length === 3 ? [...clean].map((character) => character + character).join("") : clean;
	if (!/^[0-9a-f]{6}$/iu.test(full)) throw new Error(`"${hex}" is not a hex colour.`);
	const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
	const alpha = Math.round((clampOpacity(opacity) / 100) * 100) / 100;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const layerToCss = (layer: ShadowLayer) =>
	`${layer.inset ? "inset " : ""}${clampShadow(layer.x)}px ${clampShadow(layer.y)}px ${Math.max(0, clampShadow(layer.blur))}px ${clampShadow(layer.spread)}px ${rgbaFromHex(layer.color, layer.opacity)}`;

export const shadowCss = (layers: ShadowLayer[]) => {
	if (!layers.length) throw new Error("Add at least one shadow layer.");
	return layers.map(layerToCss).join(", ");
};

/** The arbitrary-value form people paste into Tailwind. */
export const shadowTailwind = (layers: ShadowLayer[]) => `shadow-[${shadowCss(layers).replace(/,\s+/gu, ",").replace(/\s+/gu, "_")}]`;

export const shadowRule = (layers: ShadowLayer[], selector = ".card") => `${selector} {\n\tbox-shadow: ${shadowCss(layers)};\n}`;

export type ShadowPreset = { id: string; label: string; layers: Omit<ShadowLayer, "id">[] };

export const SHADOW_PRESETS: ShadowPreset[] = [
	{ id: "soft", label: "Soft card", layers: [{ x: 0, y: 8, blur: 24, spread: -6, color: "#252820", opacity: 12, inset: false }] },
	{ id: "lifted", label: "Lifted", layers: [{ x: 0, y: 18, blur: 40, spread: -12, color: "#252820", opacity: 18, inset: false }] },
	{ id: "crisp", label: "Crisp edge", layers: [{ x: 4, y: 4, blur: 0, spread: 0, color: "#252820", opacity: 100, inset: false }] },
	{
		id: "stacked",
		label: "Stacked",
		layers: [
			{ x: 0, y: 1, blur: 2, spread: 0, color: "#252820", opacity: 8, inset: false },
			{ x: 0, y: 8, blur: 24, spread: -8, color: "#252820", opacity: 16, inset: false },
			{ x: 0, y: 24, blur: 48, spread: -16, color: "#252820", opacity: 20, inset: false },
		],
	},
	{ id: "pressed", label: "Pressed in", layers: [{ x: 0, y: 2, blur: 6, spread: 0, color: "#252820", opacity: 22, inset: true }] },
	{ id: "glow", label: "Warm glow", layers: [{ x: 0, y: 0, blur: 32, spread: 4, color: "#b64b31", opacity: 55, inset: false }] },
];

export const presetLayers = (preset: ShadowPreset, idPrefix = "layer"): ShadowLayer[] =>
	preset.layers.map((layer, index) => ({ ...layer, id: `${idPrefix}-${index + 1}` }));

export const describeShadow = (layers: ShadowLayer[]) => {
	if (!layers.length) return "No shadow layers yet.";
	const insets = layers.filter((layer) => layer.inset).length;
	return `${layers.length} layer${layers.length === 1 ? "" : "s"}${insets ? `, ${insets} inset` : ""}`;
};
