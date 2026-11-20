/**
 * The habit tracker's maths, kept away from React so it can be tested on plain values.
 * Days are local calendar dates in `YYYY-MM-DD` form: a tick belongs to the day you were
 * living in, not to a UTC offset somewhere else.
 */

import { parseDay, shiftDay } from "@/features/productivity-tools/local-day";

export type Habit = { id: string; name: string; days: string[] };

export const HABIT_KEY = "clickkit.habits.v1";
export const WINDOW_DAYS = 7;
export const MAX_HABITS = 12;
export const MAX_NAME = 48;

export { isoDay, parseDay, shiftDay, todayIso } from "@/features/productivity-tools/local-day";

/** The last `count` days as dates, oldest first, ending on `today`. */
export const lastDays = (today: string, count: number = WINDOW_DAYS): string[] =>
	Array.from({ length: count }, (_, index) => shiftDay(today, index - (count - 1)));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const weekdayLabel = (iso: string): string => WEEKDAYS[parseDay(iso).getDay()];

export const dayOfMonth = (iso: string): string => String(parseDay(iso).getDate());

export const isDone = (days: string[], day: string): boolean => days.includes(day);

/** Adds or removes a day and keeps the list in date order, with no duplicates. */
export const toggleDay = (days: string[], day: string): string[] => {
	const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
	return [...new Set(next)].sort();
};

/**
 * The run of days ending today — or ending yesterday, so a streak stays alive until
 * the day is actually over rather than clicking down to zero at midnight.
 */
export const currentStreak = (days: string[], today: string): number => {
	const done = new Set(days);
	let cursor = done.has(today) ? today : shiftDay(today, -1);
	if (!done.has(cursor)) return 0;
	let length = 0;
	while (done.has(cursor)) {
		length += 1;
		cursor = shiftDay(cursor, -1);
	}
	return length;
};

/** The longest run anywhere in the history. */
export const longestStreak = (days: string[]): number => {
	if (!days.length) return 0;
	const sorted = [...new Set(days)].sort();
	let best = 1;
	let run = 1;
	for (let index = 1; index < sorted.length; index += 1) {
		run = shiftDay(sorted[index - 1], 1) === sorted[index] ? run + 1 : 1;
		best = Math.max(best, run);
	}
	return best;
};

/** How many of the given days are ticked. */
export const tally = (days: string[], window: string[]): number =>
	window.filter((day) => days.includes(day)).length;

export const createHabit = (name: string, id: string): Habit => ({ id, name: name.trim().slice(0, MAX_NAME), days: [] });

export const nameProblem = (name: string, habits: Habit[]): string => {
	const trimmed = name.trim();
	if (!trimmed) return "Give the habit a name first.";
	if (trimmed.length > MAX_NAME) return `Keep the name under ${MAX_NAME} characters.`;
	if (habits.some((habit) => habit.name.toLowerCase() === trimmed.toLowerCase())) return "You already track a habit with that name.";
	if (habits.length >= MAX_HABITS) return `That is ${MAX_HABITS} habits — plenty. Remove one to add another.`;
	return "";
};

/** Anything that is not a well-formed habit is dropped rather than trusted. */
export const reviveHabits = (raw: unknown): Habit[] => {
	if (!Array.isArray(raw)) return [];
	const habits: Habit[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const name = typeof record.name === "string" ? record.name.trim().slice(0, MAX_NAME) : "";
		if (!name) continue;
		const days = Array.isArray(record.days)
			? [...new Set(record.days.filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(day)))].sort()
			: [];
		const id = typeof record.id === "string" && record.id ? record.id : `habit-${habits.length + 1}`;
		habits.push({ id, name, days });
		if (habits.length >= MAX_HABITS) break;
	}
	return habits;
};

/** Ids only have to be unique inside one list, so a counter is enough and stays readable. */
export const nextHabitId = (habits: Habit[]): string => {
	const used = new Set(habits.map((habit) => habit.id));
	let seed = habits.length + 1;
	while (used.has(`habit-${seed}`)) seed += 1;
	return `habit-${seed}`;
};
