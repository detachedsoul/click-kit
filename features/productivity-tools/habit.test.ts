import { describe, expect, it } from "vitest";
import {
	createHabit,
	currentStreak,
	dayOfMonth,
	isoDay,
	lastDays,
	longestStreak,
	MAX_HABITS,
	MAX_NAME,
	nameProblem,
	nextHabitId,
	reviveHabits,
	shiftDay,
	tally,
	todayIso,
	toggleDay,
	weekdayLabel,
} from "@/features/productivity-tools/habit-utils";

describe("habit dates", () => {
	it("reads a local calendar date, not the UTC one", () => {
		// Half past midnight in Lagos is still the previous day in UTC.
		const lateNight = new Date(2026, 10, 15, 0, 30);
		expect(isoDay(lateNight)).toBe("2026-11-15");
		expect(todayIso(lateNight)).toBe("2026-11-15");
	});

	it("steps across a month and a year", () => {
		expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
		expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
		expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
	});

	it("lists a week oldest first, ending today", () => {
		const week = lastDays("2026-11-15", 7);
		expect(week[0]).toBe("2026-11-09");
		expect(week[6]).toBe("2026-11-15");
		expect(lastDays("2026-11-15")).toHaveLength(7);
	});

	it("labels the weekday and the day number", () => {
		expect(weekdayLabel("2026-11-15")).toBe("Sun");
		expect(dayOfMonth("2026-11-05")).toBe("5");
	});
});

describe("habit ticks", () => {
	it("adds a day, then takes it away", () => {
		expect(toggleDay([], "2026-11-15")).toEqual(["2026-11-15"]);
		expect(toggleDay(["2026-11-15"], "2026-11-15")).toEqual([]);
	});

	it("keeps the list sorted and free of duplicates", () => {
		expect(toggleDay(["2026-11-15", "2026-11-10"], "2026-11-12")).toEqual(["2026-11-10", "2026-11-12", "2026-11-15"]);
		expect(toggleDay(["2026-11-15", "2026-11-15"], "2026-11-14")).toEqual(["2026-11-14", "2026-11-15"]);
	});

	it("counts how many of a window are done", () => {
		const week = lastDays("2026-11-15", 7);
		expect(tally(["2026-11-15", "2026-11-13", "2026-01-01"], week)).toBe(2);
	});
});

describe("habit streaks", () => {
	it("counts back from today", () => {
		expect(currentStreak(["2026-11-15", "2026-11-14", "2026-11-13"], "2026-11-15")).toBe(3);
	});

	it("keeps a run alive while today is still open", () => {
		expect(currentStreak(["2026-11-14", "2026-11-13"], "2026-11-15")).toBe(2);
	});

	it("breaks when a whole day has been missed", () => {
		expect(currentStreak(["2026-11-13"], "2026-11-15")).toBe(0);
		expect(currentStreak([], "2026-11-15")).toBe(0);
	});

	it("finds the longest run anywhere in the history", () => {
		expect(longestStreak([])).toBe(0);
		expect(longestStreak(["2026-11-01"])).toBe(1);
		expect(longestStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-06", "2026-11-07"])).toBe(3);
	});
});

describe("habit names", () => {
	const habit = createHabit("Read", "habit-1");

	it("makes a habit with no days ticked", () => {
		expect(habit).toEqual({ id: "habit-1", name: "Read", days: [] });
	});

	it("asks for a name before anything else", () => {
		expect(nameProblem("   ", [])).toBe("Give the habit a name first.");
		expect(nameProblem("a".repeat(MAX_NAME + 1), [])).toContain("under");
		expect(nameProblem("read", [habit])).toContain("already");
		expect(nameProblem("Walk", [habit])).toBe("");
	});

	it("stops at the habit limit", () => {
		const many = Array.from({ length: MAX_HABITS }, (_, index) => createHabit(`Habit ${index}`, `habit-${index}`));
		expect(nameProblem("One more", many)).toContain(String(MAX_HABITS));
	});

	it("hands out an unused id", () => {
		expect(nextHabitId([])).toBe("habit-1");
		expect(nextHabitId([createHabit("Read", "habit-1"), createHabit("Walk", "habit-2")])).toBe("habit-3");
		expect(nextHabitId([createHabit("Read", "habit-2")])).toBe("habit-3");
	});
});

describe("reading stored habits", () => {
	it("refuses anything that is not a list", () => {
		expect(reviveHabits(null)).toEqual([]);
		expect(reviveHabits({ habits: [] })).toEqual([]);
		expect(reviveHabits("[]")).toEqual([]);
	});

	it("drops entries without a name and tidies the rest", () => {
		const revived = reviveHabits([
			{ id: "a", name: "  Read  ", days: ["2026-11-15", "2026-11-15", "not a date", 7] },
			{ id: "b", name: "   ", days: [] },
			{ name: "Walk" },
			null,
			42,
		]);
		expect(revived).toEqual([
			{ id: "a", name: "Read", days: ["2026-11-15"] },
			{ id: "habit-2", name: "Walk", days: [] },
		]);
	});

	it("caps a runaway list", () => {
		const many = Array.from({ length: 30 }, (_, index) => ({ id: `h${index}`, name: `Habit ${index}`, days: [] }));
		expect(reviveHabits(many)).toHaveLength(MAX_HABITS);
	});
});
