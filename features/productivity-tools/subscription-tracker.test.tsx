import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SubscriptionTracker } from "@/features/productivity-tools/subscription-tracker";
import {
	addSubscription,
	byRenewal,
	clampAmount,
	describeRenewal,
	daysUntil,
	monthlyCost,
	removeSubscription,
	reviveSubscriptions,
	SUBSCRIPTION_KEY,
	type Subscription,
	subscriptionsAsMarkdown,
	toggleSubscription,
	totals,
	yearlyCost,
} from "@/features/productivity-tools/subscription-utils";

const sub = (over: Partial<Subscription> = {}): Subscription => ({ id: "sub-1", name: "Streaming", amount: 12, cycle: "monthly", next: "", active: true, ...over });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("subscription arithmetic", () => {
	it("puts every cycle on a monthly footing", () => {
		expect(monthlyCost({ amount: 12, cycle: "monthly" })).toBeCloseTo(12, 5);
		expect(monthlyCost({ amount: 120, cycle: "yearly" })).toBeCloseTo(10, 5);
		expect(monthlyCost({ amount: 30, cycle: "quarterly" })).toBeCloseTo(10, 5);
		expect(monthlyCost({ amount: 13, cycle: "weekly" })).toBeCloseTo(56.333, 2);
		expect(yearlyCost({ amount: 12, cycle: "monthly" })).toBeCloseTo(144, 5);
	});

	it("keeps amounts sane", () => {
		expect(clampAmount(Number.NaN)).toBe(0);
		expect(clampAmount(-5)).toBe(0);
		expect(clampAmount(10)).toBe(10);
	});

	it("only counts the live ones", () => {
		const list = [sub(), sub({ id: "sub-2", amount: 60, cycle: "yearly", active: false })];
		expect(totals(list)).toEqual({ count: 1, monthly: 12, yearly: 144, cancelled: 1 });
		expect(totals(toggleSubscription(list, "sub-2")).count).toBe(2);
	});

	it("refuses an empty or free subscription", () => {
		expect(addSubscription([], { name: " ", amount: "9", cycle: "monthly", next: "" })).toEqual([]);
		expect(addSubscription([], { name: "Gym", amount: "0", cycle: "monthly", next: "" })).toEqual([]);
		const list = addSubscription([], { name: "  Gym  ", amount: "9.5", cycle: "weekly", next: "2026-12-01" });
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ name: "Gym", amount: 9.5, cycle: "weekly", next: "2026-12-01", active: true, id: "sub-1" });
		expect(removeSubscription(list, "sub-1")).toEqual([]);
	});

	it("counts the days to a renewal", () => {
		expect(daysUntil("2026-11-20", "2026-11-15")).toBe(5);
		expect(daysUntil("", "2026-11-15")).toBeNull();
		expect(daysUntil("not a date", "2026-11-15")).toBeNull();
		expect(describeRenewal("2026-11-15", "2026-11-15")).toBe("Renews today");
		expect(describeRenewal("2026-11-16", "2026-11-15")).toBe("Renews tomorrow");
		expect(describeRenewal("2026-11-20", "2026-11-15")).toBe("Renews in 5 days");
		expect(describeRenewal("2026-11-10", "2026-11-15")).toBe("5 days ago");
		expect(describeRenewal("", "2026-11-15")).toBe("No renewal date");
	});

	it("sorts the soonest renewal first, undated last", () => {
		const list = [sub({ id: "sub-1", name: "Later", next: "2026-12-10" }), sub({ id: "sub-2", name: "Never" }), sub({ id: "sub-3", name: "Soon", next: "2026-11-16" })];
		expect([...list].sort(byRenewal("2026-11-15")).map((entry) => entry.name)).toEqual(["Soon", "Later", "Never"]);
	});

	it("writes a table worth keeping", () => {
		const markdown = subscriptionsAsMarkdown([sub({ next: "2026-12-01" }), sub({ id: "sub-2", name: "Old", active: false })], "GBP", "2026-11-15");
		expect(markdown).toContain("# Subscriptions");
		expect(markdown).toContain("| Streaming |");
		expect(markdown).toContain("Old (cancelled)");
		expect(markdown).toContain("1 live, 1 cancelled");
	});

	it("ignores storage it cannot trust", () => {
		expect(reviveSubscriptions("nope")).toEqual([]);
		expect(reviveSubscriptions([{ id: "a", name: "Keep", amount: "9", cycle: "weekly", next: 5, active: false }, { id: "b" }, null])).toEqual([{ id: "a", name: "Keep", amount: 9, cycle: "weekly", next: "", active: false }]);
	});
});

describe("subscription tracker", () => {
	const addOne = async (user: ReturnType<typeof userEvent.setup>, name: string, amount: string) => {
		await user.type(screen.getByLabelText("What it is"), name);
		await user.type(screen.getByLabelText("What it costs"), amount);
		await user.click(screen.getByRole("button", { name: "Add the subscription" }));
	};

	it("starts empty and says so", async () => {
		render(<SubscriptionTracker />);
		expect(await screen.findByText(/Nothing tracked yet/u)).toBeTruthy();
		expect(screen.getByText("A month").parentElement?.textContent).toContain("0");
	});

	it("adds a subscription and totals it", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await addOne(user, "Streaming", "12");
		expect(screen.getByText("Streaming")).toBeTruthy();
		expect(screen.getByText("A month").parentElement?.textContent).toContain("12");
		expect(screen.getByText("A year").parentElement?.textContent).toContain("144");
		expect((screen.getByLabelText("What it is") as HTMLInputElement).value).toBe("");
	});

	it("switches the billing cycle", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await user.type(screen.getByLabelText("What it is"), "Domain");
		await user.type(screen.getByLabelText("What it costs"), "120");
		await user.click(screen.getByRole("button", { name: "a year" }));
		await user.click(screen.getByRole("button", { name: "Add the subscription" }));
		expect(screen.getByText(/£120\.00 a year/u)).toBeTruthy();
		expect(screen.getByText("A month").parentElement?.textContent).toContain("10");
	});

	it("explains what is missing", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await user.click(screen.getByRole("button", { name: "Add the subscription" }));
		expect(screen.getByRole("alert").textContent).toContain("Give the subscription a name");
		await user.type(screen.getByLabelText("What it is"), "Gym");
		await user.click(screen.getByRole("button", { name: "Add the subscription" }));
		expect(screen.getByRole("alert").textContent).toContain("Add what it costs");
	});

	it("cancels and brings back", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await addOne(user, "Gym", "30");
		await user.click(screen.getByRole("button", { name: "Cancel it" }));
		expect(screen.getByText("Cancelled").parentElement?.textContent).toContain("1");
		expect(screen.getByText("A month").parentElement?.textContent).toContain("0");
		await user.click(screen.getByRole("button", { name: "Bring it back" }));
		expect(screen.getByText("A month").parentElement?.textContent).toContain("30");
	});

	it("renames a subscription", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await addOne(user, "Streeming", "12");
		await user.click(screen.getByRole("button", { name: "Rename Streeming" }));
		const field = screen.getByLabelText("New name for Streeming");
		fireEvent.change(field, { target: { value: "Streaming" } });
		fireEvent.keyDown(field, { key: "Enter" });
		expect(screen.getByText("Streaming")).toBeTruthy();
	});

	it("removes and clears", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await addOne(user, "Gym", "30");
		await user.click(screen.getByRole("button", { name: "Remove Gym" }));
		expect(screen.queryByText("Gym")).toBeNull();
		await addOne(user, "Gym", "30");
		await user.click(screen.getByRole("button", { name: "Clear the list" }));
		expect(await screen.findByText(/Nothing tracked yet/u)).toBeTruthy();
	});

	it("remembers the list for the next visit", async () => {
		const user = userEvent.setup();
		const first = render(<SubscriptionTracker />);
		await addOne(user, "Hosting", "8");
		await waitFor(() => expect(window.localStorage.getItem(SUBSCRIPTION_KEY)).toContain("Hosting"));
		first.unmount();
		render(<SubscriptionTracker />);
		expect(await screen.findByText("Hosting")).toBeTruthy();
	});

	it("shows the renewal that is coming", async () => {
		const user = userEvent.setup();
		render(<SubscriptionTracker />);
		await user.type(screen.getByLabelText("What it is"), "Gym");
		await user.type(screen.getByLabelText("What it costs"), "30");
		fireEvent.change(screen.getByLabelText("Next renewal (optional)"), { target: { value: "2026-11-20" } });
		await user.click(screen.getByRole("button", { name: "Add the subscription" }));
		expect(screen.getByText(/Renews in \d+ days|Renews today|Renews tomorrow|day.* ago/u)).toBeTruthy();
	});
});
