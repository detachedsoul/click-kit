import { describe, expect, it } from "vitest";
import { calculateAge, calculateBmi, calculateCalendarDifference, calculateLoanPayment, calculatePercentage, calculateScientificFunction, calculateTipSplit, calculateDefiniteIntegral, convertMeasurement, evaluateScientificExpression, evaluateArithmeticExpression } from "@/features/calculators/calculator-utils";

describe("standard calculator", () => {
	it("respects operator precedence, parentheses, and unary signs", () => {
		expect(evaluateArithmeticExpression("2 + 3 * 4")).toBe(14);
		expect(evaluateArithmeticExpression("(2 + 3) * 4")).toBe(20);
		expect(evaluateArithmeticExpression("-3 + +2 * 4")).toBe(5);
	});

	it("normalizes common floating-point arithmetic", () => {
		expect(evaluateArithmeticExpression("0.1 + 0.2")).toBe(0.3);
		expect(evaluateArithmeticExpression("1 / 3")).toBeCloseTo(1 / 3, 14);
	});

	it("reports empty, incomplete, invalid, and zero-division expressions", () => {
		expect(() => evaluateArithmeticExpression(" ")).toThrow(/Enter a calculation/u);
		expect(() => evaluateArithmeticExpression("5 +")).toThrow(/character/u);
		expect(() => evaluateArithmeticExpression("8 / (3 - 3)")).toThrow(/divide by zero/u);
		expect(() => evaluateArithmeticExpression("2 + words")).toThrow(/character/u);
	});
});

describe("percentage calculator", () => {
	it("calculates a percentage of a number", () => {
		expect(calculatePercentage("of", 15, 200)).toEqual({ result: 30, change: 30 });
	});

	it("calculates percentage changes and increase or decrease amounts", () => {
		expect(calculatePercentage("change", 80, 100)).toEqual({ result: 25, change: 20 });
		expect(calculatePercentage("increase", 100, 10)).toEqual({ result: 110, change: 10 });
		expect(calculatePercentage("decrease", 100, 10)).toEqual({ result: 90, change: -10 });
		expect(calculatePercentage("decrease", 100, 150)).toEqual({ result: -50, change: -150 });
	});

	it("rejects undefined change from zero and non-finite values", () => {
		expect(() => calculatePercentage("change", 0, 25)).toThrow(/undefined/u);
		expect(() => calculatePercentage("of", Number.NaN, 2)).toThrow(/valid numbers/u);
	});
});

describe("age and date calculator", () => {
	it("calculates completed calendar years, months, days, and total days", () => {
		expect(calculateAge("2000-01-15", "2024-03-20")).toEqual({ years: 24, months: 2, days: 5, totalDays: 8831 });
	});

	it("handles a February 29 birthday on leap and non-leap years", () => {
		expect(calculateAge("2000-02-29", "2024-02-29")).toMatchObject({ years: 24, months: 0, days: 0 });
		expect(calculateAge("2000-02-29", "2025-02-27")).toMatchObject({ years: 24, months: 11, days: 29 });
		expect(calculateAge("2000-02-29", "2025-02-28")).toMatchObject({ years: 25, months: 0, days: 0 });
	});

	it("finds calendar differences and rejects invalid or reversed dates", () => {
		expect(calculateCalendarDifference("2000-01-31", "2000-03-02")).toMatchObject({ years: 0, months: 1, days: 2, totalDays: 31 });
		expect(calculateCalendarDifference("2024-01-01", "2025-01-01")).toMatchObject({ years: 1, months: 0, days: 0, totalDays: 366 });
		expect(() => calculateAge("2025-01-01", "2024-12-31")).toThrow(/end date/u);
		expect(() => calculateAge("2025-02-30", "2025-03-01")).toThrow(/valid date/u);
	});
});

describe("additional calculators", () => {
	it("estimates fixed-rate loan payments including zero-interest loans", () => {
		expect(calculateLoanPayment(12000, 0, 12)).toEqual({ monthlyPayment: 1000, totalPaid: 12000, totalInterest: 0 });
		expect(calculateLoanPayment(10000, 12, 12).monthlyPayment).toBeCloseTo(888.4879, 3);
		expect(() => calculateLoanPayment(10000, -1, 12)).toThrow(/cannot be negative/u);
		expect(() => calculateLoanPayment(10000, 5, 0)).toThrow(/whole number/u);
	});

	it("calculates a tip and evenly split total with validation", () => {
		expect(calculateTipSplit(80, 15, 4)).toEqual({ tipAmount: 12, total: 92, tipPerPerson: 3, totalPerPerson: 23 });
		expect(() => calculateTipSplit(80, 15, 0)).toThrow(/Group size/u);
	});

	it("calculates metric and imperial BMI and adult screening categories", () => {
		expect(calculateBmi(65, 170).bmi).toBeCloseTo(22.49134948096886, 12);
		expect(calculateBmi(65, 170).category).toBe("Healthy weight");
		expect(calculateBmi(145, 67, "imperial").bmi).toBeCloseTo(22.7, 1);
		expect(calculateBmi(40, 170).category).toBe("Underweight");
		expect(calculateBmi(85, 170).category).toBe("Overweight");
		expect(calculateBmi(100, 170).category).toBe("Obesity");
		expect(() => calculateBmi(0, 170)).toThrow(/greater than zero/u);
	});

	it("applies scientific functions with selected angle units and domain checks", () => {
		expect(calculateScientificFunction("sin", 30)).toBe(0.5);
		expect(calculateScientificFunction("cos", Math.PI, "radians")).toBe(-1);
		expect(calculateScientificFunction("log", 100)).toBe(2);
		expect(calculateScientificFunction("sqrt", 9)).toBe(3);
		expect(calculateScientificFunction("square", -4)).toBe(16);
		expect(() => calculateScientificFunction("ln", 0)).toThrow(/greater than zero/u);
	});

	it("evaluates powers, remainders, factorials, constants, and previous answers safely", () => {
		expect(evaluateScientificExpression("2^3^2")).toBe(512);
		expect(evaluateScientificExpression("-2^2")).toBe(-4);
		expect(evaluateScientificExpression("2(3 + 4) + 2pi")).toBeCloseTo(14 + Math.PI * 2, 12);
		expect(evaluateScientificExpression("2sin(30)")).toBe(1);
		expect(evaluateScientificExpression("10 % 4 + 5!")).toBe(122);
		expect(evaluateScientificExpression("pi + tau + e + phi")).toBeCloseTo(Math.PI + Math.PI * 2 + Math.E + (1 + Math.sqrt(5)) / 2, 12);
		expect(evaluateScientificExpression("ans * 2", "degrees", 21)).toBe(42);
		expect(() => evaluateScientificExpression("171!")).toThrow(/0 to 170/u);
	});

	it("evaluates scientific functions, multiple arguments, and angle modes", () => {
		expect(evaluateScientificExpression("sin(30) + cos(60)")).toBe(1);
		expect(evaluateScientificExpression("asin(0.5)")).toBe(30);
		expect(evaluateScientificExpression("log(8, 2) + root(27, 3)")).toBe(6);
		expect(evaluateScientificExpression("max(2, 8, 4) + hypot(3, 4) + clamp(12, 0, 10)")).toBe(23);
		expect(evaluateScientificExpression("sin(pi / 6)", "radians")).toBe(0.5);
		expect(evaluateScientificExpression("cosh(0) + floor(2.9) + ceil(2.1) + round(2.4) + abs(-1) + inv(2) + exp(0) + cbrt(8) + atan2(1, 0)")).toBeCloseTo(102.5, 10);
		expect(evaluateScientificExpression("sec(60) + csc(30) + cot(45)")).toBeCloseTo(5, 10);
		expect(evaluateScientificExpression("mean(1, 2, 3) + median(1, 9, 2, 4) + variance(1, 2, 3) + stdev(1, 2, 3)")).toBeCloseTo(5 + 2 / 3 + Math.sqrt(2 / 3), 10);
		expect(evaluateScientificExpression("round(-2.5)")).toBe(-3);
		expect(evaluateScientificExpression("mean(1e308, 1e308) / median(1e308, 1e308)")).toBe(1);
		expect(evaluateScientificExpression("comb(5, 2) + perm(5, 2) + deg(pi) + rad(180)")).toBeCloseTo(10 + 20 + 180 + Math.PI, 10);
		expect(evaluateScientificExpression("c + g0")).toBeCloseTo(299792458 + 9.80665, 8);
		expect(evaluateScientificExpression("h")).toBe(6.62607015e-34);
		expect(evaluateScientificExpression("kb")).toBe(1.380649e-23);
		expect(evaluateScientificExpression("na")).toBe(6.02214076e23);
	});

	it("approximates definite integrals with validated bounds and radians", () => {
		expect(calculateDefiniteIntegral("x^2", 0, 1)).toBeCloseTo(1 / 3, 8);
		expect(calculateDefiniteIntegral("2x", -3, 4)).toBeCloseTo(7, 8);
		expect(calculateDefiniteIntegral("sin(x)", 0, Math.PI)).toBeCloseTo(2, 8);
		expect(calculateDefiniteIntegral("exp(-x^2)", -1, 1)).toBeCloseTo(1.49364826562485, 8);
		expect(calculateDefiniteIntegral("x^2", 1, 0)).toBeCloseTo(-1 / 3, 8);
		expect(calculateDefiniteIntegral("3", 0, 2)).toBe(6);
		expect(calculateDefiniteIntegral("ans * x", 0, 2, "radians", 3)).toBeCloseTo(6, 8);
	});

	it("reports invalid or non-finite integration expressions clearly", () => {
		expect(() => calculateDefiniteIntegral("x", Number.NaN, 1)).toThrow(/finite lower and upper bounds/u);
		expect(() => calculateDefiniteIntegral("x +", 0, 1)).toThrow(/character/u);
		expect(() => calculateDefiniteIntegral("1 / x", -1, 1)).toThrow(/divide by zero/u);
		expect(() => evaluateScientificExpression("x")).toThrow(/Unknown constant/u);
	});

	it("rejects invalid scientific syntax, domains, and unsafe input", () => {
		expect(() => evaluateScientificExpression("sqrt(-1)")).toThrow(/not defined/u);
		expect(() => evaluateScientificExpression("log(1, 1)")).toThrow(/base/u);
		expect(() => evaluateScientificExpression("root(-4, 2)")).toThrow(/zero or greater/u);
		expect(() => evaluateScientificExpression("unknown(3)")).toThrow(/Unknown function/u);
		expect(() => evaluateScientificExpression("tan(90)")).toThrow(/undefined/u);
		expect(() => evaluateScientificExpression("atan2(0, 0)")).toThrow(/both inputs/u);
		expect(() => evaluateScientificExpression("min(2)")).toThrow(/at least 2 arguments/u);
		expect(() => evaluateScientificExpression("2 + 2; alert(1)")).toThrow(/Unexpected character/u);
		expect(() => evaluateScientificExpression("1".repeat(501))).toThrow(/500 characters/u);
	});
});

describe("unit converter", () => {
	it("converts standard length, mass, volume, area, and time units", () => {
		expect(convertMeasurement(1, "length", "meter", "foot")).toBeCloseTo(3.280839895, 8);
		expect(convertMeasurement(1, "mass", "kilogram", "pound")).toBeCloseTo(2.20462262185, 10);
		expect(convertMeasurement(1, "volume", "us-cup", "milliliter")).toBeCloseTo(236.5882365, 7);
		expect(convertMeasurement(1, "area", "acre", "square-meter")).toBeCloseTo(4046.8564224, 7);
		expect(convertMeasurement(1, "time", "hour", "minute")).toBe(60);
	});

	it("converts temperature with the correct offsets and scales", () => {
		expect(convertMeasurement(0, "temperature", "celsius", "fahrenheit")).toBe(32);
		expect(convertMeasurement(32, "temperature", "fahrenheit", "celsius")).toBe(0);
		expect(convertMeasurement(273.15, "temperature", "kelvin", "celsius")).toBe(0);
	});

	it("rejects incompatible units, invalid values, and temperatures below absolute zero", () => {
		expect(() => convertMeasurement(1, "length", "meter", "kilogram")).toThrow(/same measurement category/u);
		expect(() => convertMeasurement(Number.NaN, "length", "meter", "foot")).toThrow(/valid number/u);
		expect(() => convertMeasurement(-1, "temperature", "kelvin", "celsius")).toThrow(/absolute zero/u);
		expect(() => convertMeasurement(-274, "temperature", "celsius", "kelvin")).toThrow(/absolute zero/u);
	});
});
