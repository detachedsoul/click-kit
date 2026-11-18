import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dateDifference, monthDifference } from "@/features/calculators/date-diff-utils";
import DateDiffCalculator from "@/features/calculators/date-diff-calculator";

afterEach(cleanup);

describe("date difference calculator", () => {
	it("counts calendar days between dates", () => {
		expect(dateDifference("2024-01-01", "2024-01-31").days).toBe(30);
		expect(dateDifference("2024-01-01", "2024-01-01").days).toBe(0);
		expect(dateDifference("2024-01-01", "2024-03-01").days).toBe(60);
		expect(dateDifference("2023-01-01", "2024-01-01").days).toBe(365);
		expect(dateDifference("2024-01-01", "2024-01-31", { includeEnd: true }).days).toBe(31);
	});

	it("counts working and weekend days", () => {
		const week = dateDifference("2024-01-01", "2024-01-08");
		expect(week.businessDays).toBe(5);
		expect(week.weekendDays).toBe(2);
		const withEnd = dateDifference("2024-01-01", "2024-01-05", { includeEnd: true });
		expect(withEnd.businessDays).toBe(5);
		expect(withEnd.weekendDays).toBe(0);
	});

	it("breaks the difference into years, months, and days", () => {
		expect(dateDifference("2020-02-29", "2021-03-01").breakdown).toBe("1 year, 1 day");
		expect(dateDifference("2024-01-31", "2024-03-01").breakdown).toBe("1 month, 1 day");
		expect(dateDifference("2024-05-01", "2024-05-01").breakdown).toBe("the same day");
		expect(monthDifference("2024-01-31", "2024-03-01")).toBe(1);
		expect(monthDifference("2024-01-01", "2024-03-01")).toBe(2);
	});

	it("swaps reversed dates", () => {
		const result = dateDifference("2024-03-10", "2024-03-01");
		expect(result.swapped).toBe(true);
		expect(result.days).toBe(9);
	});

	it("rejects invalid dates", () => {
		expect(() => dateDifference("01/02/2024", "2024-01-01")).toThrow(/YYYY-MM-DD/u);
		expect(() => dateDifference("2024-02-31", "2024-03-01")).toThrow(/not a real date/u);
	});

	it("renders the result and updates", () => {
		render(<DateDiffCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("From 2024-01-01");
		fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2024-01-31" } });
		expect(output()).toContain("Calendar    30 days (4 weeks 2 days)");
		fireEvent.click(screen.getByLabelText("Count the end date as a full day"));
		expect(output()).toContain("Calendar    31 days");
		fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2024-02-31" } });
		expect(screen.getByRole("alert").textContent).toMatch(/date/iu);
	});
});
