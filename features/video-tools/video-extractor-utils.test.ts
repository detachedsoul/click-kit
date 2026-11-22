import { describe, expect, it } from "vitest";
import {
	frameExtension,
	frameFileName,
	frameTimes,
	formatMediaTime,
	isVideoFile,
	MAX_FRAME_COUNT,
	MAX_VIDEO_BYTES,
	validateVideoFile,
} from "@/features/video-tools/video-extractor-utils";

describe("video input", () => {
	it("recognises browser-common video extensions and MIME types", () => {
		expect(isVideoFile({ name: "clip.MOV", type: "" })).toBe(true);
		expect(isVideoFile({ name: "capture.bin", type: "video/webm" })).toBe(true);
		expect(isVideoFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
	});

	it("accepts supported video files and rejects empty, unknown, and oversized ones", () => {
		expect(() => validateVideoFile({ name: "clip.mp4", type: "video/mp4", size: 10 })).not.toThrow();
		expect(() => validateVideoFile({ name: "empty.webm", type: "video/webm", size: 0 })).toThrow(/empty/u);
		expect(() => validateVideoFile({ name: "notes.txt", type: "text/plain", size: 10 })).toThrow(/Choose a video/u);
		expect(() => validateVideoFile({ name: "huge.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 })).toThrow(/250 MB/u);
	});
});

describe("frame times and names", () => {
	it("formats video time with hours and hundredths", () => {
		expect(formatMediaTime(0)).toBe("0:00.00");
		expect(formatMediaTime(65.37)).toBe("1:05.37");
		expect(formatMediaTime(3661.2)).toBe("1:01:01.20");
		expect(formatMediaTime(Number.NaN)).toBe("0:00.00");
	});

	it("starts at zero and captures each interval before the end boundary", () => {
		expect(frameTimes(10, 3)).toEqual([0, 3, 6, 9]);
		expect(frameTimes(10, 5)).toEqual([0, 5]);
		expect(frameTimes(2.5, 5)).toEqual([0]);
	});

	it("rejects an interval that would exceed the frame cap", () => {
		expect(() => frameTimes(120, 1)).toThrow(`to ${MAX_FRAME_COUNT} frames or fewer`);
		expect(() => frameTimes(10, 0)).toThrow(/at least 0.1 seconds/u);
		expect(() => frameTimes(Number.POSITIVE_INFINITY, 1)).toThrow(/usable duration/u);
	});

	it("names files with safe source text, a stable sequence, a time, and the chosen extension", () => {
		expect(frameExtension("image/jpeg")).toBe("jpg");
		expect(frameExtension("image/webp")).toBe("webp");
		expect(frameFileName("A day at the beach!.mp4", 4, 12.5, "image/png")).toBe("A-day-at-the-beach-frame-0004-at-0-12-50.png");
		expect(frameFileName("...mov", 1, 0, "image/jpeg")).toBe("video-frame-0001-at-0-00-00.jpg");
	});
});
