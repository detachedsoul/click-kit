export type PercentageMode = "of" | "change" | "increase" | "decrease";
export type PercentageResult = {
	result: number;
	change: number;
};

export type LoanPayment = {
	monthlyPayment: number;
	totalPaid: number;
	totalInterest: number;
};

export type BmiResult = {
	bmi: number;
	category: "Underweight" | "Healthy weight" | "Overweight" | "Obesity";
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

export const evaluateScientificExpression = (expression: string, angleUnit: "degrees" | "radians" = "degrees", ans = 0, x?: number) => {
	if (!expression.trim()) throw new Error("Enter a calculation first.");
	if (expression.length > 500) throw new Error("Keep calculations under 500 characters.");
	if (!Number.isFinite(ans)) throw new Error("The previous answer is not a finite number.");
	if (x !== undefined && !Number.isFinite(x)) throw new Error("The integration variable must be finite.");

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
			const currentCharacter = expression[position] ?? "";
			const explicitOperator = currentCharacter === "*" || currentCharacter === "/" || currentCharacter === "%" ? currentCharacter : null;
			const implicitMultiplication = currentCharacter === "(" || /[a-z]/iu.test(currentCharacter);
			if (!explicitOperator && !implicitMultiplication) return value;
			if (explicitOperator) position += 1;
			const nextValue = parseUnary();
			if ((explicitOperator === "/" || explicitOperator === "%") && nextValue === 0) throw new Error(explicitOperator === "/" ? "You can't divide by zero." : "You can't take a remainder with zero.");
			value = normalizeCalculatorNumber(!explicitOperator || explicitOperator === "*" ? value * nextValue : explicitOperator === "/" ? value / nextValue : value % nextValue);
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
		return parsePower();
	};
	const parsePower = (): number => {
		const base = parsePostfix();
		skipSpaces();
		if (expression[position] !== "^" && !expression.startsWith("**", position)) return base;
		const operatorWidth = expression.startsWith("**", position) ? 2 : 1;
		position += operatorWidth;
		return normalizeCalculatorNumber(base ** parseUnary());
	};
	const factorial = (value: number) => {
		if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error("Factorial requires a whole number from 0 to 170.");
		let result = 1;
		for (let factor = 2; factor <= value; factor += 1) result *= factor;
		return normalizeCalculatorNumber(result);
	};
	const parsePostfix = (): number => {
		let value = parsePrimary();
		while (true) {
			skipSpaces();
			if (expression[position] !== "!") return value;
			position += 1;
			value = factorial(value);
		}
	};
	const convertAngle = (value: number) => angleUnit === "degrees" ? value * Math.PI / 180 : value;
	const convertOutputAngle = (value: number) => angleUnit === "degrees" ? value * 180 / Math.PI : value;
	const applyFunction = (name: string, args: number[]) => {
		const [value, second, third] = args;
		const requireCount = (minimum: number, maximum = minimum) => {
			if (args.length < minimum || args.length > maximum) {
				const expectedCount = minimum === maximum ? `${minimum}` : maximum === Number.MAX_SAFE_INTEGER ? `at least ${minimum}` : `${minimum} to ${maximum}`;
				throw new Error(`${name} expects ${expectedCount} argument${expectedCount === "1" ? "" : "s"}.`);
			}
		};
		switch (name) {
			case "sin": requireCount(1); return Math.sin(convertAngle(value));
			case "cos": requireCount(1); return Math.cos(convertAngle(value));
			case "tan": {
				requireCount(1);
				const angle = convertAngle(value);
				if (Math.abs(Math.cos(angle)) < 1e-14) throw new Error("Tangent is undefined at this angle.");
				return Math.tan(angle);
			}
			case "sec": {
				requireCount(1);
				const cosine = Math.cos(convertAngle(value));
				if (Math.abs(cosine) < 1e-14) throw new Error("Secant is undefined at this angle.");
				return 1 / cosine;
			}
			case "csc": {
				requireCount(1);
				const sine = Math.sin(convertAngle(value));
				if (Math.abs(sine) < 1e-14) throw new Error("Cosecant is undefined at this angle.");
				return 1 / sine;
			}
			case "cot": {
				requireCount(1);
				const angle = convertAngle(value);
				const sine = Math.sin(angle);
				if (Math.abs(sine) < 1e-14) throw new Error("Cotangent is undefined at this angle.");
				return Math.cos(angle) / sine;
			}
			case "asin": requireCount(1); return convertOutputAngle(Math.asin(value));
			case "asec": requireCount(1); if (Math.abs(value) < 1) throw new Error("Inverse secant needs an input with an absolute value of at least one."); return convertOutputAngle(Math.acos(1 / value));
			case "acsc": requireCount(1); if (Math.abs(value) < 1) throw new Error("Inverse cosecant needs an input with an absolute value of at least one."); return convertOutputAngle(Math.asin(1 / value));
			case "acot": requireCount(1); return convertOutputAngle(Math.atan2(1, value));
			case "acos": requireCount(1); return convertOutputAngle(Math.acos(value));
			case "atan": requireCount(1); return convertOutputAngle(Math.atan(value));
			case "atan2":
				requireCount(2);
				if (value === 0 && second === 0) throw new Error("atan2 is undefined when both inputs are zero.");
				return convertOutputAngle(Math.atan2(value, second));
			case "sinh": requireCount(1); return Math.sinh(value);
			case "cosh": requireCount(1); return Math.cosh(value);
			case "tanh": requireCount(1); return Math.tanh(value);
			case "sech": requireCount(1); return 1 / Math.cosh(value);
			case "csch": requireCount(1); if (value === 0) throw new Error("Cosecant hyperbolic is not defined for zero."); return 1 / Math.sinh(value);
			case "coth": requireCount(1); if (value === 0) throw new Error("Cotangent hyperbolic is not defined for zero."); return 1 / Math.tanh(value);
			case "asinh": requireCount(1); return Math.asinh(value);
			case "acosh": requireCount(1); return Math.acosh(value);
			case "atanh": requireCount(1); return Math.atanh(value);
			case "sqrt": requireCount(1); return Math.sqrt(value);
			case "cbrt": requireCount(1); return Math.cbrt(value);
			case "abs": requireCount(1); return Math.abs(value);
			case "ln": requireCount(1); return Math.log(value);
			case "log10": requireCount(1); return Math.log10(value);
			case "log2": requireCount(1); return Math.log2(value);
			case "log":
				requireCount(1, 2);
				if (args.length === 1) return Math.log10(value);
				if (second <= 0 || second === 1) throw new Error("Logarithm base must be greater than zero and not equal to one.");
				return Math.log(value) / Math.log(second);
			case "exp": requireCount(1); return Math.exp(value);
			case "floor": requireCount(1); return Math.floor(value);
			case "ceil": requireCount(1); return Math.ceil(value);
			case "round": requireCount(1); return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
			case "sign": requireCount(1); return Math.sign(value);
			case "inv": requireCount(1); if (value === 0) throw new Error("Zero has no reciprocal."); return 1 / value;
			case "deg": requireCount(1); return value * 180 / Math.PI;
			case "rad": requireCount(1); return value * Math.PI / 180;
			case "pow": requireCount(2); return value ** second;
			case "sum": requireCount(1, Number.MAX_SAFE_INTEGER); return args.reduce((total, current) => total + current, 0);
			case "product": requireCount(1, Number.MAX_SAFE_INTEGER); return args.reduce((total, current) => total * current, 1);
			case "mean":
				requireCount(1, Number.MAX_SAFE_INTEGER);
				return args.reduce((total, current) => total + current / args.length, 0);
			case "median": {
				requireCount(1, Number.MAX_SAFE_INTEGER);
				const sorted = [...args].sort((left, right) => left - right);
				const middle = Math.floor(sorted.length / 2);
				return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
			}
			case "variance":
			case "stdev": {
				requireCount(1, Number.MAX_SAFE_INTEGER);
				let average = 0;
				let squaredDeviationSum = 0;
				args.forEach((current, index) => {
					const count = index + 1;
					const delta = current - average;
					average += delta / count;
					squaredDeviationSum += delta * (current - average);
				});
				const variance = squaredDeviationSum / args.length;
				return name === "variance" ? variance : Math.sqrt(variance);
			}
			case "perm":
			case "comb": {
				requireCount(2);
				if (!Number.isInteger(value) || !Number.isInteger(second) || value < 0 || second < 0 || second > value || value > 1000) throw new Error(`${name} needs whole numbers with 0 ≤ r ≤ n ≤ 1000.`);
				const count = name === "comb" ? Math.min(second, value - second) : second;
				let result = 1;
				for (let index = 0; index < count; index += 1) result = name === "comb" ? result * (value - index) / (index + 1) : result * (value - index);
				return result;
			}
			case "root":
				requireCount(2);
				if (second === 0) throw new Error("Root index cannot be zero.");
				if (value < 0 && Number.isInteger(second) && Math.abs(second) % 2 === 1) return -((-value) ** (1 / second));
				if (value < 0) throw new Error("An even or non-integer root needs a number that is zero or greater.");
				return value ** (1 / second);
			case "min": requireCount(1, Number.MAX_SAFE_INTEGER); return Math.min(...args);
			case "max": requireCount(1, Number.MAX_SAFE_INTEGER); return Math.max(...args);
			case "hypot": requireCount(2, Number.MAX_SAFE_INTEGER); return Math.hypot(...args);
			case "clamp":
				requireCount(3);
				if (second > third) throw new Error("Clamp minimum must not exceed its maximum.");
				return Math.min(Math.max(value, second), third);
			default: throw new Error(`Unknown function “${name}”.`);
		}
	};
	const parsePrimary = (): number => {
		skipSpaces();
		if (expression[position] === "(") {
			nestingDepth += 1;
			if (nestingDepth > 50) throw new Error("That calculation has too many nested parentheses.");
			position += 1;
			const value = parseExpression();
			skipSpaces();
			if (expression[position] !== ")") throw new Error("Add a closing parenthesis to finish the calculation.");
			position += 1;
			nestingDepth -= 1;
			return value;
		}
		const number = expression.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iu)?.[0];
		if (number) {
			position += number.length;
			const value = Number(number);
			if (!Number.isFinite(value)) throw new Error("Enter a finite number.");
			return value;
		}
		const identifier = expression.slice(position).match(/^[a-z][a-z0-9]*/iu)?.[0]?.toLowerCase();
		if (!identifier) throw new Error(`Check the calculation near character ${position + 1}.`);
		position += identifier.length;
		skipSpaces();
		if (expression[position] !== "(") {
			const constants: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2, ans, c: 299792458, g0: 9.80665, h: 6.62607015e-34, kb: 1.380649e-23, na: 6.02214076e23, ...(x === undefined ? {} : { x }) };
			if (!(identifier in constants)) throw new Error(`Unknown constant “${identifier}”.`);
			return constants[identifier];
		}
		nestingDepth += 1;
		if (nestingDepth > 50) throw new Error("That calculation has too many nested parentheses.");
		position += 1;
		const args: number[] = [];
		skipSpaces();
		if (expression[position] !== ")") {
			while (true) {
				args.push(parseExpression());
				skipSpaces();
				if (expression[position] !== ",") break;
				position += 1;
			}
		}
		if (expression[position] !== ")") throw new Error(`Add a closing parenthesis after ${identifier}.`);
		position += 1;
		nestingDepth -= 1;
		const result = applyFunction(identifier, args);
		if (!Number.isFinite(result)) throw new Error(`${identifier} is not defined for that input.`);
		return normalizeCalculatorNumber(result);
	};

	const result = parseExpression();
	skipSpaces();
	if (position < expression.length) throw new Error(`Unexpected character near position ${position + 1}.`);
	return normalizeCalculatorNumber(result);
};

export const calculateDefiniteIntegral = (expression: string, lowerBound: number, upperBound: number, angleUnit: "degrees" | "radians" = "radians", ans = 0) => {
	if (!Number.isFinite(lowerBound) || !Number.isFinite(upperBound)) throw new Error("Enter finite lower and upper bounds.");
	if (!Number.isFinite(upperBound - lowerBound)) throw new Error("The integration interval is too large.");

	let evaluationCount = 0;
	const evaluate = (x: number) => {
		evaluationCount += 1;
		if (evaluationCount > 20000) throw new Error("Integration reached its evaluation limit. Try a smoother function or a smaller interval.");
		return evaluateScientificExpression(expression, angleUnit, ans, x);
	};
	if (lowerBound === upperBound) {
		evaluate(lowerBound);
		return 0;
	}

	const midpoint = lowerBound + (upperBound - lowerBound) / 2;
	const atLower = evaluate(lowerBound);
	const atMidpoint = evaluate(midpoint);
	const atUpper = evaluate(upperBound);
	const initialEstimate = (upperBound - lowerBound) / 6 * (atLower + 4 * atMidpoint + atUpper);
	if (!Number.isFinite(initialEstimate)) throw new Error("The integral is not finite on this interval.");
	const tolerance = 1e-9 * Math.max(1, Math.abs(initialEstimate));

	const adaptiveSimpson = (start: number, end: number, startValue: number, middleValue: number, endValue: number, estimate: number, localTolerance: number, remainingDepth: number): number => {
		const center = start + (end - start) / 2;
		const leftCenter = start + (center - start) / 2;
		const rightCenter = center + (end - center) / 2;
		if (leftCenter === start || rightCenter === end) return estimate;
		const leftCenterValue = evaluate(leftCenter);
		const rightCenterValue = evaluate(rightCenter);
		const leftEstimate = (center - start) / 6 * (startValue + 4 * leftCenterValue + middleValue);
		const rightEstimate = (end - center) / 6 * (middleValue + 4 * rightCenterValue + endValue);
		const refinedEstimate = leftEstimate + rightEstimate;
		if (!Number.isFinite(refinedEstimate)) throw new Error("The integral is not finite on this interval.");
		const estimateDifference = refinedEstimate - estimate;
		if (Math.abs(estimateDifference) <= 15 * localTolerance) return refinedEstimate + estimateDifference / 15;
		if (remainingDepth === 0) throw new Error("Integration could not converge. Try a smoother function or a smaller interval.");
		return adaptiveSimpson(start, center, startValue, leftCenterValue, middleValue, leftEstimate, localTolerance / 2, remainingDepth - 1)
			+ adaptiveSimpson(center, end, middleValue, rightCenterValue, endValue, rightEstimate, localTolerance / 2, remainingDepth - 1);
	};

	return normalizeCalculatorNumber(adaptiveSimpson(lowerBound, upperBound, atLower, atMidpoint, atUpper, initialEstimate, tolerance, 18));
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

export const calculateLoanPayment = (principal: number, annualRatePercent: number, termMonths: number): LoanPayment => {
	if (![principal, annualRatePercent, termMonths].every(Number.isFinite)) throw new Error("Enter valid numbers for all loan details.");
	if (principal <= 0) throw new Error("Loan amount must be greater than zero.");
	if (annualRatePercent < 0) throw new Error("Annual interest rate cannot be negative.");
	if (!Number.isInteger(termMonths) || termMonths <= 0) throw new Error("Loan term must be a whole number of months greater than zero.");

	const monthlyRate = annualRatePercent / 100 / 12;
	const monthlyPayment = monthlyRate === 0
		? principal / termMonths
		: principal * monthlyRate / (1 - (1 + monthlyRate) ** -termMonths);
	const totalPaid = monthlyPayment * termMonths;
	return {
		monthlyPayment: normalizeCalculatorNumber(monthlyPayment),
		totalPaid: normalizeCalculatorNumber(totalPaid),
		totalInterest: normalizeCalculatorNumber(totalPaid - principal),
	};
};

export const calculateTipSplit = (billAmount: number, tipPercent: number, people: number) => {
	if (![billAmount, tipPercent, people].every(Number.isFinite)) throw new Error("Enter valid numbers for the bill, tip, and group size.");
	if (billAmount < 0) throw new Error("Bill amount cannot be negative.");
	if (tipPercent < 0) throw new Error("Tip percentage cannot be negative.");
	if (!Number.isInteger(people) || people < 1) throw new Error("Group size must be a whole number of at least one.");
	const tipAmount = billAmount * tipPercent / 100;
	const total = billAmount + tipAmount;
	return {
		tipAmount: normalizeCalculatorNumber(tipAmount),
		total: normalizeCalculatorNumber(total),
		tipPerPerson: normalizeCalculatorNumber(tipAmount / people),
		totalPerPerson: normalizeCalculatorNumber(total / people),
	};
};

export const calculateBmi = (weight: number, height: number, units: "metric" | "imperial" = "metric"): BmiResult => {
	if (![weight, height].every(Number.isFinite)) throw new Error("Enter valid numbers for height and weight.");
	if (weight <= 0 || height <= 0) throw new Error("Height and weight must be greater than zero.");
	const weightKg = units === "imperial" ? weight * 0.45359237 : weight;
	const heightMeters = units === "imperial" ? height * 0.0254 : height / 100;
	const bmi = normalizeCalculatorNumber(weightKg / (heightMeters * heightMeters));
	const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy weight" : bmi < 30 ? "Overweight" : "Obesity";
	return { bmi, category };
};

export const calculateScientificFunction = (operation: "sin" | "cos" | "tan" | "log" | "ln" | "sqrt" | "square", value: number, angleUnit: "degrees" | "radians" = "degrees") => {
	if (!Number.isFinite(value)) throw new Error("Enter a finite number first.");
	if (operation === "sqrt" && value < 0) throw new Error("Square root needs a number that is zero or greater.");
	if ((operation === "log" || operation === "ln") && value <= 0) throw new Error("Logarithms need a number greater than zero.");
	const angle = angleUnit === "degrees" ? value * Math.PI / 180 : value;
	const result = operation === "sin" ? Math.sin(angle)
		: operation === "cos" ? Math.cos(angle)
			: operation === "tan" ? Math.tan(angle)
				: operation === "log" ? Math.log10(value)
					: operation === "ln" ? Math.log(value)
						: operation === "sqrt" ? Math.sqrt(value) : value ** 2;
	if (!Number.isFinite(result)) throw new Error("That operation does not have a finite result.");
	return normalizeCalculatorNumber(result);
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
