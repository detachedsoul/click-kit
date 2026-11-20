import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitTracker } from "@/features/productivity-tools/habit-tracker";
import { HABIT_KEY, todayIso, shiftDay } from "@/features/productivity-tools/habit-utils";
import { readStore, writeStore } from "@/features/productivity-tools/stored-state";

const today = todayIso();
const yesterday = shiftDay(today, -1);

const addHabit = async (name: string) => {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText("A habit you want to keep"), name);
	await user.click(screen.getByRole("button", { name: "Track it" }));
};

const tickToday = (name: string) => {
	fireEvent.click(screen.getByRole("button", { name: `${name} on ${today}` }));
};

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("habit tracker", () => {
	it("starts empty with a nudge rather than a blank page", () => {
		render(<HabitTracker />);
		expect(screen.getByText(/No habits yet/u)).toBeTruthy();
		expect(screen.queryByText("Done today")).toBeNull();
	});

	it("adds a habit and ticks it for today", async () => {
		render(<HabitTracker />);
		await addHabit("Read ten pages");
		expect(screen.getByText("Read ten pages")).toBeTruthy();
		expect(screen.getByText(/0 day streak/u)).toBeTruthy();

		tickToday("Read ten pages");
		expect(screen.getByRole("button", { name: `Read ten pages on ${today}` }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByText(/1 day streak/u)).toBeTruthy();
		expect(screen.getByText("Done today").parentElement?.textContent).toContain("1 of 1");
	});

	it("unticks a day it already had", async () => {
		render(<HabitTracker />);
		await addHabit("Walk");
		tickToday("Walk");
		tickToday("Walk");
		expect(screen.getByRole("button", { name: `Walk on ${today}` }).getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByText(/0 day streak/u)).toBeTruthy();
	});

	it("refuses a duplicate or an empty name", async () => {
		render(<HabitTracker />);
		await addHabit("Read");
		await addHabit("read");
		expect(screen.getByText(/already track a habit/u)).toBeTruthy();
		expect(screen.getAllByText("Read")).toHaveLength(1);
	});

	it("keeps the habits after the page is opened again", async () => {
		const first = render(<HabitTracker />);
		await addHabit("Stretch");
		tickToday("Stretch");
		first.unmount();

		render(<HabitTracker />);
		expect(await screen.findByText("Stretch")).toBeTruthy();
		expect(screen.getByRole("button", { name: `Stretch on ${today}` }).getAttribute("aria-pressed")).toBe("true");
	});

	it("reads a store it wrote itself", () => {
		writeStore("clickkit.test.v1", { days: [today] });
		expect(readStore("clickkit.test.v1", null, (raw) => raw as { days: string[] })).toEqual({ days: [today] });
	});

	it("falls back when the store holds rubbish", () => {
		window.localStorage.setItem(HABIT_KEY, "{not json");
		render(<HabitTracker />);
		expect(screen.getByText(/No habits yet/u)).toBeTruthy();
	});

	it("survives a browser that refuses to store anything", async () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		render(<HabitTracker />);
		await addHabit("Journal");
		expect(screen.getByText("Journal")).toBeTruthy();
	});

	it("ticks every habit for today at once", async () => {
		render(<HabitTracker />);
		await addHabit("Read");
		await addHabit("Walk");
		fireEvent.click(screen.getByRole("button", { name: "Tick everything for today" }));
		expect(screen.getByRole("button", { name: `Read on ${today}` }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: `Walk on ${today}` }).getAttribute("aria-pressed")).toBe("true");
	});

	it("removes a habit and clears the store", async () => {
		const first = render(<HabitTracker />);
		await addHabit("Read");
		fireEvent.click(screen.getByRole("button", { name: "Remove Read" }));
		expect(screen.getByText(/No habits yet/u)).toBeTruthy();
		expect(window.localStorage.getItem(HABIT_KEY)).toBe("[]");
		first.unmount();
	});

	it("shows a run that reaches back before today", async () => {
		render(<HabitTracker />);
		await addHabit("Read");
		// Yesterday counts towards the run while today is still open.
		fireEvent.click(screen.getByRole("button", { name: `Read on ${yesterday}` }));
		expect(screen.getByText(/1 day streak/u)).toBeTruthy();
		expect(screen.getByText(/1\/7 this week/u)).toBeTruthy();
	});
});
