import { formatMediaTime } from "@/features/video-tools/video-extractor-utils";

/** FFmpeg.wasm keeps input and decoded frames in browser memory; cap files for a safer client-side run. */
export const MAX_TRIM_VIDEO_BYTES = 200 * 1024 * 1024;
export const MIN_TRIM_SECONDS = 0.05;
export const VIDEO_TRIM_ACCEPT = "video/*,.mp4,.m4v,.mov,.webm,.ogv,.avi,.mkv,.3gp,.mpeg,.mpg";

const VIDEO_EXTENSIONS = new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"]);

export const isTrimVideoFile = (file: Pick<File, "name" | "type">) =>
	file.type.startsWith("video/") || VIDEO_EXTENSIONS.has(file.name.split(".").at(-1)?.toLowerCase() ?? "");

export const validateTrimVideoFile = (file: Pick<File, "name" | "type" | "size">) => {
	if (!isTrimVideoFile(file)) throw new Error("Choose a video file such as MP4, MOV, or WebM.");
	if (file.size <= 0) throw new Error("That video file is empty.");
	if (file.size > MAX_TRIM_VIDEO_BYTES) throw new Error("Choose a video smaller than 200 MB. FFmpeg needs extra working memory while trimming.");
};

export type VideoTrimRange = { start: number; end: number };

/** Keep both handles inside the duration and at least a small non-empty range apart. */
export const clampVideoTrimRange = (duration: number, start: number, end: number): VideoTrimRange => {
	if (!Number.isFinite(duration) || duration <= 0) throw new Error("Video duration must be greater than zero.");
	const minimum = Math.min(MIN_TRIM_SECONDS, duration);
	const safeStart = Math.max(0, Math.min(duration - minimum, Number.isFinite(start) ? start : 0));
	const safeEnd = Math.max(safeStart + minimum, Math.min(duration, Number.isFinite(end) ? end : duration));
	return { start: safeStart, end: safeEnd };
};

export const videoTrimFileName = (name: string) => {
	const stem = name.replace(/\.[^.]+$/u, "").replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "video";
	return `${stem}-trimmed.mp4`;
};

export const formatTrimTime = (seconds: number) => formatMediaTime(seconds);
