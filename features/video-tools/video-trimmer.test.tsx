import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoTrimmer } from "@/features/video-tools/video-trimmer";

const engine = vi.hoisted(() => ({
	writeFile: vi.fn(),
	exec: vi.fn(),
	readFile: vi.fn(),
	deleteFile: vi.fn(),
}));

beforeEach(() => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video-trim-test");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
	vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
	Object.defineProperty(window, "FFmpegWASM", { configurable: true, value: { FFmpeg: class {
		loaded = false;
		on = vi.fn();
		load = vi.fn(async () => { this.loaded = true; });
		writeFile = engine.writeFile;
		exec = engine.exec;
		readFile = engine.readFile;
		deleteFile = engine.deleteFile;
		terminate = vi.fn();
	} } });
	engine.writeFile.mockReset().mockResolvedValue(undefined);
	engine.exec.mockReset().mockResolvedValue(0);
	engine.readFile.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]));
	engine.deleteFile.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const loadVideo = async () => {
	const user = userEvent.setup();
	render(<VideoTrimmer />);
	const file = new File([new Uint8Array([1, 2, 3])], "My video.mp4", { type: "video/mp4" });
	await user.upload(screen.getByLabelText("Video file"), file);
	const video = document.querySelector("video") as HTMLVideoElement;
	Object.defineProperty(video, "duration", { configurable: true, value: 10 });
	Object.defineProperty(video, "readyState", { configurable: true, value: 2 });
	let playhead = 0;
	Object.defineProperty(video, "currentTime", { configurable: true, get: () => playhead, set: (value: number) => { playhead = value; } });
	fireEvent.loadedMetadata(video);
	return { user, video };
};

describe("video trimmer", () => {
	it("shows preview and selection controls, updates start and end points", async () => {
		const { user } = await loadVideo();
		expect(screen.getByRole("slider", { name: "Scrub video" })).toBeTruthy();
		const start = screen.getByRole("slider", { name: /Selection start/u });
		const end = screen.getByRole("slider", { name: /Selection end/u });
		await user.clear(screen.getByLabelText(/Start time/u));
		fireEvent.change(screen.getByLabelText(/Start time/u), { target: { value: "2.25" } });
		fireEvent.change(screen.getByLabelText(/End time/u), { target: { value: "8" } });
		expect(start).toHaveProperty("value", "2.25");
		expect(end).toHaveProperty("value", "8");
		expect(screen.getByText(/Selected clip: 0:05.75/u)).toBeTruthy();
	});

	it("trims the selected time range in the FFmpeg worker and provides an MP4 download", async () => {
		const { user } = await loadVideo();
		fireEvent.change(screen.getByLabelText(/Selection start/u), { target: { value: "2" } });
		fireEvent.change(screen.getByLabelText(/Selection end/u), { target: { value: "7" } });
		await user.click(screen.getByRole("button", { name: "Trim video" }));
		const download = await screen.findByRole("link", { name: /Download MP4/u });
		expect(download.getAttribute("download")).toBe("My-video-trimmed.mp4");
		expect(download.getAttribute("href")).toBe("blob:video-trim-test");
		expect(engine.exec).toHaveBeenCalledWith(expect.arrayContaining(["-ss", "2.000", "-t", "5.000", "-c:v", "libx264", "-c:a", "aac"]));
		expect(engine.deleteFile).toHaveBeenCalledTimes(2);
	});

	it("rejects non-video files", async () => {
		const user = userEvent.setup({ applyAccept: false });
		render(<VideoTrimmer />);
		await user.upload(screen.getByLabelText("Video file"), new File(["text"], "notes.txt", { type: "text/plain" }));
		expect(screen.getByRole("alert").textContent).toContain("Choose a video file");
	});
});
