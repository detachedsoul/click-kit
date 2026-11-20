import { describe, expect, it } from "vitest";
import { DAYS, emptyWeek, mealAt, mealKey, parseItems, plannedCount, PLANNER_KEY, reviveWeek, setMeal, shoppingList, shoppingText, toggleChecked, weekAsText } from "@/features/productivity-tools/meal-utils";

const weekWith = (entries: { day: (typeof DAYS)[number]; items?: string; name?: string; slot: "breakfast" | "lunch" | "dinner" }[]) =>
	entries.reduce((week, entry) => setMeal(week, entry.day, entry.slot, { items: entry.items ?? "", name: entry.name ?? "" }), emptyWeek());

describe("parseItems", () => {
	it("splits on commas, semicolons, and new lines", () => {
		expect(parseItems("oats, milk\n eggs; jam")).toEqual(["oats", "milk", "eggs", "jam"]);
	});

	it("drops blanks and repeats regardless of case", () => {
		expect(parseItems("Oats, , oats,  OATS ")).toEqual(["Oats"]);
	});
});

describe("setMeal", () => {
	it("keeps a name and an ingredients line", () => {
		const week = weekWith([{ day: "Monday", items: "oats, milk", name: "Porridge", slot: "breakfast" }]);
		expect(mealAt(week, "Monday", "breakfast")).toEqual({ items: "oats, milk", name: "Porridge" });
		expect(plannedCount(week)).toBe(1);
	});

	it("takes the slot back out when both fields are cleared", () => {
		const week = weekWith([{ day: "Monday", name: "Porridge", slot: "breakfast" }]);
		expect(Object.keys(setMeal(week, "Monday", "breakfast", { name: "" }).meals)).toEqual([]);
	});

	it("keeps an ingredients line with no meal name", () => {
		const week = weekWith([{ day: "Friday", items: "bread", slot: "lunch" }]);
		expect(mealKey("Friday", "lunch")).toBe("friday-lunch");
		expect(week.meals["friday-lunch"]).toEqual({ items: "bread", name: "" });
	});
});

describe("shoppingList", () => {
	it("gathers the week's ingredients once each, in alphabetical order", () => {
		const week = weekWith([
			{ day: "Monday", items: "oats, milk", name: "Porridge", slot: "breakfast" },
			{ day: "Wednesday", items: "Oats, honey", name: "Porridge again", slot: "breakfast" },
			{ day: "Friday", items: "bread", name: "Toast", slot: "lunch" },
		]);
		const list = shoppingList(week);
		expect(list.map((item) => item.label)).toEqual(["bread", "honey", "oats", "milk"].sort((left, right) => left.localeCompare(right)));
		expect(list.find((item) => item.label === "oats")?.meals).toHaveLength(2);
		expect(list.find((item) => item.label === "honey")?.meals).toEqual(["Wednesday breakfast (Porridge again)"]);
	});

	it("is empty when no meal lists ingredients", () => {
		expect(shoppingList(weekWith([{ day: "Sunday", name: "Roast", slot: "dinner" }]))).toEqual([]);
	});
});

describe("ticking items", () => {
	it("adds and removes a tick", () => {
		const week = weekWith([{ day: "Monday", items: "oats", slot: "breakfast" }]);
		const ticked = toggleChecked(week, "oats");
		expect(ticked.checked).toEqual(["oats"]);
		expect(toggleChecked(ticked, "oats").checked).toEqual([]);
	});

	it("marks the ticked line in the text version", () => {
		const week = toggleChecked(weekWith([{ day: "Monday", items: "oats, milk", name: "Porridge", slot: "breakfast" }]), "oats");
		const text = shoppingText(week);
		expect(text).toContain("- [x] oats");
		expect(text).toContain("- [ ] milk");
		expect(text.startsWith("Shopping list")).toBe(true);
	});

	it("says how many meals want an ingredient more than once", () => {
		const week = weekWith([
			{ day: "Monday", items: "oats", name: "Porridge", slot: "breakfast" },
			{ day: "Tuesday", items: "oats", name: "Porridge", slot: "breakfast" },
		]);
		expect(shoppingText(week)).toContain("- [ ] oats — 2 meals");
	});
});

describe("weekAsText", () => {
	it("writes the days that have something planned", () => {
		const week = weekWith([
			{ day: "Monday", items: "oats, milk", name: "Porridge", slot: "breakfast" },
			{ day: "Saturday", items: "rice", name: "Rice and peas", slot: "dinner" },
		]);
		expect(weekAsText(week)).toBe("Monday\n  Breakfast: Porridge (oats, milk)\nSaturday\n  Dinner: Rice and peas (rice)");
	});

	it("leaves a blank week blank", () => {
		expect(weekAsText(emptyWeek())).toBe("");
		expect(shoppingText(emptyWeek())).toBe("");
	});
});

describe("reviveWeek", () => {
	it("reads back what was stored", () => {
		const week = weekWith([{ day: "Monday", items: "oats", name: "Porridge", slot: "breakfast" }]);
		expect(reviveWeek(JSON.parse(JSON.stringify({ ...week, checked: ["oats"] })))).toEqual({ ...week, checked: ["oats"] });
	});

	it("ignores slots that are not in the week and values that are not text", () => {
		const week = reviveWeek({ checked: [1, "oats"], meals: { "monday-breakfast": { items: 7, name: "Porridge" }, "caturday-lunch": { name: "Nope" } } });
		expect(week.meals).toEqual({ "monday-breakfast": { items: "", name: "Porridge" } });
		expect(week.checked).toEqual(["oats"]);
	});

	it("falls back to an empty week for junk", () => {
		expect(reviveWeek(null)).toEqual(emptyWeek());
		expect(reviveWeek("nonsense")).toEqual(emptyWeek());
		expect(reviveWeek({ meals: [] })).toEqual(emptyWeek());
	});

	it("has a storage key of its own", () => {
		expect(PLANNER_KEY).toBe("clickkit.meals.v1");
	});
});
