"use client";

import { useState } from "react";
import { buttonClassName, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	createHabit,
	currentStreak,
	type Habit,
	HABIT_KEY,
	isDone,
	lastDays,
	MAX_HABITS,
	MAX_NAME,
	longestStreak,
	dayOfMonth,
	nameProblem,
	nextHabitId,
	reviveHabits,
	tally,
	todayIso,
	toggleDay,
	WINDOW_DAYS,
	weekdayLabel,
} from "@/features/productivity-tools/habit-utils";
import { clearStore, useStoredState } from "@/features/productivity-tools/stored-state";

export const HabitTracker = () => {
	const [habits, setHabits, ready] = useStoredState<Habit[]>(HABIT_KEY, [], reviveHabits);
	const [name, setName] = useState("");
	const [problem, setProblem] = useState("");
	const [today] = useState(todayIso);

	const window = lastDays(today, WINDOW_DAYS);
	const totalTicks = habits.reduce((sum, habit) => sum + tally(habit.days, window), 0);
	const doneToday = habits.filter((habit) => isDone(habit.days, today)).length;
	const bestRun = habits.reduce((best, habit) => Math.max(best, longestStreak(habit.days)), 0);

	const add = () => {
		const complaint = nameProblem(name, habits);
		if (complaint) {
			setProblem(complaint);
			return;
		}
		setHabits((current) => [...current, createHabit(name, nextHabitId(current))]);
		setName("");
		setProblem("");
	};

	const tick = (id: string, day: string) => {
		setHabits((current) => current.map((habit) => (habit.id === id ? { ...habit, days: toggleDay(habit.days, day) } : habit)));
	};

	const remove = (id: string) => {
		setHabits((current) => current.filter((habit) => habit.id !== id));
	};

	const forgetEverything = () => {
		setHabits([]);
		setName("");
		setProblem("");
		clearStore(HABIT_KEY);
	};

	const grid = (habit: Habit) => (
		<div className="mt-3 flex flex-wrap items-end gap-2">
			{window.map((day) => {
				const done = isDone(habit.days, day);
				const label = `${habit.name} on ${day}`;
				return (
					<button
						aria-label={label}
						aria-pressed={done}
						className={`flex w-11 flex-col items-center gap-1 border px-1 py-2 text-xs font-semibold ${
							done ? "border-[#2f4539] bg-[#2f4539] text-[#f6f4eb]" : "border-line bg-surface text-ink hover:border-[#5f6259]"
						}`}
						key={day}
						onClick={() => tick(habit.id, day)}
						title={day === today ? "Today" : day}
						type="button"
					>
						<span className={done ? "text-[#f6f4eb]" : "text-muted"}>{weekdayLabel(day)}</span>
						<span>{dayOfMonth(day)}</span>
					</button>
				);
			})}
		</div>
	);

	return (
		<ToolPanel>
			<div>
				<label className={labelClassName} htmlFor="habit-name">
					A habit you want to keep
				</label>
				<div className="mt-2 flex flex-wrap gap-2">
					<input
						className={`${fieldClassName} min-w-0 flex-1`}
						id="habit-name"
						maxLength={MAX_NAME}
						onChange={(event) => {
							setName(event.target.value);
							setProblem("");
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") add();
						}}
						placeholder="Read ten pages"
						type="text"
						value={name}
					/>
					<button className={primaryButtonClassName} onClick={add} type="button">
						Track it
					</button>
				</div>
				{problem ? <p className="mt-2 text-xs text-[#8a3f30]">{problem}</p> : null}
				<p className={`${hintClassName} mt-2`}>
					Tick a day once you have done it. Streaks count back from today (a day still open does not break the run). Everything is stored in this browser only — nothing is uploaded, and clearing site data clears it.
				</p>
			</div>
			{ready && habits.length === 0 ? (
				<p className="m-0 text-xs text-muted">No habits yet. Name one above and it will appear here with a {WINDOW_DAYS}-day grid.</p>
			) : null}
			{habits.map((habit) => (
				<div className="border border-line bg-[#f8f7f3] p-3" key={habit.id}>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<p className="m-0 text-sm font-semibold text-ink">{habit.name}</p>
						<div className="flex items-center gap-3">
							<p className="m-0 text-xs text-muted">
								{currentStreak(habit.days, today)} day streak · {tally(habit.days, window)}/{WINDOW_DAYS} this week
							</p>
							<button aria-label={`Remove ${habit.name}`} className="text-xs font-semibold text-[#8a3f30] underline" onClick={() => remove(habit.id)} type="button">
								Remove
							</button>
						</div>
					</div>
					{grid(habit)}
				</div>
			))}
			{habits.length ? (
				<>
					<StatGrid
						items={[
							{ label: "Habits", value: `${habits.length} of ${MAX_HABITS}` },
							{ label: "Done today", value: `${doneToday} of ${habits.length}` },
							{ label: "Ticks this week", value: `${totalTicks} of ${habits.length * WINDOW_DAYS}` },
							{ label: "Best run", value: `${bestRun} day${bestRun === 1 ? "" : "s"}` },
						]}
					/>
					<div className="flex flex-wrap gap-2">
						<button className={buttonClassName} onClick={() => setHabits((current) => current.map((habit) => ({ ...habit, days: toggleDay(habit.days, today) })))} type="button">
							Tick everything for today
						</button>
						<button className={buttonClassName} onClick={forgetEverything} type="button">
							Clear all habits
						</button>
					</div>
					<p className={hintClassName}>
						{ready ? "Saved." : "Loading…"} The grid shows the last {WINDOW_DAYS} days, ending today.
					</p>
				</>
			) : null}
		</ToolPanel>
	);
};
