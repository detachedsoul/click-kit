export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
export const MAX_FRAME_COUNT = 60;
export const MIN_FRAME_INTERVAL = 0.1;
export const VIDEO_ACCEPT = "video/*,.mp4,.m4v,.mov,.webm,.ogv,.avi,.mkv,.3gp,.mpeg,.mpg";
export const FRAME_FORMATS = [
	{ id: "image/jpeg", label: "JPEG" },
	{ id: "image/png", label: "PNG" },
	{ id: "image/webp", label: "WebP" },
] as const;
export type FrameFormat = (typeof FRAME_FORMATS)[number]["id"];

const VIDEO_EXTENSIONS = new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm"]);

export const isVideoFile = (file: Pick<File, "name" | "type">) => {
	const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
	return file.type.startsWith("video/") || VIDEO_EXTENSIONS.has(extension);
};

export const validateVideoFile = (file: Pick<File, "name" | "type" | "size">) => {
	if (!isVideoFile(file)) throw new Error("Choose a video file such as MP4, MOV, or WebM.");
	if (file.size <= 0) throw new Error("That video file is empty.");
	if (file.size > MAX_VIDEO_BYTES) throw new Error("Choose a video smaller than 250 MB so the browser can preview it safely.");
};

export const formatMediaTime = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	const clock = `${hours ? `${hours}:` : ""}${String(minutes).padStart(hours ? 2 : 1, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
	return clock;
};

/** Times at the start of each interval, from zero, without seeking onto the end boundary. */
export const frameTimes = (duration: number, interval: number, maxFrames = MAX_FRAME_COUNT) => {
	if (!Number.isFinite(duration) || duration <= 0) throw new Error("This video has no usable duration.");
	if (!Number.isFinite(interval) || interval < MIN_FRAME_INTERVAL) throw new Error(`Choose an interval of at least ${MIN_FRAME_INTERVAL} seconds.`);
	const count = Math.ceil(duration / interval);
	if (count > maxFrames) throw new Error(`That would make ${count} frames. Use a longer interval to keep the batch to ${maxFrames} frames or fewer.`);
	return Array.from({ length: count }, (_, index) => Number((index * interval).toFixed(3))).filter((time) => time < duration);
};

export const frameExtension = (format: FrameFormat) => (format === "image/jpeg" ? "jpg" : format.slice("image/".length));

export const frameFileName = (videoName: string, index: number, seconds: number, format: FrameFormat) => {
	const stem = videoName.replace(/\.[^.]+$/u, "").replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "video";
	const timestamp = formatMediaTime(seconds).replace(/:/gu, "-").replace(/\./gu, "-");
	return `${stem}-frame-${String(index).padStart(4, "0")}-at-${timestamp}.${frameExtension(format)}`;
};
