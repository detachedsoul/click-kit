import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { compareUnitPrices, money } from "@/features/calculators/unit-price-utils";
import UnitPriceCalculator from "@/features/calculators/unit-price-calculator";

afterEach(cleanup);

const offer = (id: string, price: number, quantity: number, unit: "g" | "kg" | "ml" | "l" | "item") => ({ id, name: id, price, quantity, unit });

describe("unit price comparison", () => {
	it("normalises prices to a shared measure", () => {
		const result = compareUnitPrices([offer("small", 1.35, 250, "g"), offer("big", 4.2, 1, "kg")]);
		expect(result.cheapest?.id).toBe("big");
		expect(result.rows.find((row) => row.id === "small")?.pricePerHundred).toBeCloseTo(0.54, 5);
		expect(result.rows.find((row) => row.id === "big")?.pricePerHundred).toBeCloseTo(0.42, 5);
		expect(result.measureLabel).toBe("per 100 g");
		expect(result.savingPercent).toBeCloseTo(22.2, 1);
	});

	it("handles litres, millilitres, and counts", () => {
		const litres = compareUnitPrices([offer("one", 3, 1.5, "l"), offer("two", 2, 750, "ml")]);
		expect(litres.cheapest?.id).toBe("one");
		expect(litres.measureLabel).toBe("per 100 ml");
		const items = compareUnitPrices([offer("pack", 6, 12, "item"), offer("single", 0.7, 1, "item")]);
		expect(items.cheapest?.id).toBe("pack");
		expect(items.measureLabel).toBe("per item");
		expect(items.mixedMeasures).toBe(false);
	});

	it("flags mixed measures and rejects empty input", () => {
		const mixed = compareUnitPrices([offer("grams", 2, 500, "g"), offer("litres", 2, 1, "l")]);
		expect(mixed.mixedMeasures).toBe(true);
		expect(mixed.measureLabel).toBe("mixed units");
		expect(() => compareUnitPrices([{ ...offer("zero", 0, 0, "g"), name: "" }])).toThrow(/at least one offer/u);
		expect(money(1.005)).toBe("1.00");
	});

	it("renders the comparison and updates when a price changes", async () => {
		const user = userEvent.setup();
		render(<UnitPriceCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("★ 01. Large bag");
		await user.clear(screen.getByLabelText("Offer 3 price"));
		await user.type(screen.getByLabelText("Offer 3 price"), "0.99");
		expect(output()).toContain("Corner shop");
		await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
		expect(output()).not.toContain("Supermarket own brand");
	});
});
