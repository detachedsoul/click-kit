import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioTrimmer } from "@/features/audio-tools/audio-trimmer";

const mockBuffer = {
	duration: 2,
	getChannelData: () => new Float32Array([-1, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]),
	length: 8,
	numberOfChannels: 1,
	sampleRate: 4,
} as unknown as AudioBuffer;

const decodeAudioData = vi.fn(async () => mockBuffer);
const close = vi.fn(async () => undefined);

class MockAudioContext {
	decodeAudioData = decodeAudioData;
	close = close;
}

beforeEach(() => {
	decodeAudioData.mockClear();
	close.mockClear();
	vi.stubGlobal("AudioContext", MockAudioContext);
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audio-test");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const upload = async () => {
	const user = userEvent.setup();
	const { container } = render(<AudioTrimmer />);
	const file = new File([new Uint8Array([1, 2, 3, 4])], "voice.mp3", { type: "audio/mpeg" });
	await user.upload(screen.getByLabelText("Audio file"), file);
	await screen.findByRole("img", { name: "Audio waveform with selected trim region" });
	return { container, user };
};

describe("audio trimmer", () => {
	it("decodes a file and draws an accessible waveform", async () => {
		await upload();
		expect(decodeAudioData).toHaveBeenCalledOnce();
		expect(screen.getByText("voice.mp3")).toBeTruthy();
		expect(screen.getByText(/MP3 · Mono · 4 Hz/u)).toBeTruthy();
		expect(screen.getByLabelText("Start time · 0:00.00")).toBeTruthy();
		expect(screen.getByLabelText("End time · 0:02.00")).toBeTruthy();
		expect(screen.getByText(/Selected section: 0:02.00/u)).toBeTruthy();
	});

	it("lets the user set start and end precisely and exports a WAV download", async () => {
		const { user } = await upload();
		fireEvent.change(screen.getByLabelText(/Start time/u), { target: { value: "0.25" } });
		fireEvent.change(screen.getByLabelText(/End time/u), { target: { value: "1.25" } });
		await user.click(screen.getByRole("button", { name: /Export trimmed WAV/u }));

		const link = await screen.findByRole("link", { name: /Download WAV/u });
		expect(link.getAttribute("download")).toBe("voice_trimmed.wav");
		expect(link.getAttribute("href")).toBe("blob:audio-test");
		expect(screen.getByRole("status").textContent).toContain("Trimmed WAV ready");
	});

	it("plays the selection and can pause it", async () => {
		const { container, user } = await upload();
		const audio = container.querySelector("audio");
		expect(audio).toBeTruthy();
		await user.click(screen.getByRole("button", { name: /Preview selection/u }));
		fireEvent.loadedMetadata(audio as HTMLAudioElement);
		await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
		await user.click(screen.getByRole("button", { name: "Pause" }));
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
	});

	it("tells the user when the browser cannot decode the chosen file", async () => {
		decodeAudioData.mockRejectedValueOnce(new Error("unsupported codec"));
		const user = userEvent.setup();
		render(<AudioTrimmer />);
		await user.upload(screen.getByLabelText("Audio file"), new File(["bytes"], "voice.m4a", { type: "audio/mp4" }));
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("could not decode that file");
	});

	it("rejects a file that is not an audio format", async () => {
		const user = userEvent.setup({ applyAccept: false });
		render(<AudioTrimmer />);
		await user.upload(screen.getByLabelText("Audio file"), new File(["text"], "notes.txt", { type: "text/plain" }));
		expect(screen.getByRole("alert").textContent).toContain("Choose an MP3, WAV, M4A");
		expect(decodeAudioData).not.toHaveBeenCalled();
	});
});
