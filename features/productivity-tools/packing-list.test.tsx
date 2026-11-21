import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PackingList } from "@/features/productivity-tools/packing-list";
import { buildList, firstState, LIST_KEY, templateOf, TEMPLATE_KEY, type PackingState } from "@/features/productivity-tools/packing-utils";

const store = new Map<string, string>();

beforeEach(() => {
	store.clear();
	vi.stubGlobal("localStorage", {
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		removeItem: (key: string) => store.delete(key),
		setItem: (key: string, value: string) => store.set(key, value),
	});
	vi.stubGlobal("print", vi.fn());
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const setup = () => {
	const user = userEvent.setup();
	render(<PackingList />);
	return user;
};

const stored = (): PackingState => JSON.parse(store.get(LIST_KEY) ?? "null") as PackingState;

const progressLine = () => screen.getByText("Packed").parentElement?.textContent ?? "";

describe("the packing list", () => {
	it("opens with a list for a short holiday", async () => {
		await setup();
		expect(screen.getByRole("heading", { name: "Your list" })).toBeTruthy();
		expect(screen.getByText(/Vacation · 3 nights/u)).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Toiletries" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Clothing" })).toBeTruthy();
		expect(progressLine()).toContain(`0 of ${firstState().items.length}`);
	});

	it("builds a fresh list for another trip and length", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Camping" }));
		// Typing into a number field that snaps back to 1 would leave the dial at 15.
		fireEvent.change(screen.getByLabelText(/How many nights/u, { selector: "input" }), { target: { value: "5" } });
		await user.click(screen.getByRole("button", { name: /Build the list/u }));

		expect(await screen.findByText(/Camping · 5 nights/u)).toBeTruthy();
		expect(screen.getByText("Tent")).toBeTruthy();
		expect(screen.queryByText("Sunscreen")).toBeNull();
		expect(stored()).toMatchObject({ nights: 5, trip: "camping" });
	});

	it("ticks a line off and counts what is left", async () => {
		const user = await setup();
		const box = screen.getByRole("checkbox", { name: "Packed: Toothbrush" });
		await user.click(box);
		expect((box as HTMLInputElement).checked).toBe(true);
		expect(progressLine()).toContain(`1 of ${firstState().items.length}`);
		expect(screen.getByText("Still to pack").parentElement?.textContent).toContain(String(firstState().items.length - 1));
		expect(progressLine()).not.toContain("0 of");

		// The tick is kept, not just drawn.
		await user.click(box);
		expect(stored().items.find((item) => item.name === "Toothbrush")?.packed).toBe(false);
	});

	it("adds an item of your own, in the category you picked", async () => {
		const user = await setup();
		await user.type(screen.getByLabelText("Item"), "Passport wallet");
		await user.selectOptions(screen.getByLabelText("Category"), "documents");
		await user.click(screen.getByRole("button", { name: "Add item" }));

		const added = await screen.findByRole("checkbox", { name: "Packed: Passport wallet" });
		expect(added).toBeTruthy();
		expect(stored().items.find((item) => item.name === "Passport wallet")).toMatchObject({ category: "documents", custom: true, quantity: 1 });
		expect(screen.getAllByRole("status").some((node) => node.textContent?.includes("Passport wallet is on the list"))).toBe(true);
	});

	it("asks for a name before adding nothing", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Add item" }));
		expect(screen.getByRole("alert").textContent).toContain("Type the thing you want to add first");
	});

	it("removes a line it no longer needs", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Remove Toothbrush" }));
		expect(screen.queryByRole("checkbox", { name: "Packed: Toothbrush" })).toBeNull();
		expect(stored().items.some((item) => item.name === "Toothbrush")).toBe(false);
	});

	it("unpacks the lot in one press", async () => {
		const user = await setup();
		const boxes = screen.getAllByRole("checkbox");
		await user.click(boxes[0]);
		await user.click(boxes[1]);
		expect(progressLine()).toContain("2 of");
		await user.click(screen.getByRole("button", { name: "Unpack everything" }));
		expect(progressLine()).toContain("0 of");
	});

	it("saves the list as a template and puts it back", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Camping" }));
		await user.click(screen.getByRole("button", { name: /Build the list/u }));
		await user.type(screen.getByLabelText(/Save this list as/u), "Camping kit");
		await user.click(screen.getByRole("button", { name: "Save template" }));

		expect(await screen.findByText("Camping kit")).toBeTruthy();
		expect(screen.getByText(/1 kept on this device/u)).toBeTruthy();
		const kept = JSON.parse(store.get(TEMPLATE_KEY) ?? "[]") as { items: unknown[]; name: string }[];
		expect(kept[0].name).toBe("Camping kit");

		// Go back to a holiday, then reach for the template again.
		await user.click(screen.getByRole("button", { name: "Vacation" }));
		await user.click(screen.getByRole("button", { name: /Build the list/u }));
		expect(screen.queryByText("Tent")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Use template Camping kit" }));
		expect(await screen.findByText("Tent")).toBeTruthy();
		expect(stored().trip).toBe("camping");
	});

	it("deletes a template", async () => {
		store.set(TEMPLATE_KEY, JSON.stringify([templateOf(firstState("school", 2), "School run", 1000)]));
		const user = await setup();
		expect(screen.getByText("School run")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Delete template School run" }));
		expect(screen.queryByText("School run")).toBeNull();
		expect(screen.getByText(/No templates yet/u)).toBeTruthy();
	});

	it("reads the list back after a reload, ticks and all", async () => {
		const kept: PackingState = { ...firstState("camping", 4), items: buildList("camping", 4).map((item, index) => ({ ...item, packed: index === 0 })) };
		store.set(LIST_KEY, JSON.stringify(kept));
		await setup();

		expect(screen.getByText(/Camping · 4 nights/u)).toBeTruthy();
		expect((screen.getByRole("checkbox", { name: `Packed: ${kept.items[0].name}` }) as HTMLInputElement).checked).toBe(true);
		expect(progressLine()).toContain(`1 of ${kept.items.length}`);
	});

	it("hands the list over as text and a file", async () => {
		await setup();
		const download = screen.getByRole("link", { name: /Download \.md/u });
		expect(download.getAttribute("download")).toBe("packing-list.md");
		const href = download.getAttribute("href") ?? "";
		expect(decodeURIComponent(href)).toContain("Packing list — Vacation, 3 nights");
		expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
	});

	it("prints the list when asked", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: /Print list/u }));
		expect(window.print).toHaveBeenCalled();
	});

	it("shows the trip's own advice", async () => {
		const user = await setup();
		expect(screen.getByText(/Documents and medicines/u)).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Camping" }));
		expect(screen.getByText(/Camping is the trip that punishes/u)).toBeTruthy();
	});

	it("marks the controls for hiding when printed and the list for keeping", async () => {
		await setup();
		const sheet = screen.getByRole("heading", { name: "Your list" }).closest("[data-print='sheet']");
		expect(sheet).toBeTruthy();
		const controls = screen.getByRole("button", { name: /Build the list/u }).closest("[data-print='hide']");
		expect(controls).toBeTruthy();
		// Every category block prints too, not only the summary.
		const clothing = screen.getByRole("heading", { name: "Clothing" }).closest("[data-print='sheet']");
		expect(clothing).toBeTruthy();
		expect(within(clothing as HTMLElement).getByRole("checkbox", { name: "Packed: Socks" })).toBeTruthy();
	});
});
