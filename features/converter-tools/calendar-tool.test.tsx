import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarConverterTool } from "@/features/converter-tools/calendar-tool";

afterEach(cleanup);

const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;

describe("calendar converter", () => {
	it("starts with the sample calendar as rows", () => {
		render(<CalendarConverterTool />);
		expect(output().split("\n")[0]).toBe("Title,Start,End,All day,Location,Description,Repeats");
		expect(output()).toContain("Rent due,2026-11-20 10:00,2026-11-20 11:00,no,Bank transfer");
		expect(screen.getByText("Events").parentElement?.textContent).toContain("2");
	});

	it("converts a pasted calendar after loading", async () => {
		const user = userEvent.setup();
		render(<CalendarConverterTool />);
		const input = screen.getByLabelText("Calendar (.ics)");
		await user.clear(input);
		await user.click(input);
		await user.paste("BEGIN:VEVENT\nDTSTART:20270101T080000Z\nSUMMARY:New year swim\nEND:VEVENT");
		expect(output()).toContain("New year swim");
		expect(screen.getByText("Events").parentElement?.textContent).toContain("1");
	});

	it("switches to csv input and writes a calendar", async () => {
		const user = userEvent.setup();
		render(<CalendarConverterTool />);
		await user.click(screen.getByRole("button", { name: "CSV to calendar" }));
		expect(output()).toContain("BEGIN:VCALENDAR");
		expect(output()).toContain("DTSTART:20261120T100000Z");
		expect(await screen.findByRole("link", { name: "Download events.ics" })).toBeTruthy();
	});

	it("keeps typed text when the direction changes", async () => {
		const user = userEvent.setup();
		render(<CalendarConverterTool />);
		const input = screen.getByLabelText("Calendar (.ics)");
		await user.clear(input);
		await user.click(input);
		await user.paste("BEGIN:VEVENT\nSUMMARY:Only mine\nEND:VEVENT");
		await user.click(screen.getByRole("button", { name: "CSV to calendar" }));
		expect((screen.getByLabelText("CSV") as HTMLTextAreaElement).value).toContain("Only mine");
		expect((await screen.findByRole("alert")).textContent).toMatch(/No rows found/u);
	});

	it("explains a calendar with no events", async () => {
		const user = userEvent.setup();
		render(<CalendarConverterTool />);
		const input = screen.getByLabelText("Calendar (.ics)");
		await user.clear(input);
		await user.click(input);
		await user.paste("BEGIN:VCALENDAR\nEND:VCALENDAR");
		expect((await screen.findByRole("alert")).textContent).toMatch(/No events found/u);
	});
});
