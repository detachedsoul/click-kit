export type GradientStop = { color: string; position: number };
export type GradientType = "linear" | "radial" | "conic";

export type GradientOptions = {
	type: GradientType;
	angle: number;
	stops: GradientStop[];
	repeating: boolean;
	shape: "circle" | "ellipse";
};

const colorPattern =
	/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/iu;

export const isColour = (value: string) => colorPattern.test(value.trim());

export const sortStops = (stops: GradientStop[]) => [...stops].sort((left, right) => left.position - right.position);

export const normaliseStops = (stops: GradientStop[]) => {
	const sorted = sortStops(stops);
	if (sorted.length === 0) throw new Error("Add at least one colour stop.");
	if (sorted.length === 1) return [sorted[0], { ...sorted[0], position: 100 }];
	return sorted;
};

export const buildGradient = (options: GradientOptions) => {
	const stops = normaliseStops(options.stops).map((stop) => {
		const color = stop.color.trim();
		if (!isColour(color)) throw new Error(`"${stop.color}" is not a recognised CSS colour.`);
		const position = Math.min(100, Math.max(0, Math.round(stop.position)));
		return `${color} ${position}%`;
	});
	const prefix = options.repeating ? "repeating-" : "";
	if (options.type === "linear") {
		const angle = ((Math.round(options.angle) % 360) + 360) % 360;
		return `background-image: ${prefix}linear-gradient(${angle}deg, ${stops.join(", ")});`;
	}
	if (options.type === "radial") {
		return `background-image: ${prefix}radial-gradient(${options.shape} at 50% 50%, ${stops.join(", ")});`;
	}
	return `background-image: ${prefix}conic-gradient(from ${((Math.round(options.angle) % 360) + 360) % 360}deg at 50% 50%, ${stops.join(", ")});`;
};

export const toPreviewStyle = (css: string) => css.replace(/^background-image:\s*/u, "").replace(/;$/u, "");

export const presetGradients: { label: string; options: GradientOptions }[] = [
	{
		label: "Sunset",
		options: { type: "linear", angle: 120, repeating: false, shape: "circle", stops: [{ color: "#ff8a4c", position: 0 }, { color: "#ff2d78", position: 55 }, { color: "#6a2cff", position: 100 }] },
	},
	{
		label: "Ocean",
		options: { type: "linear", angle: 160, repeating: false, shape: "circle", stops: [{ color: "#0f2027", position: 0 }, { color: "#2c5364", position: 60 }, { color: "#4fd1c5", position: 100 }] },
	},
	{
		label: "Stripes",
		options: {
			type: "linear",
			angle: 45,
			repeating: true,
			shape: "circle",
			stops: [
				{ color: "#16233b", position: 0 },
				{ color: "#16233b", position: 10 },
				{ color: "#20355a", position: 10 },
				{ color: "#20355a", position: 20 },
			],
		},
	},
];
