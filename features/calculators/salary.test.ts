import { describe, expect, it } from "vitest";
import { convertPay, DEFAULT_SETTINGS, formatMoney, normaliseSettings, payReport, PAY_PERIODS } from "@/features/calculators/salary-utils";

describe("pay converter", () => {
	it("converts an hourly rate upward", () => {
		const result = convertPay(100, "hour");
		expect(result.hour).toBe(100);
		expect(result.week).toBe(4000);
		expect(result.day).toBe(800);
		expect(result.year).toBe(208000);
		expect(result.month).toBe(17333.33);
		expect(result.hoursPerYear).toBe(2080);
	});

	it("converts a salary back to hours", () => {
		const result = convertPay(208000, "year");
		expect(result.hour).toBe(100);
		expect(result.month).toBe(17333.33);
		expect(convertPay(208000 / 12, "month").year).toBeCloseTo(208000, 0);
		expect(convertPay(48000, "week").hour).toBe(1200);
		expect(convertPay(9600, "day").hour).toBe(1200);
	});

	it("respects different working patterns", () => {
		const part = convertPay(100, "hour", { hoursPerWeek: 20, daysPerWeek: 4, weeksPerYear: 50 });
		expect(part.week).toBe(2000);
		expect(part.day).toBe(500);
		expect(part.year).toBe(100000);
		expect(part.month).toBe(8333.33);
	});

	it("rejects nonsense and clamps nothing silently", () => {
		expect(() => convertPay(-1, "hour")).toThrow(/Enter the pay amount/u);
		expect(() => convertPay(Number.NaN, "hour")).toThrow(/Enter the pay amount/u);
		expect(normaliseSettings(DEFAULT_SETTINGS)).toEqual({ hoursPerWeek: 40, daysPerWeek: 5, weeksPerYear: 52 });
		expect(() => normaliseSettings({ ...DEFAULT_SETTINGS, hoursPerWeek: 0 })).toThrow(/more than zero/u);
		expect(() => normaliseSettings({ ...DEFAULT_SETTINGS, daysPerWeek: 9 })).toThrow(/cannot be more than 7/u);
		expect(() => normaliseSettings({ ...DEFAULT_SETTINGS, weeksPerYear: 60 })).toThrow(/cannot be more than 52/u);
	});

	it("formats money and the report", () => {
		expect(formatMoney(250000, "NGN")).toContain("250,000");
		expect(formatMoney(12.5, "USD")).toContain("12.5");
		expect(formatMoney(1000, "NOTACODE")).toContain("1,000");
		const report = payReport(100, "hour", "USD");
		expect(report).toContain("Per hour");
		expect(report).toContain("Hours per week   40");
		expect(report).toContain("Hours per year   2,080");
		expect(PAY_PERIODS.map((period) => period.id)).toEqual(["hour", "day", "week", "month", "year"]);
	});
});
