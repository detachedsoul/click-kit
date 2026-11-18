import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { coverBox, fitWithin, scaleByHeight, scaleByWidth, scaleTable, simplifyRatio } from "@/features/calculators/aspect-utils";
import AspectCalculator from "@/features/calculators/aspect-calculator";

afterEach(cleanup);

describe("aspect ratio calculator", () => {
	it("simplifies sizes into whole-number ratios", () => {
		expect(simplifyRatio(1920, 1080)).toMatchObject({ label: "16:9", decimal: 1.7778, exact: true });
		expect(simplifyRatio(1000, 1000)).toMatchObject({ label: "1:1", exact: true });
		expect(simplifyRatio(1280, 1024)).toMatchObject({ label: "5:4", decimal: 1.25 });
		expect(simplifyRatio(1080, 1920).label).toBe("9:16");
	});

	it("finds the closest preset", () => {
		const result = simplifyRatio(1366, 768);
		expect(result.closest.label).toBe("16:9");
		expect(result.exact).toBe(false);
		expect(simplifyRatio(1600, 900).closest.label).toBe("16:9");
	});

	it("scales from a width or a height", () => {
		expect(scaleByWidth(1280, 16, 9)).toEqual({ width: 1280, height: 720 });
		expect(scaleByHeight(720, 16, 9)).toEqual({ width: 1280, height: 720 });
		expect(scaleByWidth(1000, 4, 3)).toEqual({ width: 1000, height: 750 });
	});

	it("fits and covers a box", () => {
		expect(fitWithin(1200, 630, 1, 1)).toEqual({ width: 630, height: 630, cropped: false });
		expect(fitWithin(4000, 4000, 16, 9)).toEqual({ width: 4000, height: 2250, cropped: false });
		expect(coverBox(1200, 630, 1, 1)).toEqual({ width: 1200, height: 1200 });
		expect(coverBox(1200, 630, 16, 9)).toEqual({ width: 1200, height: 675 });
	});

	it("lists common sizes and validates input", () => {
		expect(scaleTable(16, 9, [640, 1920])).toEqual(["640 × 360", "1920 × 1080"]);
		expect(() => simplifyRatio(0, 100)).toThrow(/Width must be a positive number/u);
		expect(() => simplifyRatio(100, -1)).toThrow(/Height must be a positive number/u);
		expect(() => scaleByWidth(100, 0, 9)).toThrow(/Ratio width/u);
	});

	it("renders each mode", async () => {
		const user = userEvent.setup();
		render(<AspectCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("Ratio         16:9");
		await user.selectOptions(screen.getByLabelText("Mode"), "scale");
		expect(output()).toContain("→ height 720");
		await user.selectOptions(screen.getByLabelText("Mode"), "fit");
		expect(output()).toContain("Contain (fit)");
		fireEvent.change(screen.getByLabelText("Box width"), { target: { value: "0" } });
		expect(screen.getByRole("alert").textContent).toContain("must be a positive number");
	});
});
