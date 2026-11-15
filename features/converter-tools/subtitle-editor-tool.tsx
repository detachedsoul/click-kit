"use client";

import { useMemo, useRef, useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { MAX_VIDEO_BYTES, VIDEO_ACCEPT, validateVideoFile } from "@/features/video-tools/video-extractor-utils";
import { parseShift } from "@/features/converter-tools/subtitle";
import {
	formatTimecode,
	mergeEditableCues,
	parseSubtitleDocument,
	parseTimecode,
	replaceCueText,
	serializeSubtitleDocument,
	shiftEditableCues,
	splitEditableCue,
	type EditableCue,
	validateEditableCues,
} from "@/features/converter-tools/subtitle-editor-utils";

const ACCEPT_SUBTITLES = ".srt,.vtt,application/x-subrip,text/vtt,text/plain";
const MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;
const MAX_CUES = 5000;
const buttonClass = "min-h-8 cursor-pointer border border-line bg-surface px-2.5 text-[11px] text-ink hover:bg-[#f1f0ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const cueBoxClass = "flex flex-col gap-3 border border-line bg-[#fbfaf7] p-3";

type Drafts = Record<string, string>;
const draftKey = (id: string, part: "start" | "end") => `${id}:${part}`;

export const SubtitleEditorTool = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const nextCueNumber = useRef(1);
	const [cues, setCues] = useState<EditableCue[]>([]);
	const [format, setFormat] = useState<"srt" | "vtt">("srt");
	const [fileName, setFileName] = useState("subtitles");
	const [video, setVideo] = useState<File | null>(null);
	const [videoDuration, setVideoDuration] = useState(0);
	const [playbackTime, setPlaybackTime] = useState(0);
	const [selectedCueId, setSelectedCueId] = useState("");
	const [shiftInput, setShiftInput] = useState("");
	const [search, setSearch] = useState("");
	const [replacement, setReplacement] = useState("");
	const [drafts, setDrafts] = useState<Drafts>({});
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const subtitleUrl = useObjectUrl(video);

	const activeCue = cues.find((cue) => playbackTime >= cue.start && playbackTime < cue.end);
	const lastTime = Math.max(videoDuration, ...cues.map((cue) => cue.end), 1);
	const invalidCue = validateEditableCues(cues);
	const output = useMemo(() => serializeSubtitleDocument(cues, format), [cues, format]);
	const matchedText = search ? cues.reduce((count, cue) => count + cue.text.split(search).length - 1, 0) : 0;

	const clearEdits = () => {
		setDrafts({});
		setError("");
		setNotice("");
	};

	const loadSubtitleFile = async (chosen: File | null) => {
		if (!chosen) return;
		clearEdits();
		try {
			if (chosen.size > MAX_SUBTITLE_BYTES) throw new Error("Choose a subtitle file smaller than 5 MB.");
			const parsed = parseSubtitleDocument(await chosen.text());
			if (!parsed.cues.length) throw new Error("No valid subtitle entries were found. Check that each entry has a start time, end time, and text.");
			if (parsed.cues.length > MAX_CUES) throw new Error(`This file has more than ${MAX_CUES} entries. Split it into smaller parts to edit it here.`);
			nextCueNumber.current = parsed.cues.length + 1;
			setCues(parsed.cues);
			setFormat(parsed.format);
			setFileName(chosen.name.replace(/\.(srt|vtt)$/iu, "") || "subtitles");
			setSelectedCueId(parsed.cues[0].id);
			setNotice(`${parsed.cues.length} subtitle entries loaded.`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This subtitle file could not be read.");
		}
	};

	const loadVideoFile = (chosen: File | null) => {
		if (!chosen) return;
		setError("");
		setVideoDuration(0);
		setPlaybackTime(0);
		try {
			validateVideoFile(chosen);
			setVideo(chosen);
		} catch (caught) {
			setVideo(null);
			setError(caught instanceof Error ? caught.message : "Choose a supported video.");
		}
	};

	const addCue = () => {
		if (cues.length >= MAX_CUES) {
			setError(`Keep the edit to ${MAX_CUES} entries or fewer.`);
			return;
		}
		const start = cues.length ? Math.max(0, cues[cues.length - 1].end) : 0;
		const cue = { id: `cue-${nextCueNumber.current++}`, start, end: start + 2, text: "New subtitle" };
		setCues((current) => [...current, cue]);
		setSelectedCueId(cue.id);
		setNotice("Subtitle entry added.");
		setError("");
	};

	const updateCue = (id: string, patch: Partial<EditableCue>) => {
		setCues((current) => current.map((cue) => cue.id === id ? { ...cue, ...patch } : cue));
	};

	const commitTime = (cue: EditableCue, part: "start" | "end") => {
		const key = draftKey(cue.id, part);
		const raw = drafts[key];
		if (raw === undefined) return;
		const seconds = parseTimecode(raw);
		if (seconds === null || (part === "start" ? seconds >= cue.end : seconds <= cue.start)) {
			setError(part === "start" ? "Start time must be a valid timecode before the end time." : "End time must be a valid timecode after the start time.");
			return;
		}
		updateCue(cue.id, { [part]: seconds });
		setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
		setError("");
	};

	const shiftAll = () => {
		const delta = parseShift(shiftInput);
		if (delta === null) {
			setError("Enter a shift in seconds, such as 2.5 or -1.25.");
			return;
		}
		setCues((current) => shiftEditableCues(current, delta));
		setDrafts({});
		setError("");
		setNotice(`All timings shifted by ${delta >= 0 ? "+" : ""}${delta} seconds.`);
	};

	const splitCue = (cue: EditableCue, index: number) => {
		const parts = splitEditableCue(cue, `cue-${nextCueNumber.current++}`);
		if (!parts) {
			setError("This entry needs at least two words and enough time to split.");
			return;
		}
		setCues((current) => [...current.slice(0, index), ...parts, ...current.slice(index + 1)]);
		setSelectedCueId(parts[1].id);
		setError("");
		setNotice("Entry split into two timed subtitles.");
	};

	const mergeNext = (cue: EditableCue, index: number) => {
		const next = cues[index + 1];
		if (!next) return;
		setCues((current) => [...current.slice(0, index), mergeEditableCues(cue, next), ...current.slice(index + 2)]);
		setSelectedCueId(cue.id);
		setError("");
		setNotice("Adjacent entries merged.");
	};

	const removeCue = (cue: EditableCue) => {
		setCues((current) => current.filter((item) => item.id !== cue.id));
		if (selectedCueId === cue.id) setSelectedCueId(cues.find((item) => item.id !== cue.id)?.id ?? "");
		setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${cue.id}:`))));
		setError("");
	};

	const replaceAll = () => {
		if (!search) return;
		const result = replaceCueText(cues, search, replacement);
		setCues(result.cues);
		setError("");
		setNotice(`${result.replacements} match${result.replacements === 1 ? "" : "es"} replaced.`);
	};

	const seekTo = (cue: EditableCue) => {
		setSelectedCueId(cue.id);
		if (!videoRef.current) return;
		try {
			videoRef.current.currentTime = cue.start;
			setPlaybackTime(cue.start);
		} catch {
			setError("The video could not seek to this subtitle.");
		}
	};

	const stem = fileName.replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "subtitles";
	const exportSrt = serializeSubtitleDocument(cues, "srt");
	const exportVtt = serializeSubtitleDocument(cues, "vtt");

	return (
		<ToolPanel>
			<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
				<FileField accept={ACCEPT_SUBTITLES} hint="Open an SRT or WebVTT file. Entries can be edited, split, merged, and shifted." id="subtitle-editor-file" label="Subtitle file" onFile={(chosen) => void loadSubtitleFile(chosen)} />
				<FileField accept={VIDEO_ACCEPT} hint={`Optional video preview, up to ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB. The video stays on this device.`} id="subtitle-editor-video" label="Video for preview" onFile={loadVideoFile} />
			</div>

			{video && subtitleUrl ? (
				<div className="relative overflow-hidden border border-line bg-black">
					<video
						aria-label="Video with subtitle preview"
						className="block max-h-[520px] w-full bg-black"
						controls
						onDurationChange={(event) => setVideoDuration(event.currentTarget.duration || 0)}
						onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
						preload="metadata"
						ref={videoRef}
						src={subtitleUrl}
					/>
					{activeCue ? <div aria-live="off" className="pointer-events-none absolute bottom-12 left-1/2 max-w-[88%] -translate-x-1/2 whitespace-pre-wrap bg-black/80 px-4 py-2 text-center text-lg font-semibold leading-snug text-white shadow-lg max-[520px]:text-base">{activeCue.text.replace(/<[^>]*>/gu, "")}</div> : null}
				</div>
			) : null}

			{cues.length ? (
				<>
					<StatGrid items={[
						{ label: "Entries", value: String(cues.length) },
						{ label: "Length", value: formatTimecode(lastTime, "vtt") },
						{ label: "Format", value: format.toUpperCase() },
						{ label: "Video", value: videoDuration ? formatTimecode(videoDuration, "vtt") : video ? "Loading…" : "Not selected" },
					]} />

					<section aria-label="Subtitle timeline" className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-2"><h3 className="m-0 text-xs font-semibold text-ink">Timeline</h3><span className="text-[11px] text-muted">Select an entry to seek the video</span></div>
						<div className="relative h-8 overflow-hidden border border-line bg-[#f1f0ea]">
							{cues.map((cue, index) => {
								const left = Math.min(100, Math.max(0, cue.start / lastTime * 100));
								const width = Math.max(0.35, Math.min(100 - left, (cue.end - cue.start) / lastTime * 100));
								return <button aria-label={`Timeline entry ${index + 1}: ${cue.text}`} className={`absolute inset-y-1 border border-forest ${cue.id === selectedCueId ? "bg-forest" : "bg-[#b7c2b4] hover:bg-[#95a690]"}`} key={cue.id} onClick={() => seekTo(cue)} style={{ left: `${left}%`, width: `${width}%` }} title={`${formatTimecode(cue.start, format)} — ${formatTimecode(cue.end, format)}`} type="button" />;
							})}
						</div>
					</section>

					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[620px]:grid-cols-1">
						<label className={labelClassName} htmlFor="subtitle-shift-all">Shift every entry
							<input className={fieldClassName} id="subtitle-shift-all" onChange={(event) => setShiftInput(event.target.value)} placeholder="Seconds, e.g. 1.5 or -2" type="text" value={shiftInput} />
						</label>
						<button className={buttonClass} onClick={shiftAll} type="button">Apply shift</button>
					</div>

					<div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
						<label className={labelClassName} htmlFor="subtitle-search">Find text
							<input className={fieldClassName} id="subtitle-search" onChange={(event) => setSearch(event.target.value)} placeholder="Text to find" type="search" value={search} />
						</label>
						<label className={labelClassName} htmlFor="subtitle-replacement">Replace with
							<input className={fieldClassName} id="subtitle-replacement" onChange={(event) => setReplacement(event.target.value)} placeholder="Replacement text" type="text" value={replacement} />
						</label>
						<div className="col-span-2 flex items-center justify-between gap-3 max-[620px]:col-span-1"><span className="text-[11px] text-muted">{matchedText} match{matchedText === 1 ? "" : "es"}</span><button className={buttonClass} disabled={!search || !matchedText} onClick={replaceAll} type="button">Replace all</button></div>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<h3 className="m-0 text-xs font-semibold text-ink">Subtitle entries</h3>
						<button className={buttonClass} disabled={cues.length >= MAX_CUES} onClick={addCue} type="button">Add entry</button>
					</div>
					<div className="flex max-h-[620px] flex-col gap-3 overflow-y-auto pr-1">
						{cues.map((cue, index) => (
							<article aria-label={`Subtitle entry ${index + 1}`} className={`${cueBoxClass} ${selectedCueId === cue.id ? "border-forest" : ""}`} key={cue.id} onClick={() => setSelectedCueId(cue.id)}>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h4 className="m-0 text-xs font-semibold text-ink">Entry {index + 1}</h4>
									<button aria-label={`Preview entry ${index + 1}`} className={buttonClass} onClick={(event) => { event.stopPropagation(); seekTo(cue); }} type="button">Preview</button>
								</div>
								<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
									{(["start", "end"] as const).map((part) => (
										<label className={labelClassName} htmlFor={`cue-${cue.id}-${part}`} key={part}>{part === "start" ? "Start time" : "End time"}
											<input aria-label={`${part === "start" ? "Start" : "End"} time for entry ${index + 1}`} className={fieldClassName} id={`cue-${cue.id}-${part}`} onBlur={() => commitTime(cue, part)} onChange={(event) => setDrafts((current) => ({ ...current, [draftKey(cue.id, part)]: event.target.value }))} placeholder="00:00:00.000" type="text" value={drafts[draftKey(cue.id, part)] ?? formatTimecode(cue[part], format)} />
										</label>
									))}
								</div>
								<label className={labelClassName} htmlFor={`cue-${cue.id}-text`}>Subtitle text
									<textarea className="mt-2 min-h-20 w-full border border-line bg-surface p-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" id={`cue-${cue.id}-text`} onChange={(event) => updateCue(cue.id, { text: event.target.value })} value={cue.text} />
								</label>
								<div className="flex flex-wrap gap-2">
									<button className={buttonClass} disabled={cues.length >= MAX_CUES} onClick={() => splitCue(cue, index)} type="button">Split at midpoint</button>
									<button className={buttonClass} disabled={index >= cues.length - 1} onClick={() => mergeNext(cue, index)} type="button">Merge with next</button>
									<button className={buttonClass} onClick={() => removeCue(cue)} type="button">Delete</button>
								</div>
							</article>
						))}
					</div>
				</>
			) : (
				<div className="border border-dashed border-line bg-[#fbfaf7] p-4">
					<p className={hintClassName}>Open an SRT or WebVTT file, or add your first subtitle entry. Add a video to preview captions in sync.</p>
					<button className={`${buttonClass} mt-3`} onClick={addCue} type="button">Add first entry</button>
				</div>
			)}

			<ErrorNote message={error || (invalidCue ? "Every entry needs text and an end time after its start time before you can export." : "")} />
			{notice ? <p aria-live="polite" className={hintClassName} role="status">{notice}</p> : null}
			{cues.length ? (
				<>
					<SegmentedControl label="Export format" onChange={setFormat} options={[{ id: "srt", label: "SRT" }, { id: "vtt", label: "WebVTT" }]} value={format} />
					{!invalidCue ? <ResultBlock fileName={`${stem}.${format}`} rows={Math.min(14, Math.max(5, cues.length * 3))} title={`${format.toUpperCase()} preview`} value={output} /> : null}
					<div className="flex flex-wrap gap-2">
						<a className={`inline-flex min-h-9 items-center border border-forest px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${invalidCue ? "pointer-events-none cursor-not-allowed bg-forest/50" : "cursor-pointer bg-forest hover:bg-[#354d44]"}`} download={`${stem}.srt`} href={invalidCue ? undefined : `data:text/plain;charset=utf-8,${encodeURIComponent(exportSrt)}`} aria-disabled={Boolean(invalidCue)} tabIndex={invalidCue ? -1 : undefined}>Download SRT</a>
						<a className={`inline-flex min-h-9 items-center border border-forest px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${invalidCue ? "pointer-events-none cursor-not-allowed bg-forest/50" : "cursor-pointer bg-forest hover:bg-[#354d44]"}`} download={`${stem}.vtt`} href={invalidCue ? undefined : `data:text/vtt;charset=utf-8,${encodeURIComponent(exportVtt)}`} aria-disabled={Boolean(invalidCue)} tabIndex={invalidCue ? -1 : undefined}>Download WebVTT</a>
					</div>
				</>
			) : null}
			<p className={hintClassName}>Subtitle and video files stay on this device. Text styling is kept as written; timing and cue text are included in either export.</p>
		</ToolPanel>
	);
};
