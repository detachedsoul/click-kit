import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MeetingCostMeter } from "@/features/productivity-tools/meeting-cost";
import { clockLabel, costOf, costPerHour, costPerMinute, costSummary, MAX_ATTENDEES, money, sanitiseAttendees, sanitiseRate } from "@/features/productivity-tools/meeting-cost-utils";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const stat = (label: string) => screen.getByText(label).parentElement?.textContent ?? "";
/** The readout comes first in the page; the copy button adds a screen-reader status after it. */
const readout = () => screen.getAllByRole("status")[0].textContent ?? "";

describe("meeting cost arithmetic", () => {
	it("adds the room up", () => {
		expect(costPerHour(6, 45)).toBe(270);
		expect(costPerMinute(6, 45)).toBeCloseTo(4.5, 5);
		expect(costOf(6, 45, 30)).toBe(135);
		expect(costOf(6, 45, -5)).toBe(0);
	});

	it("keeps the numbers inside their rails", () => {
		expect(sanitiseAttendees(-3)).toBe(0);
		expect(sanitiseAttendees(2.6)).toBe(3);
		expect(sanitiseAttendees(10_000)).toBe(MAX_ATTENDEES);
		expect(sanitiseAttendees(Number.NaN)).toBe(0);
		expect(sanitiseRate(-1)).toBe(0);
		expect(sanitiseRate(Number.POSITIVE_INFINITY)).toBe(0);
	});

	it("reads the clock the way people say it", () => {
		expect(clockLabel(0)).toBe("00:00");
		expect(clockLabel(65)).toBe("01:05");
		expect(clockLabel(3725)).toBe("1:02:05");
		expect(clockLabel(-10)).toBe("00:00");
	});

	it("writes money in the currency picked", () => {
		expect(money(270, "GBP")).toContain("270");
		expect(money(270, "NGN")).toContain("270");
		expect(money(4.5, "USD")).toContain("4.5");
		// A currency code Intl does not know still gives a readable figure.
		expect(money(12, "NOTACURRENCY")).toBe("12.00 NOTACURRENCY");
	});

	it("sums the meeting up in one line", () => {
		expect(costSummary(6, 45, "GBP", 30)).toContain("6 people");
		expect(costSummary(1, 45, "GBP", 30)).toContain("1 person");
		expect(costSummary(6, 45, "GBP", 30)).toContain("135");
	});
});

describe("meeting cost meter", () => {
	it("starts at nothing and shows what the room costs", () => {
		render(<MeetingCostMeter />);
		expect(readout()).toContain("0");
		expect(stat("Per hour")).toContain("270");
		expect(stat("Per minute")).toContain("4.5");
	});

	it("recounts as the room changes", () => {
		render(<MeetingCostMeter />);
		fireEvent.change(screen.getByLabelText("People in the room"), { target: { value: "10" } });
		fireEvent.change(screen.getByLabelText("Cost each per hour"), { target: { value: "60" } });
		expect(stat("Per hour")).toContain("600");
		expect(stat("30 min")).toContain("300");
		expect(stat("1 hour")).toContain("600");
	});

	it("follows the currency picked", () => {
		render(<MeetingCostMeter />);
		const before = readout();
		fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "NGN" } });
		expect(readout()).not.toBe(before);
	});

	it("runs the clock and charges for the time", () => {
		vi.useFakeTimers();
		render(<MeetingCostMeter />);
		fireEvent.click(screen.getByRole("button", { name: /Start the clock/u }));
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(stat("Clock")).toContain("01:00");
		expect(readout()).toContain("4.5");
	});

	it("pauses and starts again from where it stopped", () => {
		vi.useFakeTimers();
		render(<MeetingCostMeter />);
		fireEvent.click(screen.getByRole("button", { name: /Start the clock/u }));
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		fireEvent.click(screen.getByRole("button", { name: /Pause the clock/u }));
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(stat("Clock")).toContain("00:30");
		fireEvent.click(screen.getByRole("button", { name: /Carry on/u }));
		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(stat("Clock")).toContain("01:00");
	});

	it("resets the clock and the money with it", () => {
		vi.useFakeTimers();
		render(<MeetingCostMeter />);
		fireEvent.click(screen.getByRole("button", { name: /Start the clock/u }));
		act(() => {
			vi.advanceTimersByTime(120_000);
		});
		fireEvent.click(screen.getByRole("button", { name: "Reset" }));
		expect(stat("Clock")).toContain("00:00");
		expect(readout()).toContain("0");
	});
});
