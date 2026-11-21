"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Play, Scissors } from "lucide-react";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, smallActionClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import { fileInputClassName, useObjectUrl } from "@/features/image-tools/image-file-shared";
import {
	clampVideoTrimRange,
	formatTrimTime,
	MAX_TRIM_VIDEO_BYTES,
	validateTrimVideoFile,
	videoTrimFileName,
	VIDEO_TRIM_ACCEPT,
} from "@/features/video-tools/video-trimmer-utils";

type FfmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;
type FfmpegConstructor = new () => FfmpegInstance;

declare global {
	interface Window {
		FFmpegWASM?: { FFmpeg: FfmpegConstructor };
	}
}

const INPUT_NAME = "source-video";
const OUTPUT_NAME = "trimmed-video.mp4";
const CORE_URL = "/ffmpeg/ffmpeg-core.js";
const WASM_URL = "/ffmpeg/ffmpeg-core.wasm";

export const VideoTrimmer = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const ffmpegRef = useRef<FfmpegInstance | null>(null);
	const runtimePromiseRef = useRef<Promise<void> | null>(null);
	const requestRef = useRef(0);
	const [file, setFile] = useState<File | null>(null);
	const [duration, setDuration] = useState(0);
	const [start, setStart] = useState(0);
	const [end, setEnd] = useState(0);
	const [current, setCurrent] = useState(0);
	const [output, setOutput] = useState<Blob | null>(null);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const sourceUrl = useObjectUrl(file);
	const outputUrl = useObjectUrl(output);

	useEffect(() => () => {
		requestRef.current += 1;
		ffmpegRef.current?.terminate();
		ffmpegRef.current = null;
	}, []);

	const chooseFile = (nextFile: File | null) => {
		setError("");
		setStatus("");
		if (!nextFile) return;
		try {
			validateTrimVideoFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Choose a supported video file.");
			return;
		}
		videoRef.current?.pause();
		setFile(nextFile);
		setDuration(0);
		setStart(0);
		setEnd(0);
		setCurrent(0);
		setOutput(null);
		setProgress(0);
	};

	const onMetadata = () => {
		const video = videoRef.current;
		if (!video) return;
		if (!Number.isFinite(video.duration) || video.duration <= 0) {
			setError("This video does not have a usable duration.");
			return;
		}
		setDuration(video.duration);
		setStart(0);
		setEnd(video.duration);
		setCurrent(video.currentTime);
		setError("");
	};

	const setStartPoint = (value: number) => {
		if (!duration) return;
		const range = clampVideoTrimRange(duration, value, end);
		setStart(range.start);
		setEnd(range.end);
		setOutput(null);
	};

	const setEndPoint = (value: number) => {
		if (!duration) return;
		const range = clampVideoTrimRange(duration, start, value);
		setStart(range.start);
		setEnd(range.end);
		setOutput(null);
	};

	const previewSelection = async () => {
		const video = videoRef.current;
		if (!video || !duration) return;
		setError("");
		video.pause();
		const playFromStart = () => {
			if (!videoRef.current) return;
			void video.play().catch(() => setError("This browser could not play the selected section."));
		};
		if (Math.abs(video.currentTime - start) < 0.02 && video.readyState >= 2) playFromStart();
		else {
			video.addEventListener("seeked", playFromStart, { once: true });
			try {
				video.currentTime = start;
			} catch {
				video.removeEventListener("seeked", playFromStart);
				setError("This browser could not seek to the selected start point.");
			}
		}
	};

	const getFFmpegConstructor = async () => {
		if (window.FFmpegWASM?.FFmpeg) return window.FFmpegWASM.FFmpeg;
		if (!runtimePromiseRef.current) {
			runtimePromiseRef.current = new Promise<void>((resolve, reject) => {
				const script = document.createElement("script");
				script.src = "/ffmpeg/ffmpeg.js";
				script.async = true;
				script.onload = () => resolve();
				script.onerror = () => reject(new Error("Could not load the FFmpeg runtime script."));
				document.head.append(script);
			});
		}
		await runtimePromiseRef.current;
		if (!window.FFmpegWASM?.FFmpeg) throw new Error("The FFmpeg runtime did not initialize.");
		return window.FFmpegWASM.FFmpeg;
	};

	const trimVideo = async () => {
		if (!file || !duration || busy) return;
		const request = requestRef.current + 1;
		requestRef.current = request;
		setBusy(true);
		setProgress(0);
		setStatus("Starting FFmpeg in a background worker…");
		setError("");
		setOutput(null);
		try {
			let ffmpeg = ffmpegRef.current;
			if (!ffmpeg) {
				const FFmpeg = await getFFmpegConstructor();
				ffmpeg = new FFmpeg();
				ffmpeg.on("progress", ({ progress: ratio }) => {
					if (request === requestRef.current && Number.isFinite(ratio)) setProgress(Math.min(99, Math.max(0, Math.round(ratio * 100))));
				});
				ffmpegRef.current = ffmpeg;
			}
			if (!ffmpeg.loaded) {
				setStatus("Loading the video engine (first use may take a little while)…");
				await ffmpeg.load({ coreURL: CORE_URL, wasmURL: WASM_URL });
			}
			if (request !== requestRef.current) return;
			setStatus("Preparing video in worker memory…");
			await ffmpeg.writeFile(INPUT_NAME, new Uint8Array(await file.arrayBuffer()));
			if (request !== requestRef.current) return;
			setStatus("Trimming and encoding MP4…");
			const length = end - start;
			const exitCode = await ffmpeg.exec([
				"-ss", start.toFixed(3), "-i", INPUT_NAME, "-t", length.toFixed(3),
				"-map", "0:v:0", "-map", "0:a?", "-sn", "-dn",
				"-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
				"-c:a", "aac", "-b:a", "128k", "-threads", "1", "-movflags", "+faststart", OUTPUT_NAME,
			]);
			if (request !== requestRef.current) return;
			if (exitCode !== 0) throw new Error("FFmpeg could not encode this video. Its input codec may not be supported by the browser build.");
			const data = await ffmpeg.readFile(OUTPUT_NAME, "binary");
			if (typeof data === "string" || !data.length) throw new Error("FFmpeg did not produce a video file.");
			setOutput(new Blob([data as unknown as BlobPart], { type: "video/mp4" }));
			setProgress(100);
			setStatus("Trim complete. Download the MP4 below.");
		} catch (caught) {
			if (request === requestRef.current) {
				const message = caught instanceof Error ? caught.message : "Could not trim this video.";
				setError(message.includes("fetch") || message.includes("core")
					? "The video engine could not load. Check your connection and try again."
					: message);
				setStatus("");
			}
		} finally {
			const ffmpeg = ffmpegRef.current;
			if (ffmpeg?.loaded) {
				await Promise.all([INPUT_NAME, OUTPUT_NAME].map(async (path) => {
					try { await ffmpeg.deleteFile(path); } catch { /* The file may not have been written. */ }
				}));
			}
			if (request === requestRef.current) setBusy(false);
		}
	};

	const trimLength = Math.max(0, end - start);
	const percentStart = duration ? (start / duration) * 100 : 0;
	const percentEnd = duration ? (end / duration) * 100 : 100;

	return (
		<ToolPanel>
			<section className="flex flex-col gap-3" aria-labelledby="video-trimmer-upload-title">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="video-trimmer-upload-title">Choose a video</h2>
					<p className={`${hintClassName} mt-1`}>Trim MP4, MOV, WebM, and other supported video files. Files stay on this device.</p>
				</div>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="video-trimmer-file">
					Video file
					<input accept={VIDEO_TRIM_ACCEPT} className={fileInputClassName} disabled={busy} id="video-trimmer-file" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} type="file" />
				</label>
				<p className={hintClassName}>Files up to {Math.round(MAX_TRIM_VIDEO_BYTES / (1024 * 1024))} MB. Trimming runs locally using FFmpeg WebAssembly in a worker; first use downloads a roughly 32 MB video engine.</p>
				{error ? <ErrorNote message={error} /> : null}
			</section>

			{file ? (
				<>
					<section className="flex flex-col gap-3" aria-label="Video preview">
						<video
							className="max-h-[430px] w-full border border-line bg-[#171916]"
							controls
							playsInline
							preload="metadata"
							ref={videoRef}
							src={sourceUrl}
							onError={() => setError("This browser could not preview that video. Try an MP4 or WebM encoded with a browser-supported codec.")}
							onLoadedMetadata={onMetadata}
							onDurationChange={onMetadata}
							onTimeUpdate={() => {
								const video = videoRef.current;
							if (!video) return;
							setCurrent(video.currentTime);
							if (!video.paused && video.currentTime >= end) video.pause();
						}}
							onPause={() => setCurrent(videoRef.current?.currentTime ?? 0)}
						/>
						{duration > 0 ? (
							<>
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
									<span className="min-w-0 truncate font-medium text-ink">{file.name}</span>
									<span className="shrink-0 font-mono">{formatTrimTime(current)} / {formatTrimTime(duration)}</span>
								</div>
								<label className={labelClassName} htmlFor="video-trim-scrub">Scrub video
									<input className="mt-2 block h-9 w-full cursor-pointer accent-[#263b34]" id="video-trim-scrub" max={duration} min={0} onChange={(event) => { const time = Number(event.target.value); setCurrent(time); if (videoRef.current) videoRef.current.currentTime = time; }} step="0.01" type="range" value={current} />
								</label>
								<div aria-label="Selected range on video timeline" className="relative h-2 border border-line bg-[#eeede7]">
									<div className="absolute inset-y-0 bg-[#263b34]" style={{ left: `${percentStart}%`, width: `${Math.max(0, percentEnd - percentStart)}%` }} />
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<label className={labelClassName} htmlFor="video-trim-start">Selection start · {formatTrimTime(start)}
										<input className="mt-2 block h-10 w-full cursor-pointer accent-[#263b34]" disabled={busy} id="video-trim-start" max={Math.max(0, end - 0.01)} min={0} onChange={(event) => setStartPoint(Number(event.target.value))} step="0.01" type="range" value={start} />
									</label>
									<label className={labelClassName} htmlFor="video-trim-end">Selection end · {formatTrimTime(end)}
										<input className="mt-2 block h-10 w-full cursor-pointer accent-[#263b34]" disabled={busy} id="video-trim-end" max={duration} min={Math.min(duration, start + 0.05)} onChange={(event) => setEndPoint(Number(event.target.value))} step="0.01" type="range" value={end} />
									</label>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<label className={labelClassName} htmlFor="video-trim-start-time">Start time · {formatTrimTime(start)}
										<input className="mt-2 h-11 w-full border border-field bg-surface px-3 font-mono text-sm text-ink" disabled={busy} id="video-trim-start-time" max={Math.max(0, end - 0.05)} min={0} onChange={(event) => setStartPoint(Number(event.target.value))} step="0.01" type="number" value={Number(start.toFixed(2))} />
									</label>
									<label className={labelClassName} htmlFor="video-trim-end-time">End time · {formatTrimTime(end)}
										<input className="mt-2 h-11 w-full border border-field bg-surface px-3 font-mono text-sm text-ink" disabled={busy} id="video-trim-end-time" max={duration} min={Math.min(duration, start + 0.05)} onChange={(event) => setEndPoint(Number(event.target.value))} step="0.01" type="number" value={Number(end.toFixed(2))} />
									</label>
								</div>
								<p className="m-0 text-xs text-muted">Selected clip: {formatTrimTime(trimLength)}. Output is re-encoded as H.264 video with AAC audio for broad MP4 compatibility.</p>
							</>
						) : <p className="m-0 text-xs text-muted">Loading video metadata…</p>}
					</section>

					<div className="flex flex-wrap items-center gap-2">
						<button className={smallActionClassName} disabled={busy || !duration} onClick={() => { void previewSelection(); }} type="button"><Play aria-hidden="true" size={13} /> Preview selected section</button>
						<button className={primaryButtonClassName} disabled={busy || !duration} onClick={() => { void trimVideo(); }} type="button"><Scissors aria-hidden="true" size={14} /> {busy ? "Trimming video…" : "Trim video"}</button>
					</div>

					{busy || status ? (
						<section aria-label="Trim progress" className="flex flex-col gap-2" role="status">
							<div className="flex items-center justify-between gap-3 text-xs text-muted"><span>{status}</span>{busy ? <span className="font-mono">{progress}%</span> : null}</div>
							<div aria-label="Trim progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="h-2 overflow-hidden border border-line bg-[#eeede7]" role="progressbar"><div className="h-full bg-[#263b34] transition-[width]" style={{ width: `${progress}%` }} /></div>
						</section>
					) : null}

					{output && outputUrl ? (
						<section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="video-trim-result-title">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h2 className="m-0 text-sm font-semibold text-ink" id="video-trim-result-title">Trimmed video · {formatTrimTime(trimLength)}</h2>
								<a className={smallActionClassName} download={videoTrimFileName(file.name)} href={outputUrl}><Download aria-hidden="true" size={13} /> Download MP4</a>
							</div>
							<video aria-label="Trimmed video preview" className="max-h-[430px] w-full border border-line bg-[#171916]" controls playsInline preload="metadata" src={outputUrl} />
							<p className={hintClassName}>{(output.size / (1024 * 1024)).toFixed(1)} MB · processed on this device.</p>
						</section>
					) : null}
				</>
			) : null}
		</ToolPanel>
	);
};
