export type Ingredient = {
	line: string;
	quantity: number | null;
	unit: string;
	name: string;
};

export type ScaledIngredient = Ingredient & { scaled: number | null; scaledText: string };

const UNICODE_FRACTIONS: Record<string, number> = {
	"¼": 0.25,
	"½": 0.5,
	"¾": 0.75,
	"⅓": 1 / 3,
	"⅔": 2 / 3,
	"⅛": 0.125,
	"⅜": 0.375,
	"⅝": 0.625,
	"⅞": 0.875,
};

export const UNITS = [
	"cup",
	"cups",
	"tbsp",
	"tablespoon",
	"tablespoons",
	"tsp",
	"teaspoon",
	"teaspoons",
	"g",
	"gram",
	"grams",
	"kg",
	"ml",
	"l",
	"litre",
	"litres",
	"oz",
	"ounce",
	"ounces",
	"lb",
	"lbs",
	"pinch",
	"pinches",
	"clove",
	"cloves",
	"can",
	"cans",
	"slice",
	"slices",
	"packet",
	"packets",
];

const FRACTION_WORDS: Record<string, number> = { half: 0.5, quarter: 0.25, third: 1 / 3, "three-quarters": 0.75 };

const leadingQuantity = (text: string): { quantity: number | null; rest: string } => {
	const trimmed = text.trim();

	const unicode = /^([¼½¾⅓⅔⅛⅜⅝⅞])\s*/u.exec(trimmed);
	if (unicode) return { quantity: UNICODE_FRACTIONS[unicode[1]], rest: trimmed.slice(unicode[0].length) };

	// "1 1/2", "1/2", "1,5", "2"
	const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*/u.exec(trimmed);
	if (mixed) {
		const denominator = Number(mixed[3]);
		if (denominator > 0) return { quantity: Number(mixed[1]) + Number(mixed[2]) / denominator, rest: trimmed.slice(mixed[0].length) };
	}
	const fraction = /^(\d+)\s*\/\s*(\d+)\s*/u.exec(trimmed);
	if (fraction) {
		const denominator = Number(fraction[2]);
		if (denominator > 0) return { quantity: Number(fraction[1]) / denominator, rest: trimmed.slice(fraction[0].length) };
	}
	const decimal = /^(\d+(?:[.,]\d+)?)\s*/u.exec(trimmed);
	if (decimal) return { quantity: Number(decimal[1].replace(",", ".")), rest: trimmed.slice(decimal[0].length) };

	const word = /^([a-z-]+)\s+/iu.exec(trimmed);
	if (word && FRACTION_WORDS[word[1].toLowerCase()] !== undefined) return { quantity: FRACTION_WORDS[word[1].toLowerCase()], rest: trimmed.slice(word[0].length) };

	return { quantity: null, rest: trimmed };
};

/** "2 cups flour" → { quantity: 2, unit: "cups", name: "flour" }. Lines without a number stay untouched. */
export const parseIngredient = (line: string): Ingredient => {
	const { quantity, rest } = leadingQuantity(line);
	if (quantity === null) return { line, quantity: null, unit: "", name: line.trim() };
	const [first, ...tail] = rest.split(/\s+/u);
	if (first && UNITS.includes(first.toLowerCase())) return { line, quantity, unit: first, name: tail.join(" ").trim() };
	return { line, quantity, unit: "", name: rest.trim() };
};

const FRACTIONS: [number, string][] = [
	[0.125, "1/8"],
	[0.25, "1/4"],
	[1 / 3, "1/3"],
	[0.375, "3/8"],
	[0.5, "1/2"],
	[5 / 8, "5/8"],
	[2 / 3, "2/3"],
	[0.75, "3/4"],
	[7 / 8, "7/8"],
];

/** Friendly kitchen amounts: whole numbers, common fractions, and a pinch for the smallest bits. */
export const formatQuantity = (value: number) => {
	if (!Number.isFinite(value) || value <= 0) return "0";
	if (value < 0.07) return "a pinch";
	const whole = Math.floor(value);
	const remainder = value - whole;
	if (remainder < 0.04) return String(whole || 0);
	if (remainder > 0.96) return String(whole + 1);
	const match = FRACTIONS.find(([size]) => Math.abs(size - remainder) < 0.04);
	if (match) return whole === 0 ? match[1] : `${whole} ${match[1]}`;
	return String(Math.round(value * 100) / 100);
};

/** "1 cups" reads wrong, so a single item drops the plural the ingredient was written with. */
export const unitForQuantity = (unit: string, quantity: number) => {
	if (!unit) return unit;
	const isOne = Math.abs(quantity - 1) < 0.001;
	if (isOne && /s$/u.test(unit) && UNITS.includes(unit.slice(0, -1))) return unit.slice(0, -1);
	return unit;
};

export const scaleFactor = (originalServings: number, targetServings: number) => {
	if (!Number.isFinite(originalServings) || originalServings <= 0) throw new Error("Original servings must be more than zero.");
	if (!Number.isFinite(targetServings) || targetServings <= 0) throw new Error("Target servings must be more than zero.");
	if (targetServings > originalServings * 20) throw new Error("That is more than twenty times the original — check the servings.");
	return targetServings / originalServings;
};

export const scaleIngredients = (text: string, factor: number): ScaledIngredient[] => {
	if (!Number.isFinite(factor) || factor <= 0) throw new Error("The scale factor must be more than zero.");
	return text
		.split(/\r?\n/u)
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const ingredient = parseIngredient(line);
			if (ingredient.quantity === null) return { ...ingredient, scaled: null, scaledText: line.trim() };
			const scaled = Math.round(ingredient.quantity * factor * 1000) / 1000;
			const unit = unitForQuantity(ingredient.unit, scaled);
			return { ...ingredient, scaled, scaledText: `${formatQuantity(scaled)} ${[unit, ingredient.name].filter(Boolean).join(" ")}`.trim() };
		});
};

export const scaledText = (items: ScaledIngredient[]) => items.map((item) => item.scaledText).join("\n");

export const factorLabel = (factor: number) => `${Math.round(factor * 100) / 100}×`;
