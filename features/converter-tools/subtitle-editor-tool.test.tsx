import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleEditorTool } from "@/features/converter-tools/subtitle-editor-tool";

const SRT = `1\n00:00:01,000 --> 00:00:05,000\nWelcome to the subtitle editor\n\n2\n00:00:06,000 --> 00:00:08,000\nThanks for watching\n`;

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:subtitle-test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});
afterEach(cleanup);

const importSrt = () => {
	const file = new File([SRT], "film.srt", { type: "application/x-subrip" });
	fireEvent.change(screen.getByLabelText("Subtitle file"), { target: { files: [file] } });
};

describe("subtitle editor", () => {
	it("imports SRT and offers both export formats", async () => {
		render(<SubtitleEditorTool />);
		importSrt();
		expect(await screen.findByText("2 subtitle entries loaded.")).toBeTruthy();
		expect((screen.getByLabelText("Start time for entry 1") as HTMLInputElement).value).toBe("00:00:01,000");
		expect((await screen.findByRole("link", { name: "Download SRT" })).getAttribute("download")).toBe("film.srt");
		expect(screen.getByRole("link", { name: "Download WebVTT" }).getAttribute("download")).toBe("film.vtt");
	});

	it("edits text, replaces terms, and applies a global timing shift", async () => {
		const user = userEvent.setup();
		render(<SubtitleEditorTool />);
		importSrt();
		const first = (await screen.findAllByLabelText("Subtitle text"))[0];
		await user.clear(first);
		await user.type(first, "Welcome to the show");
		await user.type(screen.getByLabelText("Find text"), "Welcome");
		await user.type(screen.getByLabelText("Replace with"), "Hello");
		await user.click(screen.getByRole("button", { name: "Replace all" }));
		expect((screen.getAllByLabelText("Subtitle text")[0] as HTMLTextAreaElement).value).toBe("Hello to the show");
		await user.type(screen.getByLabelText("Shift every entry"), "1.5");
		await user.click(screen.getByRole("button", { name: "Apply shift" }));
		expect((screen.getByLabelText("Start time for entry 1") as HTMLInputElement).value).toBe("00:00:02,500");
	});

	it("splits a cue and merges it back into its next entry", async () => {
		const user = userEvent.setup();
		render(<SubtitleEditorTool />);
		importSrt();
		await screen.findByText("2 subtitle entries loaded.");
		await user.click(screen.getAllByRole("button", { name: "Split at midpoint" })[0]);
		expect(screen.getAllByLabelText("Subtitle text")).toHaveLength(3);
		await user.click(screen.getAllByRole("button", { name: "Merge with next" })[0]);
		expect(screen.getAllByLabelText("Subtitle text")).toHaveLength(2);
	});

	it("adds a new entry and rejects a non-increasing time range", async () => {
		const user = userEvent.setup();
		render(<SubtitleEditorTool />);
		await user.click(screen.getByRole("button", { name: "Add first entry" }));
		expect(screen.getByLabelText("Subtitle text")).toHaveProperty("value", "New subtitle");
		const end = screen.getByLabelText("End time for entry 1");
		await user.clear(end);
		await user.type(end, "00:00:00,000");
		await user.tab();
		expect((await screen.findByRole("alert")).textContent).toMatch(/after the start time/u);
		expect((screen.getByLabelText("End time for entry 1") as HTMLInputElement).value).toBe("00:00:00,000");
	});

	it("previews the active cue over a selected video", async () => {
		render(<SubtitleEditorTool />);
		importSrt();
		await screen.findByText("2 subtitle entries loaded.");
		const videoFile = new File(["video"], "film.mp4", { type: "video/mp4" });
		fireEvent.change(screen.getByLabelText("Video for preview"), { target: { files: [videoFile] } });
		const video = screen.getByLabelText("Video with subtitle preview");
		Object.defineProperty(video, "currentTime", { configurable: true, value: 2 });
		fireEvent.timeUpdate(video);
		expect(document.querySelector('[aria-live="off"]')?.textContent).toBe("Welcome to the subtitle editor");
	});
});
