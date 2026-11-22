import { describe, expect, it } from "vitest";
import { clampVideoTrimRange, formatTrimTime, MAX_TRIM_VIDEO_BYTES, validateTrimVideoFile, videoTrimFileName } from "@/features/video-tools/video-trimmer-utils";

describe("video trimmer utilities", () => {
	it("validates video names, empties, and memory-conscious size limits", () => {
		expect(() => validateTrimVideoFile({ name: "clip.mp4", type: "", size: 10 })).not.toThrow();
		expect(() => validateTrimVideoFile({ name: "notes.txt", type: "text/plain", size: 10 })).toThrow(/Choose a video/u);
		expect(() => validateTrimVideoFile({ name: "clip.mp4", type: "video/mp4", size: 0 })).toThrow(/empty/u);
		expect(() => validateTrimVideoFile({ name: "clip.mp4", type: "video/mp4", size: MAX_TRIM_VIDEO_BYTES + 1 })).toThrow(/200 MB/u);
	});

	it("keeps a non-empty selection inside the video duration", () => {
		expect(clampVideoTrimRange(12, 3, 8)).toEqual({ start: 3, end: 8 });
		expect(clampVideoTrimRange(12, 20, 30)).toEqual({ start: 11.95, end: 12 });
		expect(clampVideoTrimRange(12, -1, 0)).toEqual({ start: 0, end: 0.05 });
		expect(() => clampVideoTrimRange(0, 0, 1)).toThrow(/duration/u);
	});

	it("formats readable timestamps and safe MP4 names", () => {
		expect(formatTrimTime(3661.25)).toBe("1:01:01.25");
		expect(videoTrimFileName("My family video (final).mov")).toBe("My-family-video-final-trimmed.mp4");
		expect(videoTrimFileName(".mp4")).toBe("video-trimmed.mp4");
	});
});
