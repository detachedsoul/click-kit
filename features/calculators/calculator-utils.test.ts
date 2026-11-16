import { describe, expect, it } from "vitest";
import { calculateAge, calculateBmi, calculateCalendarDifference, calculateLoanPayment, calculatePercentage, calculateScientificFunction, calculateTipSplit, convertMeasurement, evaluateArithmeticExpression } from "@/features/calculators/calculator-utils";

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
