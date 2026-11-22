import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorldClock } from "@/features/productivity-tools/world-clock";
import { CLOCK_KEY, CLOCK_TICK_MS, FAVOURITE_KEY } from "@/features/productivity-tools/world-clock-utils";

const store = new Map<string, string>();

beforeEach(() => {
	store.clear();
	vi.stubGlobal("localStorage", {
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		removeItem: (key: string) => store.delete(key),
		setItem: (key: string, value: string) => store.set(key, value),
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	cleanup();
});

const setup = async () => {
	const user = userEvent.setup();
	render(<WorldClock />);
	await screen.findByText(/Cities on your clock/u);
	await waitFor(() => expect(screen.getByLabelText("Lagos local time").textContent).not.toBe("—:—:—"));
	return user;
};

describe("world clock and time finder", () => {
	it("starts with live local times, UTC offsets, and dates for three cities", async () => {
		await setup();
		expect(screen.getByLabelText("Lagos local time").textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
		expect(screen.getByLabelText("London local time").textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
		expect(screen.getByLabelText("New York local time").textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
		expect(document.body.textContent).toContain("UTC+");
		expect(document.body.textContent).toContain("same date");
		expect(screen.getByRole("heading", { name: "Convert a meeting time" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Find a shared working hour" })).toBeTruthy();
	});

	it("updates the displayed seconds every second", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-11-21T12:34:56Z"));
		render(<WorldClock />);
		await act(async () => { await vi.advanceTimersByTimeAsync(0); });
		const clock = screen.getByLabelText("Lagos local time");
		const before = clock.textContent;
		expect(before).toMatch(/:56$/u);

		await act(async () => { await vi.advanceTimersByTimeAsync(CLOCK_TICK_MS); });
		expect(clock.textContent).not.toBe(before);
		expect(clock.textContent).toMatch(/:57$/u);
	});

	it("adds a city from the worldwide list and saves it across reloads", async () => {
		const user = await setup();
		await user.selectOptions(screen.getByLabelText(/Choose from \d+ cities/u), "Asia/Singapore");
		await user.click(screen.getByRole("button", { name: "Add city" }));
		expect(await screen.findByText("Asia/Singapore")).toBeTruthy();
		await waitFor(() => expect(JSON.parse(store.get(CLOCK_KEY) ?? "[]")).toContain("Asia/Singapore"));
	});

	it("adds cities from different continents without needing to know their zone IDs", async () => {
		const user = await setup();
		const city = screen.getByLabelText(/Choose from \d+ cities/u);
		for (const zone of ["Africa/Cairo", "Asia/Kathmandu", "Pacific/Auckland"]) {
			await user.selectOptions(city, zone);
			await user.click(screen.getByRole("button", { name: "Add city" }));
		}
		expect(await screen.findByLabelText("Cairo local time")).toBeTruthy();
		expect(screen.getByLabelText("Kathmandu local time")).toBeTruthy();
		expect(screen.getByLabelText("Auckland local time")).toBeTruthy();
	});

	it("adds a custom IANA zone outside the city directory", async () => {
		const user = await setup();
		await user.type(screen.getByLabelText("Or add a custom IANA time zone"), "America/Argentina/Buenos_Aires");
		await user.click(screen.getByRole("button", { name: "Add custom zone" }));
		expect(await screen.findByLabelText("Buenos Aires local time")).toBeTruthy();
	});

	it("tells you when a time zone name is not in the IANA database", async () => {
		const user = await setup();
		await user.type(screen.getByLabelText("Or add a custom IANA time zone"), "Mars/Olympus");
		await user.click(screen.getByRole("button", { name: "Add custom zone" }));
		expect(screen.getByRole("alert").textContent).toContain("not a valid IANA time zone");
	});

	it("keeps favourite places and lets you bring one back with a single click", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Save London as favourite" }));
		await waitFor(() => expect(JSON.parse(store.get(FAVOURITE_KEY) ?? "[]")).toContain("Europe/London"));
		await user.click(screen.getByRole("button", { name: "Remove London" }));
		expect(screen.queryByLabelText("London local time")).toBeNull();
		await user.click(screen.getByRole("button", { name: "London" }));
		expect(await screen.findByLabelText("London local time")).toBeTruthy();
	});

	it("removes a city from the comparison", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Remove New York" }));
		expect(screen.queryByLabelText("New York local time")).toBeNull();
		expect(JSON.parse(store.get(CLOCK_KEY) ?? "[]")).not.toContain("America/New_York");
	});

	it("converts a chosen meeting time using the source city's date-dependent offset", async () => {
		await setup();
		fireEvent.change(screen.getByLabelText("This time is in"), { target: { value: "America/New_York" } });
		fireEvent.change(screen.getByLabelText("Date and local time"), { target: { value: "2026-07-15T09:00" } });
		await waitFor(() => expect(screen.getByText("London", { selector: "span" })).toBeTruthy());
		expect(document.body.textContent).toContain("14:00");
		expect(document.body.textContent).toContain("UTC+1");
	});

	it("explains a wall time skipped by the daylight-saving jump", async () => {
		await setup();
		fireEvent.change(screen.getByLabelText("This time is in"), { target: { value: "America/New_York" } });
		fireEvent.change(screen.getByLabelText("Date and local time"), { target: { value: "2026-03-08T02:30" } });
		await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("does not exist"));
	});

	it("shows the shared work-hour window for cities on the clock", async () => {
		await setup();
		await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/shared working hour|no shared/u));
		expect(screen.getByText("Date to compare")).toBeTruthy();
	});

	it("keeps an intentionally empty clock empty after storage catches up", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Remove Lagos" }));
		await user.click(screen.getByRole("button", { name: "Remove London" }));
		await user.click(screen.getByRole("button", { name: "Remove New York" }));
		expect(screen.getByText(/Your clock is empty/u)).toBeTruthy();
		await waitFor(() => expect(JSON.parse(store.get(CLOCK_KEY) ?? "null")).toEqual([]));
	});

	it("rejects a duplicate city instead of making a second clock", async () => {
		const user = await setup();
		await user.type(screen.getByLabelText("Or add a custom IANA time zone"), "Europe/London");
		await user.click(screen.getByRole("button", { name: "Add custom zone" }));
		expect(screen.getByRole("alert").textContent).toContain("already on your clock");
		expect(screen.getAllByLabelText("London local time")).toHaveLength(1);
	});
});
