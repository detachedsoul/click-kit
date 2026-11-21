"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, Scissors, Upload } from "lucide-react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, smallActionClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import { fileInputClassName } from "@/features/image-tools/image-file-shared";
import {
	AUDIO_ACCEPT,
	clampTrimRange,
	encodeTrimmedWav,
	audioFileType,
	formatAudioTime,
	MAX_AUDIO_BYTES,
	validateAudioFile,
	waveformPeaks,
} from "@/features/audio-tools/audio-trimmer-utils";

const PEAK_WIDTH = 1000;
const PEAK_HEIGHT = 120;

const Waveform = ({ peaks, duration, start, end, current }: { peaks: number[]; duration: number; start: number; end: number; current: number }) => {
	const selectionStart = duration ? (start / duration) * PEAK_WIDTH : 0;
	const selectionEnd = duration ? (end / duration) * PEAK_WIDTH : PEAK_WIDTH;
	const playPosition = duration ? (current / duration) * PEAK_WIDTH : 0;
	return (
		<svg aria-label="Audio waveform with selected trim region" className="block h-28 w-full border border-line bg-[#fbfaf7]" preserveAspectRatio="none" role="img" viewBox={`0 0 ${PEAK_WIDTH} ${PEAK_HEIGHT}`}>
			<rect fill="#263b34" fillOpacity=".08" height={PEAK_HEIGHT} width={Math.max(0, selectionEnd - selectionStart)} x={selectionStart} />
			{peaks.map((peak, index) => {
				const x = (index / peaks.length) * PEAK_WIDTH;
				const barHeight = Math.max(2, peak * (PEAK_HEIGHT - 12));
				const selected = x >= selectionStart && x <= selectionEnd;
				return <rect fill={selected ? "#263b34" : "#a6aaa0"} height={barHeight} key={index} rx=".5" width={Math.max(0.5, PEAK_WIDTH / peaks.length - 0.5)} x={x} y={(PEAK_HEIGHT - barHeight) / 2} />;
			})}
			{current > 0 ? <line stroke="#b64b31" strokeWidth="2" x1={playPosition} x2={playPosition} y1="0" y2={PEAK_HEIGHT} /> : null}
		</svg>
	);
};

export const AudioTrimmer = () => {
	const audioRef = useRef<HTMLAudioElement>(null);
	const requestRef = useRef(0);
	const [file, setFile] = useState<File | null>(null);
	const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
	const [start, setStart] = useState(0);
	const [end, setEnd] = useState(0);
	const [current, setCurrent] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [exported, setExported] = useState<Blob | null>(null);

	const sourceUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
	const outputUrl = useMemo(() => (exported ? URL.createObjectURL(exported) : ""), [exported]);
	useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
	useEffect(() => () => { if (outputUrl) URL.revokeObjectURL(outputUrl); }, [outputUrl]);
	const peaks = useMemo(() => (buffer ? waveformPeaks(Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))) : []), [buffer]);
	const fileType = file ? audioFileType(file) : null;
	const duration = buffer?.duration ?? 0;
	const selectedLength = Math.max(0, end - start);

	const stopAudio = () => {
		const audio = audioRef.current;
		if (audio) audio.pause();
		setPlaying(false);
	};

	const loadFile = async (nextFile: File | null) => {
		if (!nextFile) return;
		try {
			validateAudioFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Choose a supported audio file.");
			return;
		}

		const request = requestRef.current + 1;
		requestRef.current = request;
		stopAudio();
		setLoading(true);
		setError("");
		setExported(null);
		setBuffer(null);
		setFile(nextFile);
		setStart(0);
		setEnd(0);
		setCurrent(0);

		const AudioContextConstructor = window.AudioContext;
		if (!AudioContextConstructor) {
			setLoading(false);
			setError("This browser does not provide the Web Audio API needed to decode audio.");
			return;
		}
		const context = new AudioContextConstructor();
		try {
			const decoded = await context.decodeAudioData(await nextFile.arrayBuffer());
			if (request !== requestRef.current) return;
			setBuffer(decoded);
			setEnd(decoded.duration);
		} catch {
			if (request === requestRef.current) {
				setFile(null);
				setError("This browser could not decode that file. Try an MP3, WAV, or M4A file supported by your browser.");
			}
		} finally {
			if (request === requestRef.current) setLoading(false);
			void context.close();
		}
	};

	const updateStart = (value: number) => {
		if (!duration) return;
		const range = clampTrimRange(duration, value, end);
		setStart(range.start);
		setEnd(range.end);
		setExported(null);
	};

	const updateEnd = (value: number) => {
		if (!duration) return;
		const range = clampTrimRange(duration, start, value);
		setStart(range.start);
		setEnd(range.end);
		setExported(null);
	};

	const playSelection = () => {
		const audio = audioRef.current;
		if (!audio || !sourceUrl) return;
		const begin = () => {
			try {
				if (audio.currentTime < start || audio.currentTime >= end) audio.currentTime = start;
				void audio.play().then(() => setPlaying(true)).catch(() => setError("This browser could not play the selected audio section."));
			} catch {
				setError("This browser could not seek to that point in the audio.");
			}
		};
		if (audio.readyState < 1) {
			audio.addEventListener("loadedmetadata", begin, { once: true });
			audio.load();
		} else begin();
	};

	const exportSelection = () => {
		if (!buffer) return;
		try {
			setExported(encodeTrimmedWav(buffer, start, end));
			setError("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not export this selection.");
		}
	};

	const stem = file?.name.replace(/\.[^.]+$/u, "") || "audio";

	return (
		<ToolPanel>
			<section className="flex flex-col gap-3" aria-labelledby="audio-upload-title">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="audio-upload-title">Choose an audio file</h2>
					<p className={`${hintClassName} mt-1`}>MP3, WAV, M4A, AAC, Ogg, Opus, FLAC, or WebM — decoded on this device, never uploaded.</p>
				</div>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="audio-trimmer-file">
					Audio file
					<input accept={AUDIO_ACCEPT} className={fileInputClassName} disabled={loading} id="audio-trimmer-file" onChange={(event) => { void loadFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} type="file" />
				</label>
				<p className={hintClassName}>Files up to {Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB. Input support depends on your browser&apos;s built-in audio decoder; the trimmed download is standard PCM WAV.</p>
				{loading ? <p className="m-0 text-xs text-muted" role="status">Decoding audio…</p> : null}
				{error ? <ErrorNote message={error} /> : null}
			</section>

			{buffer && file ? (
				<>
					<section className="flex flex-wrap items-center justify-between gap-2 border border-line bg-[#fbfaf7] px-3 py-2" aria-label="Audio file details">
						<div className="min-w-0">
							<p className="m-0 truncate text-xs font-semibold text-ink">{file.name}</p>
							<p className="m-0 mt-1 text-[11px] text-muted">{fileType?.label ?? "Audio"} · {buffer.numberOfChannels === 1 ? "Mono" : `${buffer.numberOfChannels} channels`} · {buffer.sampleRate.toLocaleString()} Hz · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>
						</div>
						<span className="shrink-0 font-mono text-xs text-muted">{formatAudioTime(duration)}</span>
					</section>

					<section className="flex flex-col gap-3" aria-labelledby="audio-wave-title">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<h2 className="m-0 text-sm font-semibold text-ink" id="audio-wave-title">Waveform and trim selection</h2>
							<span className="font-mono text-[11px] text-muted">{formatAudioTime(current)} / {formatAudioTime(duration)}</span>
						</div>
						<Waveform current={current} duration={duration} end={end} peaks={peaks} start={start} />
						<div className="grid gap-3 sm:grid-cols-2">
							<label className={labelClassName} htmlFor="audio-trim-start">Start time · {formatAudioTime(start)}
								<input className={fieldClassName} id="audio-trim-start" max={Math.max(0, end - 0.01)} min={0} onChange={(event) => updateStart(Number(event.target.value))} step="0.01" type="number" value={start.toFixed(2)} />
							</label>
							<label className={labelClassName} htmlFor="audio-trim-end">End time · {formatAudioTime(end)}
								<input className={fieldClassName} id="audio-trim-end" max={duration} min={Math.min(duration, start + 0.01)} onChange={(event) => updateEnd(Number(event.target.value))} step="0.01" type="number" value={end.toFixed(2)} />
							</label>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<label className={labelClassName} htmlFor="audio-trim-start-range">Selection start
								<input className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]" id="audio-trim-start-range" max={Math.max(0, end - 0.01)} min={0} onChange={(event) => updateStart(Number(event.target.value))} step="0.01" type="range" value={start} />
							</label>
							<label className={labelClassName} htmlFor="audio-trim-end-range">Selection end
								<input className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]" id="audio-trim-end-range" max={duration} min={Math.min(duration, start + 0.01)} onChange={(event) => updateEnd(Number(event.target.value))} step="0.01" type="range" value={end} />
							</label>
						</div>
						<p className="m-0 text-xs text-muted">Selected section: {formatAudioTime(selectedLength)}. Set either end to hundredths of a second, or drag its slider.</p>
					</section>

					<div className="flex flex-wrap items-center gap-2">
						<button className={smallActionClassName} onClick={playSelection} type="button"><Play aria-hidden="true" size={13} /> Preview selection</button>
						<button className={smallActionClassName} disabled={!playing} onClick={stopAudio} type="button"><Pause aria-hidden="true" size={13} /> Pause</button>
						<button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={exportSelection} type="button"><Scissors aria-hidden="true" size={13} /> Export trimmed WAV</button>
						{outputUrl ? <a className={smallActionClassName} download={`${stem}_trimmed.wav`} href={outputUrl}><Download aria-hidden="true" size={13} /> Download WAV</a> : null}
					</div>
					{exported ? <p className="m-0 text-xs text-ink" role="status">Trimmed WAV ready · {(exported.size / 1024).toFixed(1)} KB · {formatAudioTime(selectedLength)}</p> : null}
					<audio
						aria-hidden="true"
						className="sr-only"
						onEnded={() => { setCurrent(end); setPlaying(false); }}
						onPause={() => setPlaying(false)}
						onTimeUpdate={(event) => {
							const time = event.currentTarget.currentTime;
							setCurrent(time);
							if (time >= end) {
								event.currentTarget.pause();
								setPlaying(false);
							}
						}}
						preload="metadata"
						ref={audioRef}
						src={sourceUrl}
						tabIndex={-1}
					/>
				</>
			) : (
				<p className="m-0 flex items-center gap-2 border border-dashed border-line p-4 text-xs leading-relaxed text-muted">
					<Upload aria-hidden="true" className="shrink-0 text-forest" size={16} /> Choose an audio file to see its waveform, set a precise range, preview it, and export a trimmed WAV.
				</p>
			)}
		</ToolPanel>
	);
};
