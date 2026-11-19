import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import SalaryCalculator from "@/features/calculators/salary-calculator";

afterEach(cleanup);

describe("salary calculator", () => {
	it("converts a monthly salary into every period by default", () => {
		render(<SalaryCalculator />);
		expect(screen.getByLabelText("Pay amount")).toHaveProperty("value", "250000");
		expect(screen.getByLabelText("That amount is…")).toHaveProperty("value", "month");
		expect(screen.getByLabelText("Currency")).toHaveProperty("value", "NGN");
		expect(screen.getByLabelText("Hours per week")).toHaveProperty("value", "40");
		expect(document.body.textContent).toContain("3,000,000");
		expect(document.body.textContent).toContain("2,080");
	});

	it("recalculates when the amount or the working week changes", async () => {
		const user = userEvent.setup();
		render(<SalaryCalculator />);
		const amount = screen.getByLabelText("Pay amount");
		await user.clear(amount);
		await user.type(amount, "1000000");
		expect(document.body.textContent).toContain("12,000,000");

		fireEvent.change(screen.getByLabelText("Hours per week"), { target: { value: "20" } });
		expect(screen.getByLabelText("Hours per week")).toHaveProperty("value", "20");
		expect(document.body.textContent).toContain("1,040");
	});

	it("explains a bad amount instead of guessing", async () => {
		const user = userEvent.setup();
		render(<SalaryCalculator />);
		const amount = screen.getByLabelText("Pay amount");
		await user.clear(amount);
		await user.type(amount, "-5");
		expect(document.body.textContent).toContain("Enter the pay amount first.");
	});
});
