/**
 * Packing for a trip: what a trip of a given kind and length asks you to take, how the list is
 * checked off, and the templates that save a list for next time.
 *
 * The catalogue is a set of seeds rather than fixed items, because a list for three nights is not
 * a list for ten: anything worn once a day grows with the trip, up to a cap that says when washing
 * beats carrying. Everything here is pure, so the numbers can be checked without a browser.
 */

export type TripType = "business" | "vacation" | "school" | "camping";
export type Category = "clothing" | "toiletries" | "electronics" | "documents" | "other";

export type PackingItem = {
	category: Category;
	custom: boolean;
	id: string;
	name: string;
	packed: boolean;
	quantity: number;
};

export type PackingState = {
	items: PackingItem[];
	nights: number;
	trip: TripType;
	updatedAt: number;
};

export type TemplateItem = { category: Category; name: string; quantity: number };

export type Template = {
	id: string;
	items: TemplateItem[];
	name: string;
	nights: number;
	savedAt: number;
	trip: TripType;
};

export const LIST_KEY = "clickkit-packing-list";
export const TEMPLATE_KEY = "clickkit-packing-templates";
export const MAX_TEMPLATES = 12;
export const MAX_ITEMS = 150;
export const MAX_NAME = 60;
export const MIN_NIGHTS = 1;
export const MAX_NIGHTS = 60;

export const TRIP_TYPES: { id: TripType; label: string; blurb: string }[] = [
	{ id: "business", label: "Business", blurb: "Work clothes and the things a meeting cannot start without." },
	{ id: "vacation", label: "Vacation", blurb: "Sun, sandals, and something to read on the way." },
	{ id: "school", label: "School", blurb: "A trip with the class: kit, books, and a packed lunch." },
	{ id: "camping", label: "Camping", blurb: "Everything the weather and the dark can ask of you." },
];

export const CATEGORIES: Category[] = ["clothing", "toiletries", "electronics", "documents", "other"];

export const CATEGORY_NAMES: Record<Category, string> = {
	clothing: "Clothing",
	toiletries: "Toiletries",
	electronics: "Electronics",
	documents: "Documents",
	other: "Everything else",
};

/**
 * One line of the catalogue. `per` is how much of it a night asks for — socks at 1 means a pair a
 * day — and `cap` is where carrying more stops making sense and a washing machine starts.
 */
export type Seed = { cap?: number; category: Category; name: string; per?: number };

const BASE: Seed[] = [
	{ category: "documents", name: "ID or passport" },
	{ category: "documents", name: "Travel insurance details" },
	{ category: "documents", name: "Booking confirmations" },
	{ category: "documents", name: "Tickets or boarding passes" },
	{ category: "documents", name: "Bank cards and some cash" },
	{ category: "toiletries", name: "Toothbrush" },
	{ category: "toiletries", name: "Toothpaste" },
	{ category: "toiletries", name: "Deodorant" },
	{ category: "toiletries", name: "Shampoo and soap" },
	{ category: "toiletries", name: "Hairbrush" },
	{ category: "toiletries", name: "Razor" },
	{ category: "toiletries", name: "Any prescription medicine" },
	{ category: "toiletries", name: "Plasters and painkillers" },
	{ category: "electronics", name: "Phone" },
	{ category: "electronics", name: "Phone charger" },
	{ category: "electronics", name: "Power bank" },
	{ category: "electronics", name: "Headphones" },
	{ category: "clothing", name: "Underwear", per: 1, cap: 8 },
	{ category: "clothing", name: "Socks", per: 1, cap: 8 },
	{ category: "clothing", name: "T-shirts", per: 0.5, cap: 5 },
	{ category: "clothing", name: "Sleepwear" },
];

const EXTRA: Record<TripType, Seed[]> = {
	business: [
		{ category: "clothing", name: "Dress shirts", per: 0.75, cap: 5 },
		{ category: "clothing", name: "Trousers or skirt", per: 0.5, cap: 3 },
		{ category: "clothing", name: "Blazer" },
		{ category: "clothing", name: "Belt" },
		{ category: "clothing", name: "Smart shoes" },
		{ category: "electronics", name: "Laptop" },
		{ category: "electronics", name: "Laptop charger" },
		{ category: "electronics", name: "Presentation clicker" },
		{ category: "electronics", name: "Travel adapter" },
		{ category: "documents", name: "Company ID or pass" },
		{ category: "documents", name: "Expense receipts folder" },
		{ category: "other", name: "Notebook and pen" },
		{ category: "other", name: "Business cards" },
	],
	vacation: [
		{ category: "clothing", name: "Swimsuit" },
		{ category: "clothing", name: "Shorts", per: 0.5, cap: 3 },
		{ category: "clothing", name: "Light jacket" },
		{ category: "clothing", name: "Sandals" },
		{ category: "clothing", name: "Sunglasses" },
		{ category: "clothing", name: "Sun hat" },
		{ category: "toiletries", name: "Sunscreen" },
		{ category: "toiletries", name: "After-sun" },
		{ category: "toiletries", name: "Insect repellent" },
		{ category: "electronics", name: "Camera" },
		{ category: "electronics", name: "Camera charger" },
		{ category: "other", name: "Beach towel" },
		{ category: "other", name: "Book or e-reader" },
		{ category: "other", name: "Reusable water bottle" },
	],
	school: [
		{ category: "clothing", name: "School uniform or spare clothes" },
		{ category: "clothing", name: "Trainers" },
		{ category: "clothing", name: "PE kit" },
		{ category: "clothing", name: "Waterproof coat" },
		{ category: "electronics", name: "Laptop or tablet" },
		{ category: "electronics", name: "Laptop charger" },
		{ category: "documents", name: "Student ID" },
		{ category: "documents", name: "Permission slip" },
		{ category: "other", name: "Backpack" },
		{ category: "other", name: "Notebooks" },
		{ category: "other", name: "Pens and pencils" },
		{ category: "other", name: "Calculator" },
		{ category: "other", name: "Packed lunch and snacks" },
		{ category: "other", name: "Water bottle" },
	],
	camping: [
		{ category: "clothing", name: "Walking boots" },
		{ category: "clothing", name: "Waterproof jacket" },
		{ category: "clothing", name: "Warm layers", per: 0.5, cap: 4 },
		{ category: "clothing", name: "Woolly hat and gloves" },
		{ category: "toiletries", name: "Insect repellent" },
		{ category: "toiletries", name: "Towel" },
		{ category: "toiletries", name: "Wet wipes" },
		{ category: "electronics", name: "Head torch" },
		{ category: "electronics", name: "Spare batteries" },
		{ category: "documents", name: "Campsite booking" },
		{ category: "documents", name: "Map and compass" },
		{ category: "other", name: "Tent" },
		{ category: "other", name: "Sleeping bag" },
		{ category: "other", name: "Sleeping mat" },
		{ category: "other", name: "Camping stove and fuel" },
		{ category: "other", name: "Matches or lighter" },
		{ category: "other", name: "Pocket knife" },
		{ category: "other", name: "First aid kit" },
		{ category: "other", name: "Water carrier" },
		{ category: "other", name: "Rubbish bags" },
		{ category: "other", name: "Washing-up kit" },
	],
};

export const CATALOGUE: Record<TripType, Seed[]> = {
	business: [...BASE, ...EXTRA.business],
	vacation: [...BASE, ...EXTRA.vacation],
	school: [...BASE, ...EXTRA.school],
	camping: [...BASE, ...EXTRA.camping],
};

/** A stable id, so a rebuild of the same trip keeps the same checkmarks-worth of identity. */
export const idFor = (category: Category, name: string) => `${category}:${name.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`;

export const clampNights = (value: number) => (Number.isFinite(value) ? Math.min(MAX_NIGHTS, Math.max(MIN_NIGHTS, Math.round(value))) : MIN_NIGHTS);

/** How many of this line a trip of `nights` nights asks for: one a day, up to the cap. */
export const quantityFor = (seed: Seed, nights: number) => {
	if (!seed.per) return 1;
	return Math.max(1, Math.min(seed.cap ?? 10, Math.ceil(nights * seed.per)));
};

/** A fresh list for a trip. Custom items already on the list survive a rebuild. */
export const buildList = (trip: TripType, nights: number, keep: PackingItem[] = []): PackingItem[] => {
	const length = clampNights(nights);
	const generated = CATALOGUE[trip].map((seed) => ({
		category: seed.category,
		custom: false,
		id: idFor(seed.category, seed.name),
		name: seed.name,
		packed: false,
		quantity: quantityFor(seed, length),
	}));
	const custom = keep.filter((item) => item.custom);
	// A custom line that says the same thing as a generated one would be listed twice.
	return [...generated, ...custom.filter((item) => !generated.some((kept) => kept.id === item.id))].slice(0, MAX_ITEMS);
};

/** The first list a visitor sees, before they have chosen anything. */
export const firstState = (trip: TripType = "vacation", nights = 3): PackingState => ({ items: buildList(trip, nights), nights: clampNights(nights), trip, updatedAt: 0 });

export const progressOf = (items: PackingItem[]) => {
	const total = items.length;
	const packed = items.filter((item) => item.packed).length;
	return { left: total - packed, packed, percent: total ? Math.round((packed / total) * 100) : 0, total };
};

export type CategoryGroup = { category: Category; items: PackingItem[]; packed: number; total: number };

/** The list as it is read out on paper: one block per category, in a fixed order. */
export const groupByCategory = (items: PackingItem[]): CategoryGroup[] =>
	CATEGORIES.map((category) => {
		const held = items.filter((item) => item.category === category);
		return { category, items: held, packed: held.filter((item) => item.packed).length, total: held.length };
	}).filter((group) => group.total > 0);

export const togglePacked = (items: PackingItem[], id: string) => items.map((item) => (item.id === id ? { ...item, packed: !item.packed } : item));

export const removeItem = (items: PackingItem[], id: string) => items.filter((item) => item.id !== id);

export const unpackAll = (items: PackingItem[]) => items.map((item) => ({ ...item, packed: false }));

/** A line typed by hand. Adding the same thing again means "one more of those", not a second row. */
export const addItem = (items: PackingItem[], name: string, category: Category) => {
	const trimmed = name.trim().replace(/\s+/gu, " ").slice(0, MAX_NAME);
	if (!trimmed || items.length >= MAX_ITEMS) return items;
	const id = idFor(category, trimmed);
	if (items.some((item) => item.id === id)) return items.map((item) => (item.id === id ? { ...item, packed: false, quantity: item.quantity + 1 } : item));
	return [...items, { category, custom: true, id, name: trimmed, packed: false, quantity: 1 }];
};

export const tripLabel = (trip: TripType) => TRIP_TYPES.find((entry) => entry.id === trip)?.label ?? "Vacation";

/** The thing a trip of this length is easy to forget, said once. */
export const tripAdvice = (trip: TripType, nights: number) => {
	if (nights >= 7) return "A week or more: pack for one wash, not for every day.";
	if (trip === "camping") return "Camping is the trip that punishes a missing torch, matches, or waterproof.";
	if (trip === "business") return "Laptop charger and the clicker are the two that get left in a desk drawer.";
	if (trip === "school") return "The permission slip is checked at the gate, not at the destination.";
	return "Documents and medicines are the two things no shop at the other end can replace.";
};

/** The list as plain text, for a message to a friend or a file in a bag. */
export const packingListAsText = (state: PackingState) => {
	const progress = progressOf(state.items);
	const lines = [`Packing list — ${tripLabel(state.trip)}, ${state.nights} night${state.nights === 1 ? "" : "s"}`, `${progress.packed} of ${progress.total} packed (${progress.percent}%)`];
	for (const group of groupByCategory(state.items)) {
		lines.push("", `${CATEGORY_NAMES[group.category]} (${group.packed}/${group.total})`);
		for (const item of group.items) lines.push(`- [${item.packed ? "x" : " "}] ${item.name}${item.quantity > 1 ? ` (x${item.quantity})` : ""}`);
	}
	return `${lines.join("\n")}\n`;
};

const isCategory = (value: unknown): value is Category => typeof value === "string" && (CATEGORIES as string[]).includes(value);
const isTrip = (value: unknown): value is TripType => typeof value === "string" && TRIP_TYPES.some((entry) => entry.id === value);

const itemFrom = (raw: unknown): PackingItem | null => {
	if (typeof raw !== "object" || raw === null) return null;
	const item = raw as Partial<PackingItem>;
	if (typeof item.name !== "string" || !item.name.trim() || !isCategory(item.category)) return null;
	return {
		category: item.category,
		custom: item.custom === true,
		id: typeof item.id === "string" && item.id ? item.id : idFor(item.category, item.name),
		name: item.name.slice(0, MAX_NAME),
		packed: item.packed === true,
		quantity: Number.isFinite(item.quantity) && (item.quantity ?? 0) >= 1 ? Math.min(99, Math.round(item.quantity as number)) : 1,
	};
};

/** What was stored last time, if it still looks like a list. */
export const reviveState = (raw: unknown): PackingState | null => {
	if (typeof raw !== "object" || raw === null) return null;
	const state = raw as Partial<PackingState>;
	const items = Array.isArray(state.items) ? state.items.map(itemFrom).filter((item): item is PackingItem => item !== null).slice(0, MAX_ITEMS) : [];
	if (!items.length || !isTrip(state.trip)) return null;
	const nights = typeof state.nights === "number" ? clampNights(state.nights) : 3;
	return { items, nights, trip: state.trip, updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : 0 };
};

const templateFrom = (raw: unknown): Template | null => {
	if (typeof raw !== "object" || raw === null) return null;
	const template = raw as Partial<Template>;
	if (typeof template.name !== "string" || !template.name.trim() || !isTrip(template.trip)) return null;
	const items = Array.isArray(template.items)
		? template.items
				.map((entry) => itemFrom({ ...(entry as object), packed: false, custom: true }))
				.filter((item): item is PackingItem => item !== null)
				.map((item) => ({ category: item.category, name: item.name, quantity: item.quantity }))
		: [];
	if (!items.length) return null;
	return {
		id: typeof template.id === "string" && template.id ? template.id : `template-${items.length}-${template.name}`,
		items,
		name: template.name.slice(0, MAX_NAME),
		nights: typeof template.nights === "number" ? clampNights(template.nights) : 3,
		savedAt: typeof template.savedAt === "number" ? template.savedAt : 0,
		trip: template.trip,
	};
};

export const reviveTemplates = (raw: unknown): Template[] =>
	Array.isArray(raw)
		? raw
				.map(templateFrom)
				.filter((template): template is Template => template !== null)
				.slice(0, MAX_TEMPLATES)
		: [];

/** The list as a template, checked states dropped: a template is a list to start from, not a memory. */
export const templateOf = (state: PackingState, name: string, savedAt = Date.now()): Template => ({
	id: `template-${savedAt}`,
	items: state.items.map((item) => ({ category: item.category, name: item.name, quantity: item.quantity })),
	name: name.trim().slice(0, MAX_NAME) || `${tripLabel(state.trip)} · ${state.nights} nights`,
	nights: state.nights,
	savedAt,
	trip: state.trip,
});

/** A template put back on the shelf: same lines, nothing ticked, and the trip's length restored. */
export const stateFromTemplate = (template: Template, at = Date.now()): PackingState => ({
	items: template.items.map((entry) => ({
		category: entry.category,
		custom: false,
		id: idFor(entry.category, entry.name),
		name: entry.name,
		packed: false,
		quantity: entry.quantity,
	})),
	nights: template.nights,
	trip: template.trip,
	updatedAt: at,
});

/** Newest first, a template saved under a name that already exists replaces it rather than piling up. */
export const recordTemplate = (templates: Template[], template: Template) =>
	[template, ...templates.filter((kept) => kept.name.toLowerCase() !== template.name.toLowerCase())].slice(0, MAX_TEMPLATES);

export const templateWhen = (at: number) => {
	const date = new Date(at);
	const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
	return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
};
