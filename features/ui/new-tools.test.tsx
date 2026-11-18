import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MeetingPlanner } from "@/features/productivity-tools/meeting-planner";
import { ShadesTool } from "@/features/developer-tools/shades-tool";
import { UserAgentTool } from "@/features/developer-tools/user-agent-tool";
import { ChunkTool } from "@/features/text-tools/chunk-tool";
import { TeamTool } from "@/features/productivity-tools/team-tool";
import { PaceCalculator } from "@/features/calculators/pace-calculator";

afterEach(cleanup);

describe("new browser tools", () => {
	it("builds a time zone grid with the default three cities", async () => {
		const user = userEvent.setup();
		render(<MeetingPlanner />);
		await user.clear(screen.getByLabelText("Date"));
		await user.type(screen.getByLabelText("Date"), "2026-01-15");
		expect(screen.getByLabelText("Your time zone")).toHaveProperty("value", "Europe/London");
		expect(screen.getByLabelText("London")).toHaveProperty("checked", true);
		expect(screen.getByLabelText("New York")).toHaveProperty("checked", true);
		expect(screen.getByLabelText("Nairobi")).toHaveProperty("checked", false);
		expect(document.body.textContent).toMatch(/works for everyone|No hour works/u);
		expect(document.body.textContent).toContain("UTC−5");
		expect(document.body.textContent).toContain("Tokyo");
	});

	it("drops zones and re-counts the overlap", async () => {
		const user = userEvent.setup();
		render(<MeetingPlanner />);
		await user.click(screen.getByLabelText("Tokyo"));
		expect(screen.getByLabelText("Tokyo")).toHaveProperty("checked", false);
		expect(document.body.textContent).toContain("Zones");
		await user.selectOptions(screen.getByLabelText("Hour format"), "12");
		expect(document.body.textContent).toContain("9am");
	});

	it("builds a colour ramp and switches output syntax", async () => {
		const user = userEvent.setup();
		render(<ShadesTool />);
		expect(document.body.textContent).toContain("#3f6b4a");
		const css = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(css).toContain("--colour-500: #3f6b4a;");
		await user.click(screen.getByRole("button", { name: "Tailwind theme" }));
		const tailwind = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(tailwind).toContain('500: "#3f6b4a",');
		await user.clear(screen.getByLabelText("Base colour (hex)"));
		await user.type(screen.getByLabelText("Base colour (hex)"), "#zz");
		expect(screen.getByText(/"#zz" is not a 3 or 6 digit hex colour/u)).toBeTruthy();
	});

	it("parses the default user agent example", () => {
		render(<UserAgentTool />);
		expect(document.body.textContent).toContain("Chrome 131.0.0.0");
		expect(document.body.textContent).toContain("Blink");
		expect(document.body.textContent).toContain("Windows 10/11");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"browser": "Chrome"');
	});

	it("switches a user agent example to a crawler", async () => {
		const user = userEvent.setup();
		render(<UserAgentTool />);
		await user.click(screen.getByRole("button", { name: "Googlebot" }));
		expect(document.body.textContent).toContain("Automated client");
		expect(document.body.textContent).toContain("looks like a crawler");
	});

	it("splits text into numbered chunks that respect the limit", async () => {
		const user = userEvent.setup();
		render(<ChunkTool />);
		await user.type(screen.getByLabelText("Text to split"), "one two three four five six");
		await user.clear(screen.getByLabelText("Characters per piece"));
		await user.type(screen.getByLabelText("Characters per piece"), "9");
		expect(document.body.textContent).toContain("one two");
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output.startsWith("1/")).toBe(true);
		expect(output).toContain("three");
	});

	it("draws balanced teams from pasted names", async () => {
		const user = userEvent.setup();
		render(<TeamTool />);
		const names = screen.getByLabelText("Names");
		await user.type(names, "Ada\nGrace\nAlan\nLinus\nMargaret");
		await user.click(screen.getByRole("button", { name: "Draw teams" }));
		expect(document.body.textContent).toContain("Team 1");
		expect(document.body.textContent).toContain("Team 2");
		expect(document.body.textContent).toContain("People");
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain("Team 1 (3)");
		expect(output).toContain("Team 2 (2)");
	});

	it("solves a 10K finish time from pace", async () => {
		const user = userEvent.setup();
		render(<PaceCalculator />);
		expect(document.body.textContent).toContain("5:00 /km");
		await user.click(screen.getByRole("button", { name: "Finish time" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("Time: 50:00");
		expect(document.body.textContent).toContain("12.00");
	});

	it("explains an unreadable duration", async () => {
		const user = userEvent.setup();
		render(<PaceCalculator />);
		await user.clear(screen.getByLabelText("Time (h:mm:ss)"));
		await user.type(screen.getByLabelText("Time (h:mm:ss)"), "abc");
		expect(screen.getByText(/positive number of seconds/u)).toBeTruthy();
	});
});
