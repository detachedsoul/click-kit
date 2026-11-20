/**
 * The subscription tracker's arithmetic, as plain functions.
 *
 * Every subscription is normalised to a monthly figure so a yearly domain and a weekly
 * coffee subscription can be added up together — and annualised back again for the number
 * people actually gasp at.
 */

export type Cycle = "weekly" | "monthly" | "quarterly" | "yearly";

export type Subscription = {
	id: string;
	name: string;
	amount: number;
	cycle: Cycle;
	/** `YYYY-MM-DD`, or empty when the renewal date is not known. */
	next: string;
	active: boolean;
};

export const SUBSCRIPTION_KEY = "clickkit.subscriptions.v1";
export const MAX_SUBSCRIPTIONS = 200;
export const MAX_NAME = 60;
export const MAX_AMOUNT = 1_000_000;

export const CYCLES: { id: Cycle; label: string; months: number }[] = [
	{ id: "weekly", label: "a week", months: 12 / 52 },
	{ id: "monthly", label: "a month", months: 1 },
	{ id: "quarterly", label: "a quarter", months: 3 },
	{ id: "yearly", label: "a year", months: 12 },
];

const MONTHS_IN: Record<Cycle, number> = { weekly: 12 / 52, monthly: 1, quarterly: 3, yearly: 12 };

export const trimName = (name: string) => name.replace(/\s+/gu, " ").trim().slice(0, MAX_NAME);

export const clampAmount = (amount: number) => (Number.isFinite(amount) ? Math.min(Math.max(amount, 0), MAX_AMOUNT) : 0);

/** What this subscription costs per month, whatever it is billed. */
export const monthlyCost = (subscription: Pick<Subscription, "amount" | "cycle">): number => clampAmount(subscription.amount) / MONTHS_IN[subscription.cycle];

export const yearlyCost = (subscription: Pick<Subscription, "amount" | "cycle">): number => monthlyCost(subscription) * 12;

export const cycleLabel = (cycle: Cycle) => CYCLES.find((entry) => entry.id === cycle)?.label ?? "a month";

export const nextSubscriptionId = (subscriptions: Subscription[]): string => {
	const used = new Set(subscriptions.map((subscription) => subscription.id));
	let seed = subscriptions.length + 1;
	while (used.has(`sub-${seed}`)) seed += 1;
	return `sub-${seed}`;
};

export const addSubscription = (subscriptions: Subscription[], draft: { name: string; amount: string; cycle: Cycle; next: string }): Subscription[] => {
	const name = trimName(draft.name);
	const amount = clampAmount(Number.parseFloat(draft.amount));
	if (!name || !amount || subscriptions.length >= MAX_SUBSCRIPTIONS) return subscriptions;
	return [...subscriptions, { id: nextSubscriptionId(subscriptions), name, amount, cycle: draft.cycle, next: draft.next, active: true }];
};

export const removeSubscription = (subscriptions: Subscription[], id: string) => subscriptions.filter((subscription) => subscription.id !== id);

/** Cancelling keeps the row (so the history is still there) but takes it out of the totals. */
export const toggleSubscription = (subscriptions: Subscription[], id: string) =>
	subscriptions.map((subscription) => (subscription.id === id ? { ...subscription, active: !subscription.active } : subscription));

export const renameSubscription = (subscriptions: Subscription[], id: string, name: string) => {
	const clean = trimName(name);
	if (!clean) return subscriptions;
	return subscriptions.map((subscription) => (subscription.id === id ? { ...subscription, name: clean } : subscription));
};

export const totals = (subscriptions: Subscription[]) => {
	const live = subscriptions.filter((subscription) => subscription.active);
	return {
		count: live.length,
		monthly: live.reduce((sum, subscription) => sum + monthlyCost(subscription), 0),
		yearly: live.reduce((sum, subscription) => sum + yearlyCost(subscription), 0),
		cancelled: subscriptions.length - live.length,
	};
};

/** Rounded to whole days: a renewal is "in 3 days", not "in 2.87 days". */
export const daysUntil = (date: string, today: string): number | null => {
	if (!date) return null;
	const from = Date.parse(`${today}T00:00:00Z`);
	const to = Date.parse(`${date}T00:00:00Z`);
	if (Number.isNaN(from) || Number.isNaN(to)) return null;
	return Math.round((to - from) / 86_400_000);
};

export const describeRenewal = (date: string, today: string): string => {
	const days = daysUntil(date, today);
	if (days === null) return "No renewal date";
	if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
	if (days === 0) return "Renews today";
	if (days === 1) return "Renews tomorrow";
	return `Renews in ${days} days`;
};

/** The soonest live renewal first; subscriptions without a date go to the end. */
export const byRenewal = (today: string) => (left: Subscription, right: Subscription) => {
	const leftDays = daysUntil(left.next, today);
	const rightDays = daysUntil(right.next, today);
	if (leftDays === null && rightDays === null) return left.name.localeCompare(right.name);
	if (leftDays === null) return 1;
	if (rightDays === null) return -1;
	return leftDays - rightDays;
};

export const money = (amount: number, currency: string): string => {
	const safe = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
	try {
		return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 }).format(safe);
	} catch {
		return `${safe.toFixed(2)} ${currency}`;
	}
};

/** A year of subscriptions as a Markdown table, for a budget note or a chat. */
export const subscriptionsAsMarkdown = (subscriptions: Subscription[], currency: string, today: string): string => {
	const all = totals(subscriptions);
	const rows = [...subscriptions].sort(byRenewal(today)).map((subscription) => {
		const status = subscription.active ? "" : " (cancelled)";
		return `| ${subscription.name}${status} | ${money(subscription.amount, currency)} ${cycleLabel(subscription.cycle)} | ${money(monthlyCost(subscription), currency)} | ${money(yearlyCost(subscription), currency)} | ${subscription.next || "—"} |`;
	});
	return [
		`# Subscriptions — ${money(all.monthly, currency)} a month, ${money(all.yearly, currency)} a year`,
		"",
		`${all.count} live${all.cancelled ? `, ${all.cancelled} cancelled` : ""}.`,
		"",
		"| Subscription | Billed | A month | A year | Next renewal |",
		"| --- | --- | --- | --- | --- |",
		...rows,
	].join("\n");
};

/** Reads back whatever a previous visit left in storage, ignoring anything malformed. */
export const reviveSubscriptions = (raw: unknown): Subscription[] => {
	if (!Array.isArray(raw)) return [];
	const cycles = new Set(CYCLES.map((entry) => entry.id));
	return raw
		.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
		.map((entry) => ({
			id: String(entry.id ?? ""),
			name: trimName(String(entry.name ?? "")),
			amount: clampAmount(Number(entry.amount)),
			cycle: cycles.has(entry.cycle as Cycle) ? (entry.cycle as Cycle) : "monthly",
			next: typeof entry.next === "string" ? entry.next : "",
			active: entry.active !== false,
		}))
		.filter((entry) => entry.id && entry.name)
		.slice(0, MAX_SUBSCRIPTIONS);
};
