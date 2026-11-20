import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SubtitleConverterTool } from "@/features/converter-tools/subtitle-tool";

afterEach(cleanup);

const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;

describe("subtitle converter tool", () => {
	it("starts as webvtt with the sample cues", () => {
		render(<SubtitleConverterTool />);
		expect(output().startsWith("WEBVTT")).toBe(true);
		expect(output()).toContain("00:00:01.000 --> 00:00:04.000");
		expect(screen.getByText("Cues").parentElement?.textContent).toContain("2");
	});

	it("switches to srt after loading", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		await user.click(screen.getByRole("button", { name: "SRT" }));
		expect(output()).toContain("1\n00:00:01,000 --> 00:00:04,000");
		expect(output()).not.toContain("WEBVTT");
	});

	it("converts pasted webvtt back to srt", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		const input = screen.getByLabelText("Subtitles");
		await user.clear(input);
		await user.click(input);
		await user.paste("WEBVTT\n\n00:00:02.000 --> 00:00:03.500\nPast tense\n");
		await user.click(screen.getByRole("button", { name: "SRT" }));
		expect(output()).toContain("00:00:02,000 --> 00:00:03,500");
		expect(output()).toContain("1\n");
	});

	it("shifts every cue by the seconds given", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		await user.type(screen.getByLabelText("Shift the timing"), "2.5");
		expect(output()).toContain("00:00:03.500 --> 00:00:06.500");
		expect(screen.getByText("Shift").parentElement?.textContent).toContain("+2.5s");
	});

	it("explains a shift it cannot read", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		await user.type(screen.getByLabelText("Shift the timing"), "soon");
		expect((await screen.findByRole("alert")).textContent).toMatch(/seconds \(2\.5\)/u);
	});

	it("writes a transcript", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(output()).toBe("Welcome back to the show.\nToday we are talking about subtitles.\n");
		expect(await screen.findByRole("link", { name: "Download converted.txt" })).toBeTruthy();
	});

	it("says when there are no timings at all", async () => {
		const user = userEvent.setup();
		render(<SubtitleConverterTool />);
		const input = screen.getByLabelText("Subtitles");
		await user.clear(input);
		await user.click(input);
		await user.paste("just notes");
		expect((await screen.findByRole("alert")).textContent).toMatch(/No timings found/u);
	});
});
