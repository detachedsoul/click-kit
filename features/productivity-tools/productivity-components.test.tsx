import userEvent from "@testing-library/user-event";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	PasswordGeneratorTool,
	PomodoroTimerTool,
	RandomPickerTool,
} from "@/features/productivity-tools/productivity-components";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("productivity tools", () => {
	it("generates a cryptographically random password with selected character types", async () => {
		const user = userEvent.setup();
		render(<PasswordGeneratorTool />);
		fireEvent.change(screen.getByLabelText(/Length/u), { target: { value: "32" } });
		await user.click(screen.getByRole("button", { name: "Generate password" }));
		const password = screen.getByText(/^[\s\S]{32}$/u).textContent ?? "";
		expect(password).toHaveLength(32);
		expect(password).toMatch(/[a-z]/u);
		expect(password).toMatch(/[A-Z]/u);
	});

	it("picks from the entered options and reports too few choices", async () => {
		const user = userEvent.setup();
		render(<RandomPickerTool />);
		await user.click(screen.getByRole("button", { name: "Pick one" }));
		expect(["Tea", "Coffee", "Water"]).toContain(screen.getByText(/^(Tea|Coffee|Water)$/u).textContent);
		fireEvent.change(screen.getByLabelText("Choices (one per line)"), { target: { value: "Only one" } });
		expect((screen.getByRole("button", { name: "Pick one" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("starts, pauses and resets its focus timer", async () => {
		const user = userEvent.setup();
		render(<PomodoroTimerTool />);
		await user.click(screen.getByRole("button", { name: "Start" }));
		expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Pause" }));
		await user.click(screen.getByRole("button", { name: "Reset focus" }));
		expect(screen.getByRole("timer").textContent).toBe("25:00");
		vi.useFakeTimers();
		fireEvent.click(screen.getByRole("button", { name: "Start" }));
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(screen.getByRole("timer").textContent).toBe("24:59");
	});
});
