import { describe, expect, it } from "vitest";
import {
	addTask,
	clearDone,
	filterTasks,
	MAX_TASKS,
	MAX_TEXT,
	nextTaskId,
	openCount,
	removeTask,
	renameTask,
	reviveTasks,
	type Task,
	tasksAsMarkdown,
	toggleTask,
	trimText,
} from "@/features/productivity-tools/task-utils";

const today = "2026-11-15";

const build = (...texts: string[]): Task[] => texts.reduce((list, text) => addTask(list, text, today), [] as Task[]);

describe("adding tasks", () => {
	it("tidies the text and starts open", () => {
		const list = build("  Draft   the   note  ");
		expect(list).toEqual([{ id: "task-1", text: "Draft the note", done: false, added: today }]);
	});

	it("ignores an empty box", () => {
		expect(addTask([], "   ", today)).toEqual([]);
	});

	it("caps the text length", () => {
		expect(trimText("a".repeat(MAX_TEXT + 20))).toHaveLength(MAX_TEXT);
	});

	it("stops at the limit", () => {
		const full = Array.from({ length: MAX_TASKS }, (_, index) => ({ id: `task-${index + 1}`, text: `Task ${index}`, done: false, added: today }));
		expect(addTask(full, "One more", today)).toBe(full);
		expect(addTask(full, "One more", today)).toHaveLength(MAX_TASKS);
	});

	it("hands out an unused id even after removals", () => {
		expect(nextTaskId([])).toBe("task-1");
		const two = [{ id: "task-1", text: "a", done: false, added: today }, { id: "task-3", text: "b", done: false, added: today }];
		// task-3 is still in use, so the next free id after the list length is task-4.
		expect(nextTaskId(two)).toBe("task-4");
	});
});

describe("changing tasks", () => {
	it("ticks and unticks", () => {
		const list = build("Read", "Walk");
		const ticked = toggleTask(list, "task-1");
		expect(ticked[0].done).toBe(true);
		expect(ticked[1].done).toBe(false);
		expect(toggleTask(ticked, "task-1")[0].done).toBe(false);
	});

	it("renames, and ignores an empty rename", () => {
		const list = build("Read");
		expect(renameTask(list, "task-1", "  Read  ten  pages ")[0].text).toBe("Read ten pages");
		expect(renameTask(list, "task-1", "   ")[0].text).toBe("Read");
	});

	it("removes one task and clears the finished ones", () => {
		const list = toggleTask(build("Read", "Walk", "Stretch"), "task-2");
		expect(removeTask(list, "task-1").map((task) => task.text)).toEqual(["Walk", "Stretch"]);
		expect(clearDone(list).map((task) => task.text)).toEqual(["Read", "Stretch"]);
	});

	it("counts what is still open and filters the view", () => {
		const list = toggleTask(build("Read", "Walk"), "task-1");
		expect(openCount(list)).toBe(1);
		expect(filterTasks(list, "all")).toHaveLength(2);
		expect(filterTasks(list, "open").map((task) => task.text)).toEqual(["Walk"]);
		expect(filterTasks(list, "done").map((task) => task.text)).toEqual(["Read"]);
	});
});

describe("taking the list elsewhere", () => {
	it("writes a markdown checklist", () => {
		const list = toggleTask(build("Read", "Walk"), "task-1");
		expect(tasksAsMarkdown(list)).toBe("# Tasks\n\n- [x] Read\n- [ ] Walk\n");
	});

	it("writes nothing at all for an empty list", () => {
		expect(tasksAsMarkdown([])).toBe("");
	});
});

describe("reading stored tasks", () => {
	it("refuses anything that is not a list", () => {
		expect(reviveTasks(null)).toEqual([]);
		expect(reviveTasks({ tasks: [] })).toEqual([]);
	});

	it("drops entries it cannot use and keeps the rest", () => {
		const revived = reviveTasks([
			{ id: "a", text: "  Read  ", done: true, added: "2026-11-15" },
			{ id: "b", text: "   ", done: false },
			{ text: "Walk", done: "yes" },
			null,
			7,
		]);
		expect(revived).toEqual([
			{ id: "a", text: "Read", done: true, added: "2026-11-15" },
			{ id: "task-2", text: "Walk", done: false, added: "" },
		]);
	});
});
