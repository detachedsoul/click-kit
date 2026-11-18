import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { formatClock, formatDecimalHours, formatDuration, parseDuration, sumDurations } from "@/features/calculators/duration-utils";
import DurationCalculator from "@/features/calculators/duration-calculator";

afterEach(cleanup);

describe("duration arithmetic", () => {
	it("parses the supported formats", () => {
		expect(parseDuration("1:30")).toBe(5400);
		expect(parseDuration("1:02:03")).toBe(3723);
		expect(parseDuration("1h 30m")).toBe(5400);
		expect(parseDuration("90m")).toBe(5400);
		expect(parseDuration("45")).toBe(2700);
		expect(parseDuration("2.5h")).toBe(9000);
		expect(parseDuration("30 s")).toBe(30);
		expect(parseDuration("1 hour 15 min")).toBe(4500);
	});

	it("rejects impossible values", () => {
		expect(() => parseDuration("")).toThrow(/Enter a duration/u);
		expect(() => parseDuration("1:75")).toThrow(/above 59/u);
		expect(() => parseDuration("3d")).toThrow(/Unrecognised unit/u);
		expect(() => parseDuration("soon")).toThrow(/is not a duration/u);
	});

	it("formats totals", () => {
		expect(formatDuration(5400)).toBe("1h 30m");
		expect(formatDuration(90061)).toBe("25h 1m 1s");
		expect(formatDuration(45)).toBe("45s");
		expect(formatDuration(0)).toBe("0s");
		expect(formatDuration(-5400)).toBe("-1h 30m");
		expect(formatClock(5400)).toBe("1:30:00");
		expect(formatClock(90061)).toBe("25:01:01");
		expect(formatDecimalHours(5400)).toBe("1.5 h");
	});

	it("adds and subtracts rows and reports errors", () => {
		const total = sumDurations([
			{ id: "a", text: "1:30", sign: 1 },
			{ id: "b", text: "45m", sign: 1 },
			{ id: "c", text: "0:15", sign: -1 },
		]);
		expect(total.seconds).toBe(7200);
		expect(total.total).toBe("2h");
		expect(total.minutes).toBe(120);
		expect(total.workdays).toBe("0.25 × 8h");
		expect(total.errors).toEqual([]);
		expect(sumDurations([{ id: "a", text: "nope", sign: 1 }]).errors[0]).toContain("not a duration");
	});

	it("renders and recalculates", async () => {
		const user = userEvent.setup();
		render(<DurationCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("Total        2h 35m");
		await user.selectOptions(screen.getAllByLabelText("Add or subtract")[0], "Subtract");
		expect(output()).toContain("Total        -25m");
		await user.clear(screen.getAllByLabelText("Duration")[1]);
		await user.type(screen.getAllByLabelText("Duration")[1], "soon");
		expect(screen.getByRole("alert").textContent).toContain("is not a duration");
	});
});
