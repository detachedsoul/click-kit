import userEvent from "@testing-library/user-event";
import AgeCalculator from "@/features/calculators/age-calculator";
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
		fireEvent.change(screen.getByRole("spinbutton", { name: "Percentage" }), { target: { value: "15" } });
		fireEvent.change(screen.getByRole("spinbutton", { name: "Number" }), { target: { value: "200" } });
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("30");
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("15% of 200 is 30");
	});

	it("calculates percentage change and reports an undefined zero baseline", () => {
		render(<PercentageCalculator />);
		fireEvent.change(screen.getByLabelText("Calculate"), { target: { value: "change" } });
		fireEvent.change(screen.getByRole("spinbutton", { name: "Starting value" }), { target: { value: "80" } });
		fireEvent.change(screen.getByRole("spinbutton", { name: "Ending value" }), { target: { value: "100" } });
		expect(screen.getByRole("region", { name: "Percentage result" }).textContent).toContain("25%");
		fireEvent.change(screen.getByRole("spinbutton", { name: "Starting value" }), { target: { value: "0" } });
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

describe("UnitConverter", () => {
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
