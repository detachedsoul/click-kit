import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioVisualizer } from "@/features/audio-tools/audio-visualizer";

const analyser = {
	fftSize: 2048,
	frequencyBinCount: 1024,
	smoothingTimeConstant: 0,
	getByteTimeDomainData: vi.fn((data: Uint8Array) => data.fill(128)),
	getByteFrequencyData: vi.fn((data: Uint8Array) => data.fill(32)),
	connect: vi.fn(),
	disconnect: vi.fn(),
};
const source = { connect: vi.fn(), disconnect: vi.fn() };
const graphCalls = { createAnalyser: vi.fn(), createMediaElementSource: vi.fn(), createMediaStreamDestination: vi.fn(), resume: vi.fn(), close: vi.fn() };

class MockTrack {
	stop = vi.fn();
	constructor(public kind: "audio" | "video") {}
}

class MockMediaStream {
	constructor(private readonly tracks: MockTrack[] = []) {}
	getTracks() { return this.tracks; }
	getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
	getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
}

class MockAudioContext {
	state: AudioContextState = "suspended";
	destination = {} as AudioDestinationNode;
	createAnalyser = graphCalls.createAnalyser;
	createMediaElementSource = graphCalls.createMediaElementSource;
	createMediaStreamDestination = graphCalls.createMediaStreamDestination;
	resume = graphCalls.resume;
	close = graphCalls.close;
}

class MockMediaRecorder {
	static isTypeSupported = vi.fn(() => true);
	static latest: MockMediaRecorder | null = null;
	state: RecordingState = "inactive";
	mimeType: string;
	ondataavailable: ((event: BlobEvent) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	start = vi.fn(() => { this.state = "recording"; });
	stop = vi.fn(() => {
		this.state = "inactive";
		this.ondataavailable?.({ data: new Blob(["recorded-video"], { type: this.mimeType }) } as BlobEvent);
		this.onstop?.();
	});
	constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
		this.mimeType = options?.mimeType ?? "video/webm";
		MockMediaRecorder.latest = this;
	}
}

let canvasContext: Record<string, unknown>;

beforeEach(() => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-visualizer-test");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
	Object.assign(graphCalls, {
		createAnalyser: vi.fn(() => analyser),
		createMediaElementSource: vi.fn(() => source),
		createMediaStreamDestination: vi.fn(() => ({ stream: new MockMediaStream([new MockTrack("audio")]) })),
		resume: vi.fn(async () => undefined),
		close: vi.fn(async () => undefined),
	});
	analyser.getByteTimeDomainData.mockClear();
	analyser.getByteFrequencyData.mockClear();
	analyser.connect.mockClear();
	analyser.disconnect.mockClear();
	source.connect.mockClear();
	source.disconnect.mockClear();
	MockMediaRecorder.latest = null;
	MockMediaRecorder.isTypeSupported.mockReset().mockReturnValue(true);
	vi.stubGlobal("AudioContext", MockAudioContext);
	vi.stubGlobal("MediaRecorder", MockMediaRecorder);
	vi.stubGlobal("MediaStream", MockMediaStream);
	Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { configurable: true, value: vi.fn(() => new MockMediaStream([new MockTrack("video")])) });
	canvasContext = {
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		arc: vi.fn(),
	};
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
	Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: vi.fn(() => 1) });
	Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: vi.fn() });
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const uploadAudio = async () => {
	const user = userEvent.setup();
	render(<AudioVisualizer />);
	const file = new File([new Uint8Array([1, 2, 3, 4])], "night-drive.mp3", { type: "audio/mpeg" });
	await user.upload(screen.getByLabelText("Audio file"), file);
	const audio = document.querySelector("audio") as HTMLAudioElement;
	Object.defineProperty(audio, "duration", { configurable: true, value: 12 });
	fireEvent.loadedMetadata(audio);
	await screen.findByRole("img", { name: "Waveform preview" });
	return { user, audio };
};

describe("audio visualizer", () => {
	it("loads audio and exposes playback, visual styles, colours, backgrounds, and resolution", async () => {
		const { user } = await uploadAudio();
		expect(screen.getByText("night-drive.mp3")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Play audio" })).toBeTruthy();
		expect(screen.getByRole("slider", { name: "Audio position" })).toHaveProperty("max", "12");
		await user.selectOptions(screen.getByLabelText("Style"), "bars");
		expect(await screen.findByRole("img", { name: "Frequency bars preview" })).toBeTruthy();
		await user.selectOptions(screen.getByLabelText("Style"), "circle");
		expect(await screen.findByRole("img", { name: "Circular visualizer preview" })).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Visualizer colour"), { target: { value: "#ffcc00" } });
		expect(screen.getByLabelText("Visualizer colour")).toHaveProperty("value", "#ffcc00");
		await user.selectOptions(screen.getByLabelText("Background"), "gradient");
		expect(screen.getByLabelText("Gradient start")).toBeTruthy();
		expect(screen.getByLabelText("Gradient end")).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Gradient start"), { target: { value: "#124578" } });
		expect(screen.getByLabelText("Gradient start")).toHaveProperty("value", "#124578");
		await user.selectOptions(screen.getByLabelText("Recording size"), "720p");
		expect(document.querySelector("canvas")).toHaveProperty("width", 1280);
	});

	it("connects playback to the live analyser and resumes the audio context", async () => {
		const { user, audio } = await uploadAudio();
		await user.click(screen.getByRole("button", { name: "Play audio" }));
		await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
		expect(graphCalls.createAnalyser).toHaveBeenCalledOnce();
		expect(graphCalls.createMediaElementSource).toHaveBeenCalledWith(audio);
		expect(graphCalls.resume).toHaveBeenCalledOnce();
		const frame = vi.mocked(window.requestAnimationFrame).mock.calls.at(-1)?.[0];
		expect(frame).toBeTruthy();
		frame?.(0);
		expect(analyser.getByteTimeDomainData).toHaveBeenCalled();
		expect(analyser.getByteFrequencyData).toHaveBeenCalled();
	});

	it("records the selected visualizer with audio and offers the video download", async () => {
		const { user } = await uploadAudio();
		await user.click(screen.getByRole("button", { name: "Record video" }));
		await waitFor(() => expect(screen.getByRole("button", { name: /Stop and save/u })).toBeTruthy());
		expect(HTMLCanvasElement.prototype.captureStream).toHaveBeenCalledWith(30);
		expect(graphCalls.createMediaStreamDestination).toHaveBeenCalledOnce();
		await user.click(screen.getByRole("button", { name: /Stop and save/u }));
		const download = await screen.findByRole("link", { name: "Download WEBM" });
		expect(download.getAttribute("download")).toBe("night-drive-visualizer.webm");
		expect(download.getAttribute("href")).toBe("blob:audio-visualizer-test");
		expect(await screen.findByLabelText("Recorded audio visualizer")).toBeTruthy();
	});

	it("rejects unsupported audio files", async () => {
		const user = userEvent.setup({ applyAccept: false });
		render(<AudioVisualizer />);
		await user.upload(screen.getByLabelText("Audio file"), new File(["text"], "notes.txt", { type: "text/plain" }));
		expect(screen.getByRole("alert").textContent).toContain("Choose an MP3, WAV, M4A");
	});
});
