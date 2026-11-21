import { describe, expect, it } from "vitest";
import {
	addItem,
	buildList,
	CATALOGUE,
	CATEGORIES,
	clampNights,
	firstState,
	groupByCategory,
	idFor,
	LIST_KEY,
	MAX_ITEMS,
	MAX_TEMPLATES,
	packingListAsText,
	progressOf,
	quantityFor,
	recordTemplate,
	removeItem,
	reviveState,
	reviveTemplates,
	stateFromTemplate,
	templateOf,
	TEMPLATE_KEY,
	togglePacked,
	tripAdvice,
	tripLabel,
	unpackAll,
	type PackingItem,
	type PackingState,
} from "@/features/productivity-tools/packing-utils";

const state = (trip: PackingState["trip"] = "vacation", nights = 3): PackingState => ({ items: buildList(trip, nights), nights, trip, updatedAt: 1 });

describe("what a trip asks for", () => {
	it("grows the things you wear daily with the length of the trip, up to a cap", () => {
		const socks = (nights: number) => buildList("vacation", nights).find((item) => item.name === "Socks")?.quantity;
		expect(socks(1)).toBe(1);
		expect(socks(3)).toBe(3);
		expect(socks(12)).toBe(8);
	});

	it("keeps one of the things a night does not change", () => {
		const passport = buildList("camping", 9).find((item) => item.name === "ID or passport");
		expect(passport?.quantity).toBe(1);
	});

	it("rounds a per-night fraction up, because half a shirt is not a thing", () => {
		const shirts = (nights: number) => buildList("business", nights).find((item) => item.name === "Dress shirts")?.quantity;
		expect(shirts(1)).toBe(1);
		expect(shirts(2)).toBe(2);
		expect(shirts(3)).toBe(3);
		expect(shirts(9)).toBe(5);
	});

	it("gives each trip its own things and shares the rest", () => {
		const names = (trip: PackingState["trip"]) => buildList(trip, 4).map((item) => item.name);
		expect(names("camping")).toContain("Tent");
		expect(names("business")).toContain("Laptop");
		expect(names("school")).toContain("Permission slip");
		expect(names("vacation")).toContain("Sunscreen");
		for (const trip of ["business", "vacation", "school", "camping"] as const) expect(names(trip)).toContain("Toothbrush");
	});

	it("puts every line in a category the tool knows how to show", () => {
		for (const trip of ["business", "vacation", "school", "camping"] as const) {
			for (const seed of CATALOGUE[trip]) expect(CATEGORIES).toContain(seed.category);
		}
	});

	it("keeps the nights inside the range the field promises", () => {
		expect(clampNights(0)).toBe(1);
		expect(clampNights(-4)).toBe(1);
		expect(clampNights(7.6)).toBe(8);
		expect(clampNights(500)).toBe(60);
		expect(clampNights(Number.NaN)).toBe(1);
	});

	it("reads a quantity off the seed without asking the list", () => {
		expect(quantityFor({ category: "clothing", name: "Socks", per: 1, cap: 8 }, 5)).toBe(5);
		expect(quantityFor({ category: "clothing", name: "Belt" }, 5)).toBe(1);
	});

	it("keeps the same id for the same line, so a rebuild does not lose the row", () => {
		expect(idFor("documents", "ID or passport")).toBe("documents:id-or-passport");
		expect(buildList("vacation", 2).map((item) => item.id)).toEqual(buildList("vacation", 5).map((item) => item.id));
	});
});

describe("custom lines", () => {
	it("adds a line where it was asked for", () => {
		const items = addItem(buildList("vacation", 2), "  Passport   wallet ", "documents");
		const added = items.at(-1);
		expect(added).toMatchObject({ category: "documents", custom: true, name: "Passport wallet", packed: false, quantity: 1 });
	});

	it("treats the same line again as one more of them", () => {
		const once = addItem(buildList("vacation", 2), "Power strip", "electronics");
		const twice = addItem(once, "power  STRIP", "electronics");
		expect(twice.filter((item) => item.name === "Power strip")).toHaveLength(1);
		expect(twice.find((item) => item.name === "Power strip")?.quantity).toBe(2);
	});

	it("refuses a blank line", () => {
		const items = buildList("vacation", 2);
		expect(addItem(items, "   ", "other")).toEqual(items);
	});

	it("survives a rebuild, while the generated lines are rebuilt", () => {
		const withMine = addItem(buildList("vacation", 2), "Passport wallet", "documents");
		const rebuilt = buildList("camping", 5, withMine);
		expect(rebuilt.some((item) => item.name === "Passport wallet" && item.custom)).toBe(true);
		expect(rebuilt.some((item) => item.name === "Sunscreen")).toBe(false);
	});

	it("stops adding once the list is absurd", () => {
		let items: PackingItem[] = buildList("vacation", 2);
		for (let index = 0; index < MAX_ITEMS + 5; index += 1) items = addItem(items, `Thing ${index}`, "other");
		expect(items).toHaveLength(MAX_ITEMS);
	});
});

describe("checking things off", () => {
	it("counts what is packed and what is left", () => {
		const items = state().items;
		expect(progressOf(items)).toMatchObject({ packed: 0, percent: 0, total: items.length });
		const half = items.slice(0, Math.ceil(items.length / 2));
		expect(progressOf(half.map((item) => ({ ...item, packed: true })))).toMatchObject({ packed: half.length, total: half.length, percent: 100 });
	});

	it("survives an empty list without dividing by zero", () => {
		expect(progressOf([])).toEqual({ left: 0, packed: 0, percent: 0, total: 0 });
	});

	it("ticks and unticks one line at a time", () => {
		const items = state().items;
		const target = items[2];
		const ticked = togglePacked(items, target.id);
		expect(ticked[2].packed).toBe(true);
		expect(ticked.filter((item) => item.packed)).toHaveLength(1);
		expect(togglePacked(ticked, target.id)[2].packed).toBe(false);
	});

	it("unpacks everything in one go", () => {
		const ticked = state().items.map((item) => ({ ...item, packed: true }));
		expect(unpackAll(ticked).every((item) => !item.packed)).toBe(true);
	});

	it("drops a line that was removed", () => {
		const items = state().items;
		expect(removeItem(items, items[0].id)).toHaveLength(items.length - 1);
	});

	it("groups by category in a fixed order, and skips what is empty", () => {
		const groups = groupByCategory(state("camping").items);
		expect(groups.map((group) => group.category)).toEqual(["clothing", "toiletries", "electronics", "documents", "other"]);
		expect(groups.find((group) => group.category === "other")?.items.map((item) => item.name)).toContain("Tent");
		expect(groupByCategory([addItem([], "A note", "other")[0]])).toHaveLength(1);
	});
});

describe("putting the list in writing", () => {
	it("writes the trip, the progress, and a ticked line per item", () => {
		const start = state("camping", 2);
		const ticked: PackingState = { ...start, items: togglePacked(start.items, start.items[0].id) };
		const text = packingListAsText(ticked);
		expect(text).toContain("Packing list — Camping, 2 nights");
		expect(text).toContain("1 of");
		expect(text).toContain("- [x] ID or passport");
		expect(text).toContain("- [ ] Toothbrush");
		expect(text).toContain("Clothing (");
	});

	it("says one night, not one nights", () => {
		expect(packingListAsText(state("business", 1))).toContain("1 night\n");
	});

	it("writes the quantity beside a line that has one", () => {
		expect(packingListAsText(state("vacation", 3))).toMatch(/Socks \(x3\)/u);
	});
});

describe("keeping the list", () => {
	it("reads back a stored list", () => {
		const stored = state("school", 4);
		expect(reviveState(stored)).toEqual(stored);
		expect(LIST_KEY).toBe("clickkit-packing-list");
	});

	it("refuses what does not look like a list", () => {
		expect(reviveState(null)).toBeNull();
		expect(reviveState({ trip: "vacation", nights: 2, items: [] })).toBeNull();
		expect(reviveState({ trip: "moon", nights: 2, items: [{ category: "other", name: "Boots" }] })).toBeNull();
	});

	it("keeps the lines it understands and drops the rest", () => {
		const kept = reviveState({ trip: "vacation", nights: 2, updatedAt: 5, items: [{ category: "other", name: "Boots" }, { category: "nonsense", name: "Rocket" }, "junk"] });
		expect(kept?.items.map((item) => item.name)).toEqual(["Boots"]);
		expect(kept?.items[0].id).toBe(idFor("other", "Boots"));
	});

	it("starts a visitor on a list rather than an empty page", () => {
		const start = firstState();
		expect(start.trip).toBe("vacation");
		expect(start.items.length).toBeGreaterThan(10);
		expect(start.items.every((item) => !item.packed)).toBe(true);
	});
});

describe("templates", () => {
	it("saves a list as a template without its ticks", () => {
		const start = state("camping", 6);
		const ticked = { ...start, items: start.items.map((item) => ({ ...item, packed: true })) };
		const template = templateOf(ticked, "Camping kit", 1000);
		expect(template.items.every((entry) => !("packed" in entry))).toBe(true);
		expect(template).toMatchObject({ name: "Camping kit", nights: 6, trip: "camping" });
		expect(template.items).toHaveLength(start.items.length);
	});

	it("names a template after the trip when no name was given", () => {
		expect(templateOf(state("school", 2), "  ").name).toBe("School · 2 nights");
	});

	it("puts a template back on the shelf, unticked and at its own length", () => {
		const template = templateOf(state("business", 4), "Work trip", 2000);
		const restored = stateFromTemplate(template, 3000);
		expect(restored).toMatchObject({ nights: 4, trip: "business", updatedAt: 3000 });
		expect(restored.items.every((item) => !item.packed)).toBe(true);
		expect(restored.items.map((item) => item.name)).toEqual(template.items.map((entry) => entry.name));
	});

	it("replaces a template saved under the same name, and keeps the newest first", () => {
		const older = recordTemplate([], templateOf(state("camping", 2), "Kit", 1000));
		const newer = recordTemplate(older, templateOf(state("camping", 5), "kit", 2000));
		expect(newer).toHaveLength(1);
		expect(newer[0].nights).toBe(5);
	});

	it("keeps only the last handful of templates", () => {
		let templates = [] as ReturnType<typeof reviveTemplates>;
		for (let index = 0; index < MAX_TEMPLATES + 4; index += 1) templates = recordTemplate(templates, templateOf(state("vacation", 2), `Template ${index}`, index));
		expect(templates).toHaveLength(MAX_TEMPLATES);
		expect(templates[0].name).toBe(`Template ${MAX_TEMPLATES + 3}`);
	});

	it("reads stored templates back and drops the rubbish", () => {
		const saved = templateOf(state("vacation", 3), "Beach", 5000);
		expect(reviveTemplates([saved])).toEqual([saved]);
		expect(reviveTemplates([saved, { name: "no trip" }, null, "junk"])).toHaveLength(1);
		expect(reviveTemplates("not a list")).toEqual([]);
		expect(TEMPLATE_KEY).toBe("clickkit-packing-templates");
	});
});

describe("saying it plainly", () => {
	it("names the trips", () => {
		expect(tripLabel("school")).toBe("School");
	});

	it("gives advice that fits the trip and the length", () => {
		expect(tripAdvice("camping", 2)).toContain("torch");
		expect(tripAdvice("business", 2)).toContain("Laptop charger");
		expect(tripAdvice("vacation", 9)).toContain("wash");
	});
});
