import userEvent from "@testing-library/user-event";
import AgeCalculator from "@/features/calculators/age-calculator";
import BmiCalculator from "@/features/calculators/bmi-calculator";
import LoanCalculator from "@/features/calculators/loan-calculator";
import ScientificCalculator from "@/features/calculators/scientific-calculator";
import TipSplitCalculator from "@/features/calculators/tip-split-calculator";
import PercentageCalculator from "@/features/calculators/percentage-calculator";
import StandardCalculator from "@/features/calculators/standard-calculator";
import UnitConverter from "@/features/calculators/unit-converter";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("StandardCalculator", () => {
	it("calculates keypad expressions with operator precedence", async () => {
		const user = userEvent.setup();
		render(<StandardCalculator />);
		await user.click(screen.getByRole("button", { name: "7" }));
		await user.click(screen.getByRole("button", { name: "+" }));
		await user.click(screen.getByRole("button", { name: "3" }));
		await user.click(screen.getByRole("button", { name: "×" }));
		await user.click(screen.getByRole("button", { name: "2" }));
		await user.click(screen.getByRole("button", { name: "=" }));
		expect(screen.getByRole("status", { name: "Calculator result" }).textContent).toBe("13");
	});

	it("supports keyboard entry and announces division-by-zero errors", async () => {
		const user = userEvent.setup();
		render(<StandardCalculator />);
		const expression = screen.getByRole("textbox", { name: "Calculation" });
		await user.type(expression, "2 + 3 * 4");
		await user.keyboard("{Enter}");
		expect(screen.getByRole("status", { name: "Calculator result" }).textContent).toBe("14");
		fireEvent.change(expression, { target: { value: "8 / (3 - 3)" } });
		await user.keyboard("{Enter}");
		expect(screen.getByRole("alert").textContent).toContain("divide by zero");
	});
});

describe("PercentageCalculator", () => {
	it("shows a live percentage-of result", () => {
		render(<PercentageCalculator />);
		fireEvent.change(screen.getByRole("textbox", { name: "Percentage" }), { target: { value: "15" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Number" }), { target: { value: "200" } });
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("30");
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("15% of 200 is 30");
	});

	it("calculates percentage change and reports an undefined zero baseline", () => {
		render(<PercentageCalculator />);
		fireEvent.change(screen.getByLabelText("Calculate"), { target: { value: "change" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Starting value" }), { target: { value: "80" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Ending value" }), { target: { value: "100" } });
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("25%");
		fireEvent.change(screen.getByRole("textbox", { name: "Starting value" }), { target: { value: "0" } });
		expect(screen.getByRole("alert").textContent).toContain("undefined");
	});
});

describe("AgeCalculator", () => {
	it("handles leap-day birthdays and shows calendar age", () => {
		render(<AgeCalculator />);
		fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "2000-02-29" } });
		fireEvent.change(screen.getByLabelText("Age on"), { target: { value: "2025-02-27" } });
		const result = screen.getByRole("region", { name: "Calculated age" });
		expect(result.textContent).toContain("24 years, 11 months, and 29 days old");
		expect(result.textContent).toContain("Total days");
	});

	it("compares two dates and reports reversed ranges", () => {
		render(<AgeCalculator />);
		fireEvent.click(screen.getByRole("radio", { name: "Time between dates" }));
		fireEvent.change(screen.getByLabelText("From"), { target: { value: "2024-01-01" } });
		fireEvent.change(screen.getByLabelText("To"), { target: { value: "2025-01-01" } });
		expect(screen.getByRole("region", { name: "Time between dates" }).textContent).toContain("366");
		fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-02-01" } });
		expect(screen.getByRole("alert").textContent).toContain("end date");
	});
});

describe("ScientificCalculator", () => {
	it("evaluates arithmetic and applies a scientific function", async () => {
		const user = userEvent.setup();
		render(<ScientificCalculator />);
		await user.type(screen.getByRole("textbox", { name: "Calculation" }), "9");
		await user.click(screen.getByRole("button", { name: "Insert square root function" }));
		expect(screen.getByRole("region", { name: "Scientific calculator result" }).textContent).toContain("3");
	});

	it("shows binary output for safe whole-number results", async () => {
		const user = userEvent.setup();
		render(<ScientificCalculator />);
		await user.type(screen.getByRole("textbox", { name: "Calculation" }), "10");
		await user.selectOptions(screen.getByRole("combobox", { name: "Number base" }), "binary");
		expect(screen.getByRole("region", { name: "Scientific calculator result" }).textContent).toContain("1010₂");
	});

	it("stores answers in history and reuses Ans in later expressions", async () => {
		const user = userEvent.setup();
		render(<ScientificCalculator />);
		const expression = screen.getByRole("textbox", { name: "Calculation" });
		await user.type(expression, "2^3");
		await user.click(screen.getByRole("button", { name: "Calculate =" }));
		expect(screen.getByRole("region", { name: "Scientific calculator result" }).textContent).toContain("8");
		expect(screen.getByRole("heading", { name: "Recent calculations" })).toBeTruthy();
		await user.clear(expression);
		await user.type(expression, "ans + 2");
		expect(screen.getByRole("region", { name: "Scientific calculator result" }).textContent).toContain("10");
	});
});

describe("LoanCalculator", () => {
	it("shows estimated monthly payments and total interest", () => {
		render(<LoanCalculator />);
		fireEvent.change(screen.getByRole("textbox", { name: "Loan amount" }), { target: { value: "12000" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Annual interest rate (%)" }), { target: { value: "0" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Loan term (months)" }), { target: { value: "12" } });
		const result = screen.getByRole("region", { name: "Loan payment estimate" });
		expect(result.textContent).toContain("1,000");
		expect(result.textContent).toContain("Total interest: 0");
	});
});

describe("TipSplitCalculator", () => {
	it("splits the bill and tip evenly", () => {
		render(<TipSplitCalculator />);
		fireEvent.change(screen.getByRole("textbox", { name: "Bill amount" }), { target: { value: "80" } });
		const result = screen.getByRole("region", { name: "Bill split result" });
		expect(result.textContent).toContain("46");
		expect(result.textContent).toContain("Tip total: 12");
	});
});

describe("BmiCalculator", () => {
	it("shows BMI with an adult screening category", () => {
		render(<BmiCalculator />);
		fireEvent.change(screen.getByRole("textbox", { name: "Height (cm)" }), { target: { value: "170" } });
		fireEvent.change(screen.getByRole("textbox", { name: "Weight (kg)" }), { target: { value: "65" } });
		const result = screen.getByRole("region", { name: "BMI result" });
		expect(result.textContent).toContain("22.491");
		expect(result.textContent).toContain("Healthy weight");
	});
});

describe("UnitConverter", () => {
	it("groups large numeric input while keeping the cursor stable for edits", async () => {
		const user = userEvent.setup();
		render(<UnitConverter />);
		const valueField = screen.getByRole("textbox", { name: "Value" }) as HTMLInputElement;
		await user.clear(valueField);
		await user.type(valueField, "1234567");
		expect(valueField.value).toBe("1,234,567");
		valueField.setSelectionRange(5, 5);
		await user.keyboard("{Backspace}");
		expect(valueField.value).toBe("123,567");
		expect(valueField.selectionStart).toBe(3);
	});

	it("converts a value in a selected measurement category", () => {
		render(<UnitConverter />);
		const result = screen.getByRole("region", { name: "Conversion result" });
		expect(result.textContent).toContain("3.280839895");
		fireEvent.change(screen.getByLabelText("Measurement"), { target: { value: "temperature" } });
		fireEvent.change(screen.getByLabelText("Value"), { target: { value: "0" } });
		fireEvent.change(screen.getByLabelText("From"), { target: { value: "celsius" } });
		fireEvent.change(screen.getByLabelText("To"), { target: { value: "fahrenheit" } });
		expect(result.textContent).toContain("32 °F");
	});

	it("swaps source and destination units", async () => {
		const user = userEvent.setup();
		render(<UnitConverter />);
		await user.click(screen.getByRole("button", { name: "Swap units" }));
		expect((screen.getByLabelText("From") as HTMLSelectElement).value).toBe("foot");
		expect((screen.getByLabelText("To") as HTMLSelectElement).value).toBe("meter");
	});
});
