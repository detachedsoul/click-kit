/**
 * A week of meals and the shopping list that falls out of it.
 *
 * The planner holds a meal name and a line of ingredients per slot. Nothing is parsed out of
 * the meal name: the ingredients line is what the shopping list is built from, so "beans on
 * toast" with no ingredients adds nothing to the list, which is honest rather than clever.
 */

export const PLANNER_KEY = "clickkit.meals.v1";
export const MAX_NAME = 80;
export const MAX_ITEMS = 300;
export const MAX_CHECKED = 400;

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const SLOTS = [
	{ id: "breakfast", label: "Breakfast" },
	{ id: "lunch", label: "Lunch" },
	{ id: "dinner", label: "Dinner" },
] as const;

export type Day = (typeof DAYS)[number];
export type Slot = (typeof SLOTS)[number]["id"];

export type Meal = { name: string; items: string };
export type MealWeek = { meals: Record<string, Meal>; checked: string[] };

export type ShoppingItem = { id: string; label: string; meals: string[] };

export const mealKey = (day: Day, slot: Slot) => `${day.toLowerCase()}-${slot}`;

export const emptyWeek = (): MealWeek => ({ checked: [], meals: {} });

const squeeze = (text: string, limit: number) => text.replace(/\s+/gu, " ").trim().slice(0, limit);

/** "oats, milk ,  OATS" → ["oats", "milk"]: trimmed, blank-free, and no repeats. */
export const parseItems = (text: string): string[] => {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of text.split(/[,\n;]+/u)) {
		const item = raw.replace(/\s+/gu, " ").trim();
		if (!item) continue;
		const id = item.toLowerCase();
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(item);
	}
	return out;
};

/** Write a meal into the week, or take it out again when both fields are emptied. */
export const setMeal = (week: MealWeek, day: Day, slot: Slot, patch: Partial<Meal>): MealWeek => {
	const key = mealKey(day, slot);
	const current = week.meals[key] ?? { items: "", name: "" };
	const next: Meal = { items: squeeze(patch.items ?? current.items, MAX_ITEMS), name: squeeze(patch.name ?? current.name, MAX_NAME) };
	const meals = { ...week.meals };
	if (!next.name && !next.items) delete meals[key];
	else meals[key] = next;
	return { ...week, meals };
};

export const mealAt = (week: MealWeek, day: Day, slot: Slot): Meal => week.meals[mealKey(day, slot)] ?? { items: "", name: "" };

/** How many slots have something in them. */
export const plannedCount = (week: MealWeek) => Object.values(week.meals).filter((meal) => meal.name || meal.items).length;

/** Every ingredient the week asks for, once, in alphabetical order. */
export const shoppingList = (week: MealWeek): ShoppingItem[] => {
	const found = new Map<string, ShoppingItem>();
	for (const day of DAYS) {
		for (const slot of SLOTS) {
			const meal = week.meals[mealKey(day, slot.id)];
			if (!meal) continue;
			for (const item of parseItems(meal.items)) {
				const id = item.toLowerCase();
				const existing = found.get(id);
				if (existing) existing.meals.push(meal.name ? `${day} ${slot.label.toLowerCase()} (${meal.name})` : `${day} ${slot.label.toLowerCase()}`);
				else found.set(id, { id, label: item, meals: [meal.name ? `${day} ${slot.label.toLowerCase()} (${meal.name})` : `${day} ${slot.label.toLowerCase()}`] });
			}
		}
	}
	return [...found.values()].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
};

export const isChecked = (week: MealWeek, id: string) => week.checked.includes(id);

/** Ticking an item keeps it in the list and strikes it through; the list is for a shop, not a test. */
export const toggleChecked = (week: MealWeek, id: string): MealWeek => {
	if (week.checked.includes(id)) return { ...week, checked: week.checked.filter((item) => item !== id) };
	if (week.checked.length >= MAX_CHECKED) return week;
	return { ...week, checked: [...week.checked, id] };
};

/** The shopping list as the text you take to the shop. */
export const shoppingText = (week: MealWeek): string => {
	const items = shoppingList(week);
	if (!items.length) return "";
	const lines = items.map((item) => `- [${isChecked(week, item.id) ? "x" : " "}] ${item.label}${item.meals.length > 1 ? ` — ${item.meals.length} meals` : ""}`);
	return ["Shopping list", ...lines].join("\n");
};

/** The week itself, written out, for the copy button. */
export const weekAsText = (week: MealWeek): string => {
	const lines: string[] = [];
	for (const day of DAYS) {
		const meals = SLOTS.map((slot) => ({ label: slot.label, meal: week.meals[mealKey(day, slot.id)] })).filter((entry) => entry.meal && (entry.meal.name || entry.meal.items));
		if (!meals.length) continue;
		lines.push(day);
		for (const entry of meals) {
			const items = parseItems(entry.meal?.items ?? "");
			lines.push(`  ${entry.label}: ${entry.meal?.name || "—"}${items.length ? ` (${items.join(", ")})` : ""}`);
		}
	}
	return lines.join("\n");
};

/** Anything read back from storage is checked field by field; a broken week becomes an empty one. */
export const reviveWeek = (raw: unknown): MealWeek => {
	const week = emptyWeek();
	if (!raw || typeof raw !== "object") return week;
	const record = raw as { meals?: unknown; checked?: unknown };
	if (Array.isArray(record.checked)) week.checked = record.checked.filter((item): item is string => typeof item === "string").slice(0, MAX_CHECKED);
	if (record.meals && typeof record.meals === "object") {
		const valid = new Set(DAYS.flatMap((day) => SLOTS.map((slot) => mealKey(day, slot.id))));
		for (const [key, value] of Object.entries(record.meals as Record<string, unknown>)) {
			if (!valid.has(key) || !value || typeof value !== "object") continue;
			const meal = value as { items?: unknown; name?: unknown };
			const name = typeof meal.name === "string" ? squeeze(meal.name, MAX_NAME) : "";
			const items = typeof meal.items === "string" ? squeeze(meal.items, MAX_ITEMS) : "";
			if (name || items) week.meals[key] = { items, name };
		}
	}
	return week;
};
