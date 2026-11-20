import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MealPlanner } from "@/features/productivity-tools/meal-planner";
import { PLANNER_KEY } from "@/features/productivity-tools/meal-utils";

beforeEach(() => {
	window.localStorage.clear();
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			readText: vi.fn(async () => copied),
			writeText: vi.fn(async (text: string) => {
				copied = text;
			}),
		},
	});
	copied = "";
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

let copied = "";

const plan = async (user: ReturnType<typeof userEvent.setup>, slot: string, meal: string, items: string) => {
	await user.type(screen.getByLabelText(slot), meal);
	await user.type(screen.getByLabelText(`Ingredients for ${slot}`), items);
};

describe("meal planner", () => {
	it("starts with an empty week and says what to do", () => {
		render(<MealPlanner />);
		expect(screen.getByText(/Nothing to buy yet/u)).toBeTruthy();
		for (const day of ["Monday", "Sunday"]) expect(screen.getByRole("heading", { name: day })).toBeTruthy();
		expect(screen.getByText("Meals planned").parentElement?.textContent).toContain("0");
	});

	it("builds the shopping list from the ingredients lines", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Monday Breakfast", "Porridge", "oats, milk");
		expect(screen.getByRole("checkbox", { name: "oats" })).toBeTruthy();
		expect(screen.getByRole("checkbox", { name: "milk" })).toBeTruthy();
		expect(screen.getByText("Things to buy").parentElement?.textContent).toContain("2");
		expect(screen.getByText("Meals planned").parentElement?.textContent).toContain("1");
	});

	it("lists an ingredient once when two meals want it", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Monday Breakfast", "Porridge", "oats");
		await plan(user, "Wednesday Breakfast", "Porridge again", "oats");
		const list = screen.getByRole("checkbox", { name: "oats" }).closest("li");
		expect(list?.textContent).toContain("2 meals");
		expect(screen.getAllByRole("checkbox", { name: "oats" })).toHaveLength(1);
		expect(screen.getByText(/pulling in 1 ingredient/u)).toBeTruthy();
	});

	it("crosses an item off without losing it", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Friday Dinner", "Curry", "rice, beans");
		await user.click(screen.getByRole("checkbox", { name: "rice" }));
		const row = screen.getByRole("checkbox", { name: "rice" }).closest("li");
		expect(within(row as HTMLElement).getByText("rice").className).toContain("line-through");
		expect(screen.getByText("In the basket").parentElement?.textContent).toContain("1 of 2");
		await user.click(screen.getByRole("checkbox", { name: "rice" }));
		expect(within(screen.getByRole("checkbox", { name: "rice" }).closest("li") as HTMLElement).getByText("rice").className).not.toContain("line-through");
	});

	it("copies the list with the ticks marked", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Monday Lunch", "Sandwiches", "bread");
		await user.click(screen.getByRole("checkbox", { name: "bread" }));
		await user.click(screen.getByRole("button", { name: /Copy/iu }));
		expect(await navigator.clipboard.readText()).toBe("Shopping list\n- [x] bread");
	});

	it("remembers the week after a reload", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Sunday Dinner", "Roast", "chicken, potatoes");
		expect(window.localStorage.getItem(PLANNER_KEY)).toContain("chicken");
		cleanup();
		render(<MealPlanner />);
		expect(await screen.findByRole("checkbox", { name: "chicken" })).toBeTruthy();
		expect(screen.getByLabelText("Sunday Dinner")).toHaveProperty("value", "Roast");
	});

	it("clears the week when asked", async () => {
		const user = userEvent.setup();
		render(<MealPlanner />);
		await plan(user, "Tuesday Dinner", "Soup", "leeks");
		await user.click(screen.getByRole("button", { name: "Clear the week" }));
		expect(screen.queryByRole("checkbox", { name: "leeks" })).toBeNull();
		expect(screen.getByLabelText("Tuesday Dinner")).toHaveProperty("value", "");
		expect(window.localStorage.getItem(PLANNER_KEY) ?? "").not.toContain("leeks");
	});
});
