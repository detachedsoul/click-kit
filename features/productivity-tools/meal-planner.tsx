"use client";

import { buttonClassName, checkboxInputClassName, hintClassName, labelClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { clearStore, useStoredState } from "@/features/productivity-tools/stored-state";
import { DAYS, emptyWeek, isChecked, type MealWeek, mealAt, plannedCount, PLANNER_KEY, reviveWeek, setMeal, shoppingList, shoppingText, SLOTS, toggleChecked } from "@/features/productivity-tools/meal-utils";

export const MealPlanner = () => {
	const [week, setWeek, ready] = useStoredState<MealWeek>(PLANNER_KEY, emptyWeek(), reviveWeek);

	const items = shoppingList(week);
	const planned = plannedCount(week);
	const ticked = items.filter((item) => isChecked(week, item.id)).length;
	const days = DAYS.filter((day) => SLOTS.some((slot) => week.meals[`${day.toLowerCase()}-${slot.id}`])).length;

	const write = (day: (typeof DAYS)[number], slot: (typeof SLOTS)[number]["id"], patch: { items?: string; name?: string }) => {
		setWeek((current) => setMeal(current, day, slot, patch));
	};

	return (
		<ToolPanel>
			<p className={hintClassName}>
				Give each slot a meal and, on the line under it, the ingredients it needs — separated by commas. The shopping list below is built from those ingredient lines alone, so a meal with nothing listed buys nothing.
			</p>
			<StatGrid
				items={[
					{ label: "Meals planned", value: String(planned) },
					{ label: "Days covered", value: `${days} of 7` },
					{ label: "Things to buy", value: String(items.length) },
					{ label: "In the basket", value: `${ticked} of ${items.length}` },
				]}
			/>
			{!ready ? <p className={hintClassName}>Reading this browser&apos;s plan…</p> : null}
			<div className="grid gap-3 sm:grid-cols-2">
				{DAYS.map((day) => (
					<section className="flex flex-col gap-2 border border-line bg-[#fbfaf7] p-3" key={day}>
						<h2 className="m-0 text-sm font-semibold text-ink">{day}</h2>
						{SLOTS.map((slot) => {
							const meal = mealAt(week, day, slot.id);
							const id = `${day.toLowerCase()}-${slot.id}`;
							return (
								<div className="grid gap-1" key={id}>
									<label className={labelClassName} htmlFor={`meal-${id}`}>
										{slot.label}
									</label>
									<input
										aria-label={`${day} ${slot.label}`}
										className="min-h-9 w-full border border-field bg-surface px-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
										id={`meal-${id}`}
										onChange={(event) => write(day, slot.id, { name: event.target.value })}
										placeholder="What are you cooking?"
										type="text"
										value={meal.name}
									/>
									<input
										aria-label={`Ingredients for ${day} ${slot.label}`}
										className="min-h-8 w-full border border-field bg-surface px-2 text-[11px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
										onChange={(event) => write(day, slot.id, { items: event.target.value })}
										placeholder="Ingredients, comma separated"
										type="text"
										value={meal.items}
									/>
								</div>
							);
						})}
					</section>
				))}
			</div>
			<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold">Shopping list</h2>
					<CopyTextButton text={shoppingText(week)} />
				</div>
				{items.length ? (
					<ul className="m-0 flex list-none flex-col gap-2 p-0">
						{items.map((item) => {
							const done = isChecked(week, item.id);
							return (
								<li className={`flex flex-wrap items-center gap-2 border border-line px-3 py-2 ${done ? "bg-[#f2f1ec]" : ""}`} key={item.id}>
									<input
										aria-label={item.label}
										checked={done}
										className={checkboxInputClassName}
										id={`buy-${item.id.replace(/[^a-z0-9]+/gu, "-")}`}
										onChange={() => setWeek((current) => toggleChecked(current, item.id))}
										type="checkbox"
									/>
									<span className={`min-w-0 flex-1 text-xs ${done ? "text-muted line-through" : "text-ink"}`}>{item.label}</span>
									<span className="text-[11px] text-muted">{item.meals.length > 1 ? `${item.meals.length} meals` : item.meals[0]}</span>
								</li>
							);
						})}
					</ul>
				) : (
					<p className={hintClassName}>Nothing to buy yet. Write ingredients under a meal and each one turns up here once, however many meals want it.</p>
				)}
				<p className={hintClassName}>
					{planned
						? `${planned} meal${planned === 1 ? "" : "s"} on the plan, pulling in ${items.length} ingredient${items.length === 1 ? "" : "s"}. Ticking an item crosses it off — nothing is deleted, so nothing has to be retyped if you put it back.`
						: "The plan is kept on this device only: no account, no sync, no server."}
				</p>
			</section>
			<div className="flex flex-wrap items-center gap-2">
				<button
					className={buttonClassName}
					onClick={() => {
						setWeek(emptyWeek());
						clearStore(PLANNER_KEY);
					}}
					type="button"
				>
					Clear the week
				</button>
			</div>
		</ToolPanel>
	);
};
