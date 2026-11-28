export type EditableCue = {
	id: string;
	start: number;
	end: number;
	text: string;
	vttId?: string;
	settings?: string;
};

export type SubtitleDocument = { format: "srt" | "vtt"; cues: EditableCue[] };

const TIMING_LINE = /^\s*(\S+)\s+-->\s+(\S+)(?:\s+(.*?))?\s*$/u;
const TIME_CODE = /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/u;

/** Parse SRT's HH:MM:SS,mmm and WebVTT's HH:MM:SS.mmm or MM:SS.mmm. */
export const parseTimecode = (value: string): number | null => {
	const match = TIME_CODE.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	const millis = Number(match[4].padEnd(3, "0"));
	if (minutes > 59 || seconds > 59) return null;
	const total = hours * 3600 + minutes * 60 + seconds + millis / 1000;
	return Number.isFinite(total) ? total : null;
};

export const formatTimecode = (seconds: number, format: "srt" | "vtt" = "srt") => {
	const totalMillis = Math.max(0, Math.round(seconds * 1000));
	const hours = Math.floor(totalMillis / 3_600_000);
	const minutes = Math.floor((totalMillis % 3_600_000) / 60_000);
	const wholeSeconds = Math.floor((totalMillis % 60_000) / 1000);
	const millis = totalMillis % 1000;
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${pad(hours)}:${pad(minutes)}:${pad(wholeSeconds)}${format === "srt" ? "," : "."}${String(millis).padStart(3, "0")}`;
};

/** Read cues while ignoring headers, NOTE blocks, and malformed timing lines. */
export const parseSubtitleDocument = (source: string): SubtitleDocument => {
	const normalized = source.replace(/\r\n?/gu, "\n").replace(/^\uFEFF/u, "");
	const format = /^WEBVTT(?:\s|$)/iu.test(normalized.trimStart()) ? "vtt" : "srt";
	const cues: EditableCue[] = [];
	for (const block of normalized.split(/\n[\t ]*\n+/u)) {
		const lines = block.split("\n");
		if (format === "vtt" && /^(NOTE|STYLE|REGION)(?:\s|$)/u.test(lines[0]?.trim() ?? "")) continue;
		let timingIndex = -1;
		let timing: RegExpExecArray | null = null;
		for (const index of [0, 1]) {
			const line = lines[index];
			if (!line) continue;
			const candidate = TIMING_LINE.exec(line);
			if (candidate && parseTimecode(candidate[1]) !== null && parseTimecode(candidate[2]) !== null) {
				timingIndex = index;
				timing = candidate;
				break;
			}
		}
		if (timingIndex < 0 || !timing) continue;
		const text = lines.slice(timingIndex + 1).join("\n").trim();
		if (!text) continue;
		const start = parseTimecode(timing[1]);
		const end = parseTimecode(timing[2]);
		if (start === null || end === null || end <= start) continue;
		const before = lines.slice(0, timingIndex).map((line) => line.trim()).filter(Boolean);
		cues.push({
			id: `cue-${cues.length + 1}`,
			start,
			end,
			text,
			...(format === "vtt" && before.length ? { vttId: before.at(-1) } : {}),
			...(format === "vtt" && timing[3] ? { settings: timing[3] } : {}),
		});
	}
	return { format, cues };
};

export const serializeSubtitleDocument = (cues: EditableCue[], format: "srt" | "vtt") => {
	const blocks = cues.map((cue, index) => {
		const timing = `${formatTimecode(cue.start, format)} --> ${formatTimecode(cue.end, format)}${format === "vtt" && cue.settings ? ` ${cue.settings}` : ""}`;
		if (format === "srt") return `${index + 1}\n${timing}\n${cue.text}`;
		return `${cue.vttId ? `${cue.vttId}\n` : ""}${timing}\n${cue.text}`;
	});
	return `${format === "vtt" ? "WEBVTT\n\n" : ""}${blocks.join("\n\n")}${blocks.length ? "\n" : ""}`;
};

export const shiftEditableCues = (cues: EditableCue[], delta: number): EditableCue[] =>
	cues.map((cue) => {
		const start = Math.max(0, cue.start + delta);
		const end = start + (cue.end - cue.start);
		return { ...cue, start, end };
	});

export const splitEditableCue = (cue: EditableCue, nextId: string): [EditableCue, EditableCue] | null => {
	const text = cue.text.trim();
	const midpoint = Math.floor(text.length / 2);
	const after = text.indexOf(" ", midpoint);
	const before = text.lastIndexOf(" ", midpoint);
	const splitAt = after > 0 && after < text.length - 1 ? after : before;
	if (splitAt < 1 || splitAt >= text.length - 1 || cue.end - cue.start < 0.002) return null;
	const splitTime = cue.start + (cue.end - cue.start) / 2;
	return [
		{ ...cue, end: splitTime, text: text.slice(0, splitAt).trim() },
		{ ...cue, id: nextId, start: splitTime, text: text.slice(splitAt).trim(), vttId: undefined },
	];
};

export const mergeEditableCues = (first: EditableCue, second: EditableCue): EditableCue => ({
	...first,
	end: Math.max(first.end, second.end),
	text: [first.text.trim(), second.text.trim()].filter(Boolean).join("\n"),
});

export const replaceCueText = (cues: EditableCue[], search: string, replacement: string) => {
	if (!search) return { cues, replacements: 0 };
	let replacements = 0;
	const next = cues.map((cue) => {
		const count = cue.text.split(search).length - 1;
		replacements += count;
		return count ? { ...cue, text: cue.text.split(search).join(replacement) } : cue;
	});
	return { cues: next, replacements };
};

export const validateEditableCues = (cues: EditableCue[]) => cues.find((cue) =>
	!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || !cue.text.trim(),
) ?? null;
