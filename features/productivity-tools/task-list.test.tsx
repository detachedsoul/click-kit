import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskList } from "@/features/productivity-tools/task-list";
import { TASK_KEY } from "@/features/productivity-tools/task-utils";

const writeText = vi.fn(async () => undefined);

const add = async (text: string) => {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText("Add a task"), text);
	await user.click(screen.getByRole("button", { name: "Add" }));
};

beforeEach(() => {
	window.localStorage.clear();
	writeText.mockClear();
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("task list", () => {
	it("starts with a nudge", () => {
		render(<TaskList />);
		expect(screen.getByText(/No tasks yet/u)).toBeTruthy();
	});

	it("adds a task and clears the box", async () => {
		render(<TaskList />);
		await add("Draft the note");
		expect(screen.getByText("Draft the note")).toBeTruthy();
		expect((screen.getByLabelText("Add a task") as HTMLInputElement).value).toBe("");
		expect(screen.getByText("Still open").parentElement?.textContent).toContain("1");
	});

	it("adds on Enter", async () => {
		render(<TaskList />);
		const user = userEvent.setup();
		await user.type(screen.getByLabelText("Add a task"), "Walk{Enter}");
		expect(screen.getByText("Walk")).toBeTruthy();
	});

	it("ticks a task off and filters by it", async () => {
		render(<TaskList />);
		await add("Read");
		await add("Walk");
		fireEvent.click(screen.getByLabelText("Done: Read"));
		expect(screen.getByText("Finished").parentElement?.textContent).toContain("1");

		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		expect(screen.queryByText("Read")).toBeNull();
		expect(screen.getByText("Walk")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		expect(screen.getByText("Read")).toBeTruthy();
		expect(screen.queryByText("Walk")).toBeNull();
	});

	it("renames a task in place", async () => {
		render(<TaskList />);
		await add("Read");
		fireEvent.click(screen.getByRole("button", { name: "Read" }));
		const field = screen.getByLabelText("Rename Read") as HTMLInputElement;
		fireEvent.change(field, { target: { value: "Read ten pages" } });
		fireEvent.keyDown(field, { key: "Enter" });
		expect(screen.getByText("Read ten pages")).toBeTruthy();
		expect(screen.queryByText("Read")).toBeNull();
	});

	it("leaves the text alone when a rename is abandoned", async () => {
		render(<TaskList />);
		await add("Read");
		fireEvent.click(screen.getByRole("button", { name: "Read" }));
		const field = screen.getByLabelText("Rename Read");
		fireEvent.change(field, { target: { value: "Something else" } });
		fireEvent.keyDown(field, { key: "Escape" });
		expect(screen.getByText("Read")).toBeTruthy();
	});

	it("removes one task and clears the finished ones", async () => {
		render(<TaskList />);
		await add("Read");
		await add("Walk");
		fireEvent.click(screen.getByLabelText("Done: Read"));
		fireEvent.click(screen.getByRole("button", { name: "Clear finished" }));
		expect(screen.queryByText("Read")).toBeNull();
		expect(screen.getByText("Walk")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Remove Walk" }));
		expect(screen.getByText(/No tasks yet/u)).toBeTruthy();
	});

	it("keeps the list after the page is opened again", async () => {
		const first = render(<TaskList />);
		await add("Publish the post");
		fireEvent.click(screen.getByLabelText("Done: Publish the post"));
		first.unmount();

		render(<TaskList />);
		expect(await screen.findByText("Publish the post")).toBeTruthy();
		expect((screen.getByLabelText("Done: Publish the post") as HTMLInputElement).checked).toBe(true);
	});

	it("copies the list as a markdown checklist", async () => {
		render(<TaskList />);
		await add("Read");
		// user-event installs its own clipboard for typing, so put ours back before the click.
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		fireEvent.click(screen.getByRole("button", { name: "Copy" }));
		expect(writeText).toHaveBeenCalledWith("# Tasks\n\n- [ ] Read\n");
	});

	it("clears everything, storage included", async () => {
		render(<TaskList />);
		await add("Read");
		expect(window.localStorage.getItem(TASK_KEY)).toContain("Read");
		fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
		expect(screen.getByText(/No tasks yet/u)).toBeTruthy();
		expect(window.localStorage.getItem(TASK_KEY)).toBe("[]");
	});
});
