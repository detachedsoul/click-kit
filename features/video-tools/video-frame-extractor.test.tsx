import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoFrameExtractor } from "@/features/video-tools/video-frame-extractor";

const drawImage = vi.fn();
const pauseMedia = vi.fn();

beforeEach(() => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video-frame-test");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
	vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => callback(new Blob(["image-data"], { type: type ?? "image/png" })));
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pauseMedia);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const loadVideo = async (duration = 12, startAt = 3.25) => {
	const user = userEvent.setup();
	render(<VideoFrameExtractor />);
	const file = new File([new Uint8Array([1, 2, 3])], "A day at the beach.mp4", { type: "video/mp4" });
	await user.upload(screen.getByLabelText("Video file"), file);
	const video = document.querySelector("video");
	expect(video).toBeTruthy();
	let playhead = startAt;
	Object.defineProperty(video, "duration", { configurable: true, value: duration });
	Object.defineProperty(video, "videoWidth", { configurable: true, value: 640 });
	Object.defineProperty(video, "videoHeight", { configurable: true, value: 360 });
	Object.defineProperty(video, "readyState", { configurable: true, value: 2 });
	Object.defineProperty(video, "currentTime", {
		configurable: true,
		get: () => playhead,
		set: (time: number) => {
			playhead = time;
			queueMicrotask(() => fireEvent.seeked(video as HTMLVideoElement));
		},
	});
	fireEvent.loadedMetadata(video as HTMLVideoElement);
	await screen.findByRole("slider", { name: "Scrub timeline" });
	return { user, video: video as HTMLVideoElement };
};

describe("video frame extractor", () => {
	it("shows a preview with its duration, dimensions, and scrubber", async () => {
		await loadVideo();
		expect(screen.getByText("A day at the beach.mp4")).toBeTruthy();
		expect(screen.getByText(/640 × 360 · 0:03.25 \/ 0:12.00/u)).toBeTruthy();
		expect(screen.getByRole("slider", { name: "Scrub timeline" })).toHaveProperty("value", "3.25");
		expect(screen.getByRole("button", { name: /Capture this frame/u })).toBeTruthy();
	});

	it("captures the current frame and downloads it using the chosen output format", async () => {
		const { user } = await loadVideo();
		await user.selectOptions(screen.getByLabelText("Still-image format"), "image/png");
		await user.click(screen.getByRole("button", { name: /Capture this frame/u }));
		expect(await screen.findByRole("heading", { name: "Extracted frames" })).toBeTruthy();
		expect(drawImage).toHaveBeenCalledOnce();
		const download = screen.getByRole("link", { name: /Download$/u });
		expect(download.getAttribute("download")).toBe("A-day-at-the-beach-frame-0001-at-0-03-25.png");
		expect(download.getAttribute("href")).toBe("blob:video-frame-test");
	});

	it("extracts interval frames and builds one ZIP for all of them", async () => {
		const { user } = await loadVideo(5, 0);
		await user.clear(screen.getByLabelText("Every (seconds)"));
		await user.type(screen.getByLabelText("Every (seconds)"), "2");
		await user.click(screen.getByRole("button", { name: /Extract frames/u }));
		await screen.findByText("3 frames extracted.");
		expect(screen.getAllByRole("link", { name: /Download$/u })).toHaveLength(3);
		expect(screen.getByText((_, element) => element?.textContent?.startsWith("3 of 60 frames kept") ?? false)).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Build ZIP" }));
		expect(await screen.findByRole("link", { name: /Download all frames/u })).toBeTruthy();
		expect(screen.getByRole("link", { name: /Download all frames/u }).getAttribute("download")).toBe("A-day-at-the-beach-frames.zip");
	});

	it("clears captured frames and explains when the canvas lacks a chosen format", async () => {
		const { user } = await loadVideo();
		await user.click(screen.getByRole("button", { name: /Capture this frame/u }));
		await screen.findByRole("heading", { name: "Extracted frames" });
		await user.click(screen.getByRole("button", { name: "Clear extracted frames" }));
		expect(screen.queryByRole("heading", { name: "Extracted frames" })).toBeNull();

		vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
		await user.selectOptions(screen.getByLabelText("Still-image format"), "image/webp");
		await user.click(screen.getByRole("button", { name: /Capture this frame/u }));
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("WEBP output is not supported");
	});

	it("rejects a non-video file", async () => {
		const user = userEvent.setup({ applyAccept: false });
		render(<VideoFrameExtractor />);
		await user.upload(screen.getByLabelText("Video file"), new File(["text"], "notes.txt", { type: "text/plain" }));
		expect(screen.getByRole("alert").textContent).toContain("Choose a video file");
	});
});
