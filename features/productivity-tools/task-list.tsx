"use client";

import { useState } from "react";
import { buttonClassName, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	addTask,
	clearDone,
	filterTasks,
	MAX_TASKS,
	MAX_TEXT,
	openCount,
	removeTask,
	renameTask,
	reviveTasks,
	type Task,
	type TaskFilter,
	TASK_KEY,
	tasksAsMarkdown,
	toggleTask,
} from "@/features/productivity-tools/task-utils";
import { todayIso } from "@/features/productivity-tools/local-day";
import { clearStore, useStoredState } from "@/features/productivity-tools/stored-state";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";

const FILTERS: { id: TaskFilter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "open", label: "Open" },
	{ id: "done", label: "Done" },
];

export const TaskList = () => {
	const [tasks, setTasks, ready] = useStoredState<Task[]>(TASK_KEY, [], reviveTasks);
	const [draft, setDraft] = useState("");
	const [filter, setFilter] = useState<TaskFilter>("all");
	const [editing, setEditing] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");
	const [full, setFull] = useState(false);

	const today = todayIso();
	const visible = filterTasks(tasks, filter);
	const open = openCount(tasks);
	const done = tasks.length - open;

	const add = () => {
		const next = addTask(tasks, draft, today);
		if (next === tasks) {
			setFull(Boolean(draft.trim()) && tasks.length >= MAX_TASKS);
			return;
		}
		setTasks(next);
		setDraft("");
		setFull(false);
	};

	return (
		<ToolPanel>
			<div>
				<label className={labelClassName} htmlFor="task-text">
					Add a task
				</label>
				<div className="mt-2 flex flex-wrap gap-2">
					<input
						className={`${fieldClassName} min-w-0 flex-1`}
						id="task-text"
						maxLength={MAX_TEXT}
						onChange={(event) => {
							setDraft(event.target.value);
							setFull(false);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") add();
						}}
						placeholder="Draft the quarterly note"
						type="text"
						value={draft}
					/>
					<button className={primaryButtonClassName} onClick={add} type="button">
						Add
					</button>
				</div>
				<p className={`${hintClassName} mt-2`}>
					{full ? `That is ${MAX_TASKS} tasks — clear some out to add more.` : "The list is saved in this browser only. Nothing is uploaded, so it stays on this device."}
				</p>
			</div>
			{tasks.length ? (
				<>
					<SegmentedControl label="Show" onChange={setFilter} options={FILTERS} value={filter} />
					<StatGrid
						items={[
							{ label: "Still open", value: String(open) },
							{ label: "Finished", value: String(done) },
							{ label: "Total", value: String(tasks.length) },
							{ label: "Showing", value: FILTERS.find((entry) => entry.id === filter)?.label ?? "All" },
						]}
					/>
					{visible.length ? (
						<ul className="m-0 flex list-none flex-col gap-2 p-0">
							{visible.map((task) => (
								<li className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3" key={task.id}>
									<input
										aria-label={`Done: ${task.text}`}
										checked={task.done}
										className="checkbox-input"
										onChange={() => setTasks(toggleTask(tasks, task.id))}
										type="checkbox"
									/>
									{editing === task.id ? (
										<input
											aria-label={`Rename ${task.text}`}
											autoFocus
											className={`${fieldClassName} mt-0 min-w-0 flex-1`}
											maxLength={MAX_TEXT}
											onBlur={() => {
												setTasks(renameTask(tasks, task.id, editDraft));
												setEditing(null);
											}}
											onChange={(event) => setEditDraft(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													setTasks(renameTask(tasks, task.id, editDraft));
													setEditing(null);
												}
												if (event.key === "Escape") setEditing(null);
											}}
											type="text"
											value={editDraft}
										/>
									) : (
										<button
											className={`min-w-0 flex-1 cursor-text text-left text-sm ${task.done ? "text-muted line-through" : "text-ink"}`}
											onClick={() => {
												setEditing(task.id);
												setEditDraft(task.text);
											}}
											type="button"
										>
											{task.text}
										</button>
									)}
									{task.added && task.added !== today ? <span className="text-xs text-muted">added {task.added}</span> : null}
									<button aria-label={`Remove ${task.text}`} className="text-xs font-semibold text-[#8a3f30] underline" onClick={() => setTasks(removeTask(tasks, task.id))} type="button">
										Remove
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="m-0 text-xs text-muted">{filter === "done" ? "Nothing finished yet." : "Nothing open — the list is clear."}</p>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<button className={buttonClassName} disabled={!done} onClick={() => setTasks(clearDone(tasks))} type="button">
							Clear finished
						</button>
						<button
							className={buttonClassName}
							onClick={() => {
								setTasks([]);
								clearStore(TASK_KEY);
							}}
							type="button"
						>
							Clear all
						</button>
						<CopyTextButton text={tasksAsMarkdown(tasks)} />
					</div>
				</>
			) : (
				<p className="m-0 text-xs text-muted">{ready ? "No tasks yet. Anything you add is saved in this browser." : "Loading your list…"}</p>
			)}
		</ToolPanel>
	);
};
