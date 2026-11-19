import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import RecipeTool from "@/features/calculators/recipe-tool";

afterEach(cleanup);

describe("recipe scaler", () => {
	it("scales the sample recipe from four to six servings", () => {
		render(<RecipeTool />);
		expect(screen.getByLabelText("Recipe serves")).toHaveProperty("value", "4");
		expect(screen.getByLabelText("You want to serve")).toHaveProperty("value", "6");
		expect(document.body.textContent).toContain("1.5×");
		expect(document.body.textContent).toContain("3 cups flour");
		expect(document.body.textContent).toContain("2 1/4 tsp baking powder");
		expect(document.body.textContent).toContain("4 1/2 eggs");
		expect(document.body.textContent).toContain("Salt to taste");
	});

	it("re-scales when the servings change", async () => {
		const user = userEvent.setup();
		render(<RecipeTool />);
		const target = screen.getByLabelText("You want to serve");
		await user.clear(target);
		await user.type(target, "2");
		expect(document.body.textContent).toContain("0.5×");
		expect(document.body.textContent).toContain("1 cup flour");
	});

	it("explains bad servings", async () => {
		const user = userEvent.setup();
		render(<RecipeTool />);
		const original = screen.getByLabelText("Recipe serves");
		await user.clear(original);
		await user.type(original, "0");
		expect(document.body.textContent).toContain("Original servings must be more than zero.");
	});
});
