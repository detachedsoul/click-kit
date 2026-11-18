export type Unit = "g" | "kg" | "ml" | "l" | "ml-each" | "item" | "m" | "sheet" | "load";

export const unitLabels: Record<Unit, string> = {
	g: "grams",
	kg: "kilograms",
	ml: "millilitres",
	l: "litres",
	"ml-each": "millilitres each",
	item: "items",
	m: "metres",
	sheet: "sheets",
	load: "loads",
};

/** Base measures: grams, millilitres, items, metres. Packaging units carry the same base as their volume/weight. */
const baseFactor: Record<Unit, { measure: "mass" | "volume" | "count" | "length"; factor: number }> = {
	g: { measure: "mass", factor: 1 },
	kg: { measure: "mass", factor: 1000 },
	ml: { measure: "volume", factor: 1 },
	l: { measure: "volume", factor: 1000 },
	"ml-each": { measure: "volume", factor: 1 },
	item: { measure: "count", factor: 1 },
	m: { measure: "length", factor: 1 },
	sheet: { measure: "count", factor: 1 },
	load: { measure: "count", factor: 1 },
};

const displaySize = (quantity: number, unit: Unit) => {
	if (unit === "kg" || unit === "l") return `${quantity} ${unit} (${quantity * 1000} ${unit === "kg" ? "g" : "ml"})`;
	return `${quantity} ${unit}`;
};

export type UnitPriceOffer = { id: string; name: string; price: number; quantity: number; unit: Unit };

export type UnitPriceRow = {
	id: string;
	name: string;
	price: number;
	quantity: number;
	unit: Unit;
	pricePerBase: number;
	pricePerHundred: number;
	displayUnit: string;
	size: string;
};

export type UnitPriceComparison = {
	rows: UnitPriceRow[];
	cheapest: UnitPriceRow | null;
	mostExpensive: UnitPriceRow | null;
	savingPercent: number;
	savingAmount: number;
	measureLabel: string;
	expensiveUnit: string;
	mixedMeasures: boolean;
};

const measureLabels = { mass: "per 100 g", volume: "per 100 ml", count: "per item", length: "per metre" } as const;

export const compareUnitPrices = (offers: UnitPriceOffer[]) => {
	const valid = offers.filter((offer) => offer.name.trim() && Number.isFinite(offer.price) && Number.isFinite(offer.quantity) && offer.price > 0 && offer.quantity > 0);
	if (!valid.length) throw new Error("Add at least one offer with a price and an amount.");
	const measures = new Set(valid.map((offer) => baseFactor[offer.unit].measure));
	const mixedMeasures = measures.size > 1;
	const rows: UnitPriceRow[] = valid.map((offer) => {
		const base = baseFactor[offer.unit];
		const baseQuantity = offer.quantity * base.factor;
		const pricePerBase = offer.price / baseQuantity;
		return {
			id: offer.id,
			name: offer.name.trim(),
			price: offer.price,
			quantity: offer.quantity,
			unit: offer.unit,
			pricePerBase,
			pricePerHundred: pricePerBase * 100,
			displayUnit: base.measure === "mass" ? "per 100 g" : base.measure === "volume" ? "per 100 ml" : base.measure === "length" ? "per metre" : "per item",
			size: displaySize(offer.quantity, offer.unit),
		};
	});
	const sorted = [...rows].sort((left, right) => left.pricePerBase - right.pricePerBase);
	const cheapest = sorted[0];
	const mostExpensive = sorted[sorted.length - 1];
	const savingPercent = mostExpensive.pricePerBase ? Math.round((1 - cheapest.pricePerBase / mostExpensive.pricePerBase) * 1000) / 10 : 0;
	const measure = baseFactor[cheapest.unit].measure;
	return {
		rows,
		cheapest,
		mostExpensive,
		savingPercent,
		savingAmount: Math.max(0, mostExpensive.price - cheapest.price),
		measureLabel: measures.size === 1 ? measureLabels[measure] : "mixed units",
		expensiveUnit: cheapest.displayUnit,
		mixedMeasures,
	} satisfies UnitPriceComparison;
};

export const money = (value: number) => `${value.toFixed(2)}`;
