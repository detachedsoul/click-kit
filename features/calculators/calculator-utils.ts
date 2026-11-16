export type PercentageMode = "of" | "change" | "increase" | "decrease";
export type PercentageResult = {
	result: number;
	change: number;
};

export type CalendarDifference = {
	years: number;
	months: number;
	days: number;
	totalDays: number;
};

export type UnitCategory = "length" | "mass" | "temperature" | "volume" | "area" | "time";
export type UnitDefinition = {
	id: string;
	name: string;
	symbol: string;
	toBase?: number;
};

export const unitCategories: { id: UnitCategory; label: string; units: UnitDefinition[] }[] = [
	{ id: "length", label: "Length", units: [
		{ id: "millimeter", name: "Millimeters", symbol: "mm", toBase: 0.001 },
		{ id: "centimeter", name: "Centimeters", symbol: "cm", toBase: 0.01 },
		{ id: "meter", name: "Meters", symbol: "m", toBase: 1 },
		{ id: "kilometer", name: "Kilometers", symbol: "km", toBase: 1000 },
		{ id: "inch", name: "Inches", symbol: "in", toBase: 0.0254 },
		{ id: "foot", name: "Feet", symbol: "ft", toBase: 0.3048 },
		{ id: "yard", name: "Yards", symbol: "yd", toBase: 0.9144 },
		{ id: "mile", name: "Miles", symbol: "mi", toBase: 1609.344 },
	] },
	{ id: "mass", label: "Weight", units: [
		{ id: "milligram", name: "Milligrams", symbol: "mg", toBase: 0.000001 },
		{ id: "gram", name: "Grams", symbol: "g", toBase: 0.001 },
		{ id: "kilogram", name: "Kilograms", symbol: "kg", toBase: 1 },
		{ id: "tonne", name: "Metric tonnes", symbol: "t", toBase: 1000 },
		{ id: "ounce", name: "Ounces", symbol: "oz", toBase: 0.028349523125 },
		{ id: "pound", name: "Pounds", symbol: "lb", toBase: 0.45359237 },
	] },
	{ id: "temperature", label: "Temperature", units: [
		{ id: "celsius", name: "Celsius", symbol: "°C" },
		{ id: "fahrenheit", name: "Fahrenheit", symbol: "°F" },
		{ id: "kelvin", name: "Kelvin", symbol: "K" },
	] },
	{ id: "volume", label: "Volume", units: [
		{ id: "milliliter", name: "Milliliters", symbol: "mL", toBase: 0.001 },
		{ id: "liter", name: "Liters", symbol: "L", toBase: 1 },
		{ id: "us-cup", name: "US cups", symbol: "US cup", toBase: 0.2365882365 },
		{ id: "us-pint", name: "US pints", symbol: "US pt", toBase: 0.473176473 },
		{ id: "us-quart", name: "US quarts", symbol: "US qt", toBase: 0.946352946 },
		{ id: "us-gallon", name: "US gallons", symbol: "US gal", toBase: 3.785411784 },
	] },
	{ id: "area", label: "Area", units: [
		{ id: "square-centimeter", name: "Square centimeters", symbol: "cm²", toBase: 0.0001 },
		{ id: "square-meter", name: "Square meters", symbol: "m²", toBase: 1 },
		{ id: "hectare", name: "Hectares", symbol: "ha", toBase: 10000 },
		{ id: "square-kilometer", name: "Square kilometers", symbol: "km²", toBase: 1000000 },
		{ id: "square-foot", name: "Square feet", symbol: "ft²", toBase: 0.09290304 },
		{ id: "acre", name: "Acres", symbol: "ac", toBase: 4046.8564224 },
	] },
	{ id: "time", label: "Time", units: [
		{ id: "millisecond", name: "Milliseconds", symbol: "ms", toBase: 0.001 },
		{ id: "second", name: "Seconds", symbol: "s", toBase: 1 },
		{ id: "minute", name: "Minutes", symbol: "min", toBase: 60 },
		{ id: "hour", name: "Hours", symbol: "h", toBase: 3600 },
		{ id: "day", name: "Days", symbol: "d", toBase: 86400 },
		{ id: "week", name: "Weeks", symbol: "wk", toBase: 604800 },
	] },
];

const normalizeCalculatorNumber = (value: number) => {
	if (!Number.isFinite(value)) throw new Error("The result is too large to calculate.");
	return value === 0 ? 0 : Number(value.toPrecision(15));
};

export const evaluateArithmeticExpression = (expression: string) => {
	if (!expression.trim()) throw new Error("Enter a calculation first.");
	if (expression.length > 200) throw new Error("Keep calculations under 200 characters.");

	let position = 0;
	let nestingDepth = 0;
	const skipSpaces = () => {
		while (/\s/u.test(expression[position] ?? "")) position += 1;
	};
	const parseExpression = (): number => {
		let value = parseTerm();
		while (true) {
			skipSpaces();
			const operator = expression[position];
			if (operator !== "+" && operator !== "-") return value;
			position += 1;
			const nextValue = parseTerm();
			value = normalizeCalculatorNumber(operator === "+" ? value + nextValue : value - nextValue);
		}
	};
	const parseTerm = (): number => {
		let value = parseUnary();
		while (true) {
			skipSpaces();
			const operator = expression[position];
			if (operator !== "*" && operator !== "/") return value;
			position += 1;
			const nextValue = parseUnary();
			if (operator === "/" && nextValue === 0) throw new Error("You can't divide by zero.");
			value = normalizeCalculatorNumber(operator === "*" ? value * nextValue : value / nextValue);
		}
	};
	const parseUnary = (): number => {
		skipSpaces();
		if (expression[position] === "+") {
			position += 1;
			return parseUnary();
		}
		if (expression[position] === "-") {
			position += 1;
			return normalizeCalculatorNumber(-parseUnary());
		}
		return parsePrimary();
	};
	const parsePrimary = (): number => {
		skipSpaces();
		if (expression[position] === "(") {
			nestingDepth += 1;
			if (nestingDepth > 40) throw new Error("That calculation has too many nested parentheses.");
			position += 1;
			const value = parseExpression();
			skipSpaces();
			if (expression[position] !== ")") throw new Error("Add a closing parenthesis to finish the calculation.");
			position += 1;
			nestingDepth -= 1;
			return value;
		}
		const number = expression.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iu)?.[0];
		if (!number) throw new Error(`Check the calculation near character ${position + 1}.`);
		position += number.length;
		const value = Number(number);
		if (!Number.isFinite(value)) throw new Error("Enter a finite number.");
		return value;
	};

	const result = parseExpression();
	skipSpaces();
	if (position < expression.length) throw new Error(`Unexpected character near position ${position + 1}.`);
	return normalizeCalculatorNumber(result);
};

export const calculatePercentage = (mode: PercentageMode, firstValue: number, secondValue: number): PercentageResult => {
	if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue)) throw new Error("Enter valid numbers in both fields.");
	let result: number;
	let change: number;
	switch (mode) {
		case "of":
			result = firstValue * secondValue / 100;
			change = result;
			break;
		case "change":
			if (firstValue === 0) throw new Error("Percentage change from zero is undefined.");
			change = secondValue - firstValue;
			result = change / Math.abs(firstValue) * 100;
			break;
		case "increase":
			result = firstValue * (1 + secondValue / 100);
			change = result - firstValue;
			break;
		case "decrease":
			result = firstValue * (1 - secondValue / 100);
			change = result - firstValue;
			break;
	}
	return { result: normalizeCalculatorNumber(result), change: normalizeCalculatorNumber(change) };
};

const createUtcDate = (year: number, month: number, day: number) => {
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, month - 1, day);
	return date;
};

const parseCalendarDate = (value: string) => {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
	if (!match) throw new Error("Choose a valid date.");
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = createUtcDate(year, month, day);
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Choose a valid date.");
	return { year, month, day };
};

const dateTimestamp = ({ year, month, day }: { year: number; month: number; day: number }) => createUtcDate(year, month, day).getTime();
const daysInMonth = (year: number, month: number) => createUtcDate(year, month + 1, 0).getUTCDate();
const addClampedMonths = (date: { year: number; month: number; day: number }, monthsToAdd: number) => {
	const absoluteMonth = date.year * 12 + date.month - 1 + monthsToAdd;
	const year = Math.floor(absoluteMonth / 12);
	const month = absoluteMonth % 12 + 1;
	return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
};

export const calculateCalendarDifference = (startDate: string, endDate: string): CalendarDifference => {
	const start = parseCalendarDate(startDate);
	const end = parseCalendarDate(endDate);
	if (dateTimestamp(start) > dateTimestamp(end)) throw new Error("The end date must be on or after the start date.");

	let years = end.year - start.year;
	let yearCursor = addClampedMonths(start, years * 12);
	if (dateTimestamp(yearCursor) > dateTimestamp(end)) {
		years -= 1;
		yearCursor = addClampedMonths(start, years * 12);
	}
	let months = (end.year - yearCursor.year) * 12 + end.month - yearCursor.month;
	let monthCursor = addClampedMonths(yearCursor, months);
	if (dateTimestamp(monthCursor) > dateTimestamp(end)) {
		months -= 1;
		monthCursor = addClampedMonths(yearCursor, months);
	}
	const days = Math.round((dateTimestamp(end) - dateTimestamp(monthCursor)) / 86400000);
	const totalDays = Math.round((dateTimestamp(end) - dateTimestamp(start)) / 86400000);
	return { years, months, days, totalDays };
};

export const calculateAge = (birthDate: string, asOfDate: string): CalendarDifference => calculateCalendarDifference(birthDate, asOfDate);

export const convertMeasurement = (value: number, category: UnitCategory, fromUnitId: string, toUnitId: string) => {
	if (!Number.isFinite(value)) throw new Error("Enter a valid number to convert.");
	const categoryDefinition = unitCategories.find((item) => item.id === category);
	const fromUnit = categoryDefinition?.units.find((unit) => unit.id === fromUnitId);
	const toUnit = categoryDefinition?.units.find((unit) => unit.id === toUnitId);
	if (!fromUnit || !toUnit) throw new Error("Choose units from the same measurement category.");

	if (category === "temperature") {
		if (fromUnitId === "kelvin" && value < 0) throw new Error("Kelvin cannot be below absolute zero.");
		const celsius = fromUnitId === "celsius" ? value : fromUnitId === "fahrenheit" ? (value - 32) * 5 / 9 : value - 273.15;
		const converted = toUnitId === "celsius" ? celsius : toUnitId === "fahrenheit" ? celsius * 9 / 5 + 32 : celsius + 273.15;
		if (toUnitId === "kelvin" && converted < 0) throw new Error("That temperature is below absolute zero.");
		return normalizeCalculatorNumber(converted);
	}

	const converted = value * (fromUnit.toBase ?? 1) / (toUnit.toBase ?? 1);
	return normalizeCalculatorNumber(converted);
};
