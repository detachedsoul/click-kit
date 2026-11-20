import { describe, expect, it } from "vitest";
import { convertSubtitles, detectFormat, formatTime, parseCues, parseShift, toPlainText, toSrt, toVtt } from "@/features/converter-tools/subtitle";

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello there

2
00:00:05,500 --> 00:00:09,250
Second line
with a wrap
`;

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000 align:start
Hello there

00:00:05.500 --> 00:00:09.250
Second line
with a wrap
`;

describe("subtitle parsing", () => {
	it("reads srt cues with their times and wrapped text", () => {
		const cues = parseCues(SRT);
		expect(cues).toHaveLength(2);
		expect(cues[0]).toEqual({ start: 1, end: 4, text: "Hello there" });
		expect(cues[1].start).toBeCloseTo(5.5);
		expect(cues[1].text).toBe("Second line\nwith a wrap");
	});

	it("reads webvtt, ignoring the header and cue settings", () => {
		const cues = parseCues(VTT);
		expect(cues).toHaveLength(2);
		expect(cues[0]).toEqual({ start: 1, end: 4, text: "Hello there" });
	});

	it("copes with windows line endings and cue ids", () => {
		const cues = parseCues("intro\r\n00:00:00,500 --> 00:00:02,000\r\nFirst\r\n");
		expect(cues).toEqual([{ start: 0.5, end: 2, text: "First" }]);
	});

	it("ignores files with no timings", () => {
		expect(parseCues("just some notes")).toEqual([]);
	});

	it("knows which format a file is", () => {
		expect(detectFormat(VTT)).toBe("vtt");
		expect(detectFormat(SRT)).toBe("srt");
		expect(detectFormat("\uFEFFWEBVTT\n")).toBe("vtt");
	});
});

describe("subtitle writing", () => {
	it("writes srt with numbered cues and commas", () => {
		expect(toSrt(parseCues(SRT))).toBe(SRT);
	});

	it("writes webvtt with a header and dots", () => {
		expect(toVtt(parseCues(SRT))).toBe(VTT.replace(" align:start", ""));
	});

	it("writes a plain transcript", () => {
		expect(toPlainText(parseCues(SRT))).toBe("Hello there\nSecond line with a wrap");
	});

	it("pads times properly", () => {
		expect(formatTime(0)).toBe("00:00:00,000");
		expect(formatTime(3725.5)).toBe("01:02:05,500");
		expect(formatTime(59.999)).toBe("00:00:59,999");
	});
});

describe("subtitle conversion", () => {
	it("converts either way through the same helper", () => {
		expect(convertSubtitles(SRT, "vtt").startsWith("WEBVTT")).toBe(true);
		expect(convertSubtitles(VTT, "srt")).toContain("00:00:05,500 --> 00:00:09,250");
		expect(convertSubtitles(SRT, "text")).toBe("Hello there\nSecond line with a wrap\n");
	});

	it("shifts times and never goes below zero", () => {
		const shifted = convertSubtitles(SRT, "srt", { shift: 2.5 });
		expect(shifted).toContain("00:00:03,500 --> 00:00:06,500");
		const back = convertSubtitles(SRT, "srt", { shift: -10 });
		expect(back).toContain("00:00:00,000 --> 00:00:00,000");
	});

	it("reads a shift typed as seconds or as a clock", () => {
		expect(parseShift("2.5")).toBe(2.5);
		expect(parseShift("-4")).toBe(-4);
		expect(parseShift("")).toBe(0);
		expect(parseShift("01:30")).toBe(5400);
		expect(parseShift("00:00:03")).toBe(3);
		expect(parseShift("later")).toBeNull();
	});
});
