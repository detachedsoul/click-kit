import { describe, expect, it } from "vitest";
import { factorLabel, formatQuantity, parseIngredient, scaleFactor, scaledText, scaleIngredients, unitForQuantity } from "@/features/calculators/recipe-utils";

describe("recipe scaler", () => {
	it("reads quantities, fractions, and units", () => {
		expect(parseIngredient("2 cups flour")).toEqual({ line: "2 cups flour", quantity: 2, unit: "cups", name: "flour" });
		expect(parseIngredient("1 1/2 tsp salt")).toEqual({ line: "1 1/2 tsp salt", quantity: 1.5, unit: "tsp", name: "salt" });
		expect(parseIngredient("1/2 cup sugar")).toEqual({ line: "1/2 cup sugar", quantity: 0.5, unit: "cup", name: "sugar" });
		expect(parseIngredient("½ cup milk").quantity).toBe(0.5);
		expect(parseIngredient("1,5 kg potatoes").quantity).toBe(1.5);
		expect(parseIngredient("3 eggs")).toEqual({ line: "3 eggs", quantity: 3, unit: "", name: "eggs" });
		expect(parseIngredient("half a lemon").quantity).toBe(0.5);
		expect(parseIngredient("salt to taste")).toEqual({ line: "salt to taste", quantity: null, unit: "", name: "salt to taste" });
	});

	it("formats amounts the way a kitchen reads them", () => {
		expect(formatQuantity(2)).toBe("2");
		expect(formatQuantity(0.5)).toBe("1/2");
		expect(formatQuantity(0.75)).toBe("3/4");
		expect(formatQuantity(1.5)).toBe("1 1/2");
		expect(formatQuantity(1 / 3)).toBe("1/3");
		expect(formatQuantity(2.5)).toBe("2 1/2");
		expect(formatQuantity(0.01)).toBe("a pinch");
		expect(formatQuantity(2.97)).toBe("3");
		expect(formatQuantity(1.2)).toBe("1.2");
		expect(formatQuantity(0)).toBe("0");
	});

	it("scales a whole list and leaves notes alone", () => {
		const text = "2 cups flour\n1/2 tsp salt\n3 eggs\nSalt to taste";
		const doubled = scaleIngredients(text, 2);
		expect(doubled.map((item) => item.scaledText)).toEqual(["4 cups flour", "1 tsp salt", "6 eggs", "Salt to taste"]);
		expect(doubled[3].scaled).toBeNull();
		const halved = scaleIngredients(text, 0.5);
		expect(halved.map((item) => item.scaledText)).toEqual(["1 cup flour", "1/4 tsp salt", "1 1/2 eggs", "Salt to taste"]);
		expect(scaledText(doubled).split("\n")).toHaveLength(4);
		expect(scaleIngredients("\n\n", 2)).toEqual([]);
		expect(unitForQuantity("cups", 1)).toBe("cup");
		expect(unitForQuantity("cups", 4)).toBe("cups");
		expect(unitForQuantity("g", 1)).toBe("g");
		expect(unitForQuantity("", 1)).toBe("");
	});

	it("guards the servings and the factor", () => {
		expect(scaleFactor(4, 6)).toBe(1.5);
		expect(factorLabel(1.5)).toBe("1.5×");
		expect(() => scaleFactor(0, 2)).toThrow(/more than zero/u);
		expect(() => scaleFactor(4, 0)).toThrow(/more than zero/u);
		expect(() => scaleFactor(1, 100)).toThrow(/twenty times/u);
		expect(() => scaleIngredients("1 egg", 0)).toThrow(/scale factor/u);
	});
});
