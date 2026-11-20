/**
 * Subtitle files: SRT and WebVTT.
 *
 * Both formats are the same idea — a start time, an end time, and a few lines of words —
 * written with slightly different punctuation, so one parser and two writers cover them.
 */

export type Cue = { start: number; end: number; text: string };

const TIMING = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/u;

const toSeconds = (hours: string, minutes: string, seconds: string, fraction: string) =>
	Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction.padEnd(3, "0")) / 1000;

const pad = (value: number, size = 2) => String(Math.max(0, Math.trunc(value))).padStart(size, "0");

/** Milliseconds since the start, as SRT and VTT write them. */
export const formatTime = (seconds: number, separator: "," | "." = ",") => {
	const clamped = Math.max(0, seconds);
	const hours = Math.floor(clamped / 3600);
	const minutes = Math.floor((clamped % 3600) / 60);
	const whole = Math.floor(clamped % 60);
	const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
	return `${pad(hours)}:${pad(minutes)}:${pad(whole)}${separator}${pad(millis, 3)}`;
};

/** Reads either format. Returns an empty list rather than throwing on stray text. */
export const parseCues = (source: string): Cue[] => {
	const normalised = source.replace(/\r\n?/gu, "\n").replace(/^\uFEFF/u, "");
	const cues: Cue[] = [];
	const blocks = normalised.split(/\n{2,}/u);
	for (const block of blocks) {
		const lines = block.split("\n").filter((line) => line.trim().length > 0);
		if (lines.length === 0) continue;
		const timingIndex = lines.findIndex((line) => TIMING.test(line));
		if (timingIndex === -1) continue;
		const match = TIMING.exec(lines[timingIndex]);
		if (!match) continue;
		const text = lines
			.slice(timingIndex + 1)
			.join("\n")
			.trim();
		cues.push({
			start: toSeconds(match[1], match[2], match[3], match[4]),
			end: toSeconds(match[5], match[6], match[7], match[8]),
			text,
		});
	}
	return cues;
};

export type SubtitleStyle = { shift?: number; keepNumbering?: boolean };

/** Shifts every cue by a number of seconds (negative moves them earlier). */
export const shiftCues = (cues: Cue[], seconds: number): Cue[] =>
	cues.map((cue) => ({ start: Math.max(0, cue.start + seconds), end: Math.max(0, cue.end + seconds), text: cue.text }));

export const toSrt = (cues: Cue[]): string =>
	cues
		.map((cue, index) => `${index + 1}\n${formatTime(cue.start, ",")} --> ${formatTime(cue.end, ",")}\n${cue.text}`)
		.join("\n\n")
		.concat(cues.length ? "\n" : "");

export const toVtt = (cues: Cue[]): string =>
	`WEBVTT\n\n${cues
		.map((cue) => `${formatTime(cue.start, ".")} --> ${formatTime(cue.end, ".")}\n${cue.text}`)
		.join("\n\n")}${cues.length ? "\n" : ""}`;

/** The words alone, one cue per line, for notes and transcripts. */
export const toPlainText = (cues: Cue[]): string => cues.map((cue) => cue.text.replace(/\n/gu, " ")).join("\n");

export type SubtitleFormat = "srt" | "vtt" | "text";

export const convertSubtitles = (source: string, format: SubtitleFormat, options: SubtitleStyle = {}): string => {
	const cues = parseCues(source);
	const shifted = options.shift ? shiftCues(cues, options.shift) : cues;
	if (format === "srt") return toSrt(shifted);
	if (format === "vtt") return toVtt(shifted);
	return toPlainText(shifted).concat(shifted.length ? "\n" : "");
};

/** Which format a file seems to be, from its first real line. */
export const detectFormat = (source: string): "srt" | "vtt" => (/^\uFEFF?WEBVTT/iu.test(source.trimStart()) ? "vtt" : "srt");

/** "00:01:02,500" as a total number of seconds, for the shift field. */
export const parseShift = (input: string): number | null => {
	const text = input.trim();
	if (!text) return 0;
	const simple = /^[+-]?\d+(\.\d+)?$/u;
	if (simple.test(text)) return Number(text);
	const clock = /^([+-])?(\d{1,2}):(\d{2})(?::(\d{2}))?$/u.exec(text);
	if (!clock) return null;
	const sign = clock[1] === "-" ? -1 : 1;
	const total = Number(clock[2]) * 3600 + Number(clock[3]) * 60 + Number(clock[4] ?? 0);
	return sign * total;
};
