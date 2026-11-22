"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, SegmentedControl, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { convertSubtitles, detectFormat, formatTime, parseCues, parseShift, type SubtitleFormat } from "@/features/converter-tools/subtitle";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
Welcome back to the show.

2
00:00:04,200 --> 00:00:08,000
Today we are talking about subtitles.
`;

export const SubtitleConverterTool = () => {
	const [source, setSource] = useState(SAMPLE);
	const [format, setFormat] = useState<SubtitleFormat>("vtt");
	const [shift, setShift] = useState("");

	const result = useMemo(() => {
		const trimmed = source.trim();
		if (!trimmed) return { value: "", error: "", cues: 0, shiftSeconds: 0 };
		const shiftSeconds = parseShift(shift);
		if (shiftSeconds === null) return { value: "", error: "Type the shift in seconds (2.5) or as a clock time (00:00:03).", cues: 0, shiftSeconds: 0 };
		const cues = parseCues(trimmed).length;
		if (cues === 0) return { value: "", error: "No timings found. A subtitle file needs lines like 00:00:01,000 --> 00:00:04,000.", cues, shiftSeconds };
		try {
			return { value: convertSubtitles(trimmed, format, { shift: shiftSeconds }), error: "", cues, shiftSeconds };
		} catch {
			return { value: "", error: "These subtitles could not be read.", cues, shiftSeconds };
		}
	}, [source, format, shift]);

	const detected = detectFormat(source);
	const extension = format === "text" ? "txt" : format;
	const duration = useMemo(() => {
		const cues = parseCues(source);
		return cues.length ? formatTime(cues[cues.length - 1].end, ".") : "—";
	}, [source]);

	return (
		<ToolPanel>
			<TextAreaField
				hint={`Looks like ${detected === "vtt" ? "WebVTT" : "SubRip (SRT)"}. Cue text and timing convert; cue IDs, VTT positioning/styling, and file-level metadata are not preserved.`}
				id="subtitle-input"
				label="Subtitles"
				onChange={setSource}
				placeholder="Paste an .srt or .vtt file…"
				rows={12}
				value={source}
			/>
			<SegmentedControl<SubtitleFormat>
				label="Convert to"
				onChange={setFormat}
				options={[
					{ id: "vtt", label: "WebVTT" },
					{ id: "srt", label: "SRT" },
					{ id: "text", label: "Plain text" },
				]}
				value={format}
			/>
			<div>
				<label className="text-xs font-semibold text-[#3c3d37]" htmlFor="subtitle-shift">
					Shift the timing
				</label>
				<input
					className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					id="subtitle-shift"
					onChange={(event) => setShift(event.target.value)}
					placeholder="0 (seconds, e.g. 2.5 or -1.75)"
					type="text"
					value={shift}
				/>
				<p className={`${hintClassName} mt-2`}>Useful when the words and the picture drift apart. Negative numbers move the words earlier.</p>
			</div>
			<StatGrid
				items={[
					{ label: "Cues", value: String(result.cues) },
					{ label: "Shift", value: `${result.shiftSeconds >= 0 ? "+" : ""}${result.shiftSeconds}s` },
					{ label: "Last cue ends", value: duration },
					{ label: "Format", value: format === "text" ? "Plain text" : format.toUpperCase() },
				]}
			/>
			<ErrorNote message={result.error} />
			{!result.error ? <ResultBlock fileName={`converted.${extension}`} title={format === "text" ? "Transcript" : `${format.toUpperCase()} output`} value={result.value} /> : null}
			<p className={hintClassName}>Everything happens in this tab; nothing is uploaded.</p>
		</ToolPanel>
	);
};
