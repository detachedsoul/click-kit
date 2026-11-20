/**
 * The task list's rules, kept as plain functions over plain values so the behaviour can be
 * checked without a browser. Tasks live in this browser's storage and nowhere else.
 */

export type Task = { id: string; text: string; done: boolean; added: string };
export type TaskFilter = "all" | "open" | "done";

export const TASK_KEY = "clickkit.tasks.v1";
export const MAX_TASKS = 200;
export const MAX_TEXT = 140;

export const trimText = (text: string): string => text.replace(/\s+/gu, " ").trim().slice(0, MAX_TEXT);

export const nextTaskId = (tasks: Task[]): string => {
	const used = new Set(tasks.map((task) => task.id));
	let seed = tasks.length + 1;
	while (used.has(`task-${seed}`)) seed += 1;
	return `task-${seed}`;
};

/** Adds a task unless there is nothing to add or the list is full. */
export const addTask = (tasks: Task[], text: string, today: string): Task[] => {
	const clean = trimText(text);
	if (!clean || tasks.length >= MAX_TASKS) return tasks;
	const task: Task = { id: nextTaskId(tasks), text: clean, done: false, added: today };
	return [...tasks, task];
};

export const toggleTask = (tasks: Task[], id: string): Task[] =>
	tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));

export const removeTask = (tasks: Task[], id: string): Task[] => tasks.filter((task) => task.id !== id);

export const clearDone = (tasks: Task[]): Task[] => tasks.filter((task) => !task.done);

export const renameTask = (tasks: Task[], id: string, text: string): Task[] => {
	const clean = trimText(text);
	if (!clean) return tasks;
	return tasks.map((task) => (task.id === id ? { ...task, text: clean } : task));
};

export const openCount = (tasks: Task[]): number => tasks.filter((task) => !task.done).length;

export const filterTasks = (tasks: Task[], filter: TaskFilter): Task[] => {
	if (filter === "open") return tasks.filter((task) => !task.done);
	if (filter === "done") return tasks.filter((task) => task.done);
	return tasks;
};

/** A markdown checklist, so the list can leave this page as text you can paste anywhere. */
export const tasksAsMarkdown = (tasks: Task[], title = "Tasks"): string => {
	if (!tasks.length) return "";
	const lines = tasks.map((task) => `- [${task.done ? "x" : " "}] ${task.text}`);
	return [`# ${title}`, "", ...lines, ""].join("\n");
};

/** Anything that is not a task is dropped rather than trusted. */
export const reviveTasks = (raw: unknown): Task[] => {
	if (!Array.isArray(raw)) return [];
	const tasks: Task[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		if (typeof record.text !== "string") continue;
		const text = trimText(record.text);
		if (!text) continue;
		const added = typeof record.added === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(record.added) ? record.added : "";
		const id = typeof record.id === "string" && record.id ? record.id : `task-${tasks.length + 1}`;
		tasks.push({ id, text, done: record.done === true, added });
		if (tasks.length >= MAX_TASKS) break;
	}
	return tasks;
};
