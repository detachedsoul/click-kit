import { describe, expect, it } from "vitest";
import {
	audioFileType,
	clampTrimRange,
	encodeTrimmedWav,
	formatAudioTime,
	MAX_AUDIO_BYTES,
	PEAK_COUNT,
	validateAudioFile,
	waveformPeaks,
} from "@/features/audio-tools/audio-trimmer-utils";

const fakeBuffer = (channels: number[][], sampleRate = 4) => ({
	duration: channels[0].length / sampleRate,
	getChannelData: (channel: number) => new Float32Array(channels[channel]),
	length: channels[0].length,
	numberOfChannels: channels.length,
	sampleRate,
}) as unknown as AudioBuffer;

describe("audio file input", () => {
	it("recognises common audio extensions even when the browser gives no MIME type", () => {
		expect(audioFileType({ name: "voice.M4A", type: "" })).toEqual({ extension: "m4a", label: "M4A" });
		expect(audioFileType({ name: "song.mp3", type: "audio/mpeg" })?.label).toBe("MP3");
		expect(audioFileType({ name: "mix.opus", type: "audio/ogg" })?.label).toBe("Opus");
		expect(audioFileType({ name: "notes.txt", type: "text/plain" })).toBeNull();
	});

	it("allows supported formats and rejects empty, unknown, and oversized files", () => {
		expect(() => validateAudioFile({ name: "voice.wav", type: "audio/wav", size: 10 })).not.toThrow();
		expect(() => validateAudioFile({ name: "voice.m4a", type: "audio/mp4", size: 10 })).not.toThrow();
		expect(() => validateAudioFile({ name: "notes.txt", type: "text/plain", size: 10 })).toThrow(/Choose an MP3/u);
		expect(() => validateAudioFile({ name: "empty.mp3", type: "audio/mpeg", size: 0 })).toThrow(/empty/u);
		expect(() => validateAudioFile({ name: "huge.wav", type: "audio/wav", size: MAX_AUDIO_BYTES + 1 })).toThrow(/100 MB/u);
	});
});

describe("trim positions and display", () => {
	it("keeps a useful selection within the decoded duration", () => {
		expect(clampTrimRange(20, 2, 9)).toEqual({ start: 2, end: 9 });
		expect(clampTrimRange(20, -5, 50)).toEqual({ start: 0, end: 20 });
		expect(clampTrimRange(20, 30, 1)).toEqual({ start: 19.99, end: 20 });
	});

	it("does not allow a zero-length selection", () => {
		expect(clampTrimRange(10, 4, 4)).toEqual({ start: 4, end: 4.01 });
		expect(() => clampTrimRange(0, 0, 0)).toThrow(/greater than zero/u);
	});

	it("prints precise time and a readable duration", () => {
		expect(formatAudioTime(0)).toBe("0:00.00");
		expect(formatAudioTime(65.34)).toBe("1:05.34");
		expect(formatAudioTime(3600)).toBe("60:00.00");
		expect(formatAudioTime(Number.NaN)).toBe("0:00.00");
	});
});

describe("waveform reduction", () => {
	it("keeps the loudest sample across every channel in each bin", () => {
		const peaks = waveformPeaks([new Float32Array([-0.2, 0.8, 0.1, -0.4]), new Float32Array([0.1, 0.2, -0.9, 0.3])], 2);
		expect(peaks[0]).toBeCloseTo(0.8);
		expect(peaks[1]).toBeCloseTo(0.9);
	});

	it("returns a predictable empty waveform", () => {
		expect(waveformPeaks([], 3)).toEqual([]);
		expect(waveformPeaks([new Float32Array()], 3)).toEqual([0, 0, 0]);
		expect(waveformPeaks([new Float32Array([0.5])])).toHaveLength(PEAK_COUNT);
	});

	it("bounds waveform peaks to the range that PCM audio can represent", () => {
		expect(waveformPeaks([new Float32Array([4])], 1)).toEqual([1]);
	});
});

describe("WAV export", () => {
	it("writes a valid RIFF PCM header and only the selected frames", async () => {
		const blob = encodeTrimmedWav(fakeBuffer([[-1, -0.5, 0.5, 1]]), 0.25, 0.75);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		const view = new DataView(bytes.buffer);
		const text = (offset: number, count: number) => String.fromCharCode(...bytes.slice(offset, offset + count));
		expect(blob.type).toBe("audio/wav");
		expect(blob.size).toBe(48);
		expect(text(0, 4)).toBe("RIFF");
		expect(text(8, 4)).toBe("WAVE");
		expect(text(12, 4)).toBe("fmt ");
		expect(view.getUint16(20, true)).toBe(1);
		expect(view.getUint16(22, true)).toBe(1);
		expect(view.getUint32(24, true)).toBe(4);
		expect(view.getUint16(34, true)).toBe(16);
		expect(text(36, 4)).toBe("data");
		expect(view.getUint32(40, true)).toBe(4);
		expect(view.getInt16(44, true)).toBe(-16384);
		expect(view.getInt16(46, true)).toBe(16383);
	});

	it("interleaves stereo channels in each exported frame", async () => {
		const blob = encodeTrimmedWav(fakeBuffer([[-1, 0], [1, -0.5]]), 0, 1);
		const view = new DataView(await blob.arrayBuffer());
		expect(view.getUint16(22, true)).toBe(2);
		expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true)]).toEqual([-32768, 32767, 0, -16384]);
	});

	it("expands identical trim points to the smallest non-empty WAV selection", () => {
		expect(encodeTrimmedWav(fakeBuffer([[0, 0, 0, 0]]), 0.5, 0.5).size).toBe(46);
	});
});
