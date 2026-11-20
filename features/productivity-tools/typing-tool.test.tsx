import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypingTester } from "@/features/productivity-tools/typing-tool";
import { HISTORY_KEY } from "@/features/productivity-tools/typing-utils";

/** localStorage, with the same shape the browser gives us. */
const store = new Map<string, string>();

beforeEach(() => {
	store.clear();
	vi.stubGlobal("localStorage", {
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		removeItem: (key: string) => store.delete(key),
		setItem: (key: string, value: string) => store.set(key, value),
	});
	vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	cleanup();
});

const setup = async () => {
	const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
	render(<TypingTester />);
	await act(async () => {
		vi.advanceTimersByTime(0);
	});
	return user;
};

/** The passage on screen, as one string. */
const passage = () => Array.from(document.querySelectorAll<HTMLElement>("[data-status]")).map((node) => node.textContent ?? "").join("");

/** Types the next characters of the passage, exactly as they are written. */
const typePassage = async (user: ReturnType<typeof userEvent.setup>, count: number) => {
	const target = passage();
	await user.keyboard(target.slice(0, count));
};

const advance = async (milliseconds: number) => {
	await act(async () => {
		vi.advanceTimersByTime(milliseconds);
	});
};

describe("the typing tester", () => {
	it("shows a passage and the clock it will run for", async () => {
		await setup();
		expect(passage().length).toBeGreaterThan(100);
		expect(screen.getByText("Time left").parentElement?.textContent).toContain("0:30");
		expect(screen.getByText(/30 seconds on Medium/u)).toBeTruthy();
		expect(screen.getByRole("textbox", { name: "Typing area" })).toBeTruthy();
	});

	it("starts the clock on the first key and counts the typing", async () => {
		const user = await setup();
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await typePassage(user, 10);
		expect(screen.getByText("Characters").parentElement?.textContent).toContain("10");
		expect(document.querySelectorAll('[data-status="correct"]')).toHaveLength(10);
		await advance(1000);
		expect(screen.getByText("Time left").parentElement?.textContent).toContain("0:29");
		// Ten characters in a second is 120 wpm: fast, and greater than nothing.
		expect(Number((screen.getByText("Words per minute").parentElement?.textContent ?? "").replace(/\D/gu, ""))).toBeGreaterThan(0);
	});

	it("highlights the characters that were typed wrong", async () => {
		const user = await setup();
		const target = passage();
		const first = target[0];
		const wrong = first === "x" ? "z" : "x";
		await user.keyboard(wrong);
		expect(document.querySelectorAll('[data-status="incorrect"]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-status="correct"]')).toHaveLength(0);
		// Accuracy follows the mistake immediately.
		expect(screen.getByText("Accuracy").parentElement?.textContent).toContain("0%");

		// Backspace takes the mistake away again.
		await user.keyboard("{Backspace}");
		expect(document.querySelectorAll('[data-status="incorrect"]')).toHaveLength(0);
		expect(screen.getByText("Characters").parentElement?.textContent).toContain("0");
	});

	it("ends when the clock runs out and shows the result", async () => {
		const user = await setup();
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await typePassage(user, 30);
		await advance(30_200);

		expect(screen.getByRole("heading", { name: "Your result" })).toBeTruthy();
		expect(screen.getByText(/30 seconds on medium/u)).toBeTruthy();
		expect(screen.getByText("Characters per minute")).toBeTruthy();
		expect(screen.getByText("Mistakes").parentElement?.textContent).toContain("0");
		// A finished test stops taking keystrokes.
		await user.keyboard("more");
		expect(screen.getByRole("heading", { name: "Your result" })).toBeTruthy();
	});

	it("keeps each attempt in the history on this device", async () => {
		const user = await setup();
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await typePassage(user, 40);
		await advance(30_200);

		const kept = JSON.parse(store.get(HISTORY_KEY) ?? "[]") as { duration: number; wpm: number }[];
		expect(kept).toHaveLength(1);
		expect(kept[0].duration).toBe(30);
		expect(kept[0].wpm).toBeGreaterThan(0);
		expect(screen.getByText(/1 attempt kept on this device/u)).toBeTruthy();
		expect(screen.getByText("Best").parentElement?.textContent).toContain("wpm");
	});

	it("reads the history back after a reload", async () => {
		store.set(HISTORY_KEY, JSON.stringify([{ accuracy: 97.5, at: Date.now(), correct: 200, cpm: 240, duration: 60, incorrect: 5, level: "hard", wpm: 48 }]));
		await setup();
		expect(screen.getByText(/1 attempt kept on this device/u)).toBeTruthy();
		expect(screen.getByText("Best").parentElement?.textContent).toContain("48 wpm");
		expect(screen.getByText(/240 cpm · 60s · Hard/u)).toBeTruthy();
	});

	it("clears the history when asked", async () => {
		store.set(HISTORY_KEY, JSON.stringify([{ accuracy: 100, at: Date.now(), correct: 100, cpm: 100, duration: 15, incorrect: 0, level: "easy", wpm: 20 }]));
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Clear history" }));
		expect(store.get(HISTORY_KEY)).toBe("[]");
		expect(screen.getByText(/No attempts yet/u)).toBeTruthy();
	});

	it("changes the length and the difficulty, with a fresh passage", async () => {
		const user = await setup();
		const first = passage();
		await user.click(screen.getByRole("button", { name: "60s" }));
		expect(screen.getByText("Time left").parentElement?.textContent).toContain("1:00");
		expect(passage().length).toBeGreaterThan(first.length);

		await user.click(screen.getByRole("button", { name: "Easy" }));
		expect(screen.getByText(/Short, plain words/u)).toBeTruthy();
		expect(passage()).toMatch(/^[a-z ·]+$/u);
	});

	it("takes a passage of your own", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Your own text" }));
		expect(screen.getByText(/needs at least 20 characters/u)).toBeTruthy();

		fireEvent.change(screen.getByLabelText(/Your own text/u), { target: { value: "pack my box with five dozen liquor jugs" } });
		expect(passage().startsWith("pack my box with five dozen")).toBe(true);
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await user.keyboard("pack my box");
		expect(document.querySelectorAll('[data-status="correct"]')).toHaveLength(11);
	});

	it("starts again on Tab and on Escape", async () => {
		const user = await setup();
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await typePassage(user, 12);
		expect(screen.getByText("Characters").parentElement?.textContent).toContain("12");

		await user.keyboard("{Tab}");
		expect(screen.getByText("Characters").parentElement?.textContent).toContain("0");
		expect(screen.getByText("Time left").parentElement?.textContent).toContain("0:30");

		await typePassage(user, 5);
		await user.keyboard("{Escape}");
		expect(screen.getByText("Characters").parentElement?.textContent).toContain("0");
	});

	it("counts a mistake past the end of the passage", async () => {
		const user = await setup();
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		const target = passage();
		await user.keyboard(target);
		// Everything right, then a keystroke too many.
		await user.keyboard("x");
		const mistakes = screen.getByText("Accuracy").parentElement?.textContent ?? "";
		expect(mistakes).not.toContain("100%");
	});
	it("flags a space that should have been a letter or the other way round", async () => {
		const user = await setup();
		const target = passage();
		const space = target.indexOf(" ");
		expect(space).toBeGreaterThan(0);
		await user.click(screen.getByRole("textbox", { name: "Typing area" }));
		await user.keyboard(target.slice(0, space));
		expect(document.querySelectorAll('[data-status="correct"]')).toHaveLength(space);
		// A letter where the passage has a space: the space is the character that is wrong.
		await user.keyboard("x");
		const wrong = Array.from(document.querySelectorAll<HTMLElement>('[data-status="incorrect"]'));
		expect(wrong).toHaveLength(1);
		expect(wrong[0].textContent).toBe(" ");
		expect(screen.getByText("Accuracy").parentElement?.textContent).not.toContain("100%");
	});
});
