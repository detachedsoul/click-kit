import { describe, expect, it } from "vitest";
import { calculateAge, calculateCalendarDifference, calculatePercentage, convertMeasurement, evaluateArithmeticExpression } from "@/features/calculators/calculator-utils";

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
