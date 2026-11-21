"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Archive, Camera, Download, Film, Images, Trash2 } from "lucide-react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, rowButtonClassName, selectClassName, smallActionClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import { FileDownloadLink, fileInputClassName, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { createZip } from "@/features/image-tools/zip-utils";
import {
	FRAME_FORMATS,
	frameFileName,
	frameTimes,
	formatMediaTime,
	MAX_FRAME_COUNT,
	MAX_VIDEO_BYTES,
	validateVideoFile,
	type FrameFormat,
	VIDEO_ACCEPT,
} from "@/features/video-tools/video-extractor-utils";

type FrameShot = { blob: Blob; fileName: string; height: number; id: string; time: number; url: string; width: number };

const seekVideo = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve, reject) => {
	const alreadyThere = Math.abs(video.currentTime - time) < 0.001;
	if (alreadyThere && video.readyState >= 2) {
		resolve();
		return;
	}
	const readyEvent = alreadyThere ? "loadeddata" : "seeked";
	let timeout = 0;
	const cleanup = () => {
		window.clearTimeout(timeout);
		video.removeEventListener(readyEvent, onReady);
		video.removeEventListener("error", onError);
	};
	const onReady = () => { cleanup(); resolve(); };
	const onError = () => { cleanup(); reject(new Error("The video could not seek to that frame.")); };
	video.addEventListener(readyEvent, onReady, { once: true });
	video.addEventListener("error", onError, { once: true });
	timeout = window.setTimeout(() => { cleanup(); reject(new Error("Seeking took too long. Try another video format.")); }, 10_000);
	if (alreadyThere) return;
	try {
		video.currentTime = time;
	} catch {
		cleanup();
		reject(new Error("The video could not seek to that frame."));
	}
});

const canvasFrame = (video: HTMLVideoElement, format: FrameFormat, quality: number) => new Promise<Blob>((resolve, reject) => {
	if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
		reject(new Error("Wait until a video frame is ready, then try again."));
		return;
	}
	const canvas = document.createElement("canvas");
	canvas.width = video.videoWidth;
	canvas.height = video.videoHeight;
	const context = canvas.getContext("2d");
	if (!context) {
		reject(new Error("Canvas capture is not available in this browser."));
		return;
	}
	context.drawImage(video, 0, 0, canvas.width, canvas.height);
	canvas.toBlob((blob) => {
		if (!blob) {
			reject(new Error("This browser could not encode the still image."));
			return;
		}
		if (blob.type !== format) {
			reject(new Error(`${format.replace("image/", "").toUpperCase()} output is not supported by this browser. Choose PNG or JPEG instead.`));
			return;
		}
		resolve(blob);
	}, format, format === "image/png" ? undefined : quality / 100);
});

export const VideoFrameExtractor = () => {
	const videoRef = useRef<HTMLVideoElement>(null);
	const frameRef = useRef<FrameShot[]>([]);
	const [file, setFile] = useState<File | null>(null);
	const [duration, setDuration] = useState(0);
	const [width, setWidth] = useState(0);
	const [height, setHeight] = useState(0);
	const [current, setCurrent] = useState(0);
	const [interval, setInterval] = useState("5");
	const [format, setFormat] = useState<FrameFormat>("image/jpeg");
	const [quality, setQuality] = useState(90);
	const [frames, setFrames] = useState<FrameShot[]>([]);
	const [zipBlob, setZipBlob] = useState<Blob | null>(null);
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState("");
	const videoUrl = useObjectUrl(file);
	const zipUrl = useObjectUrl(zipBlob);
	const stem = file?.name.replace(/\.[^.]+$/u, "").replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "video";

	useEffect(() => () => {
		for (const frame of frameRef.current) URL.revokeObjectURL(frame.url);
	}, []);

	const clearFrames = () => {
		for (const frame of frameRef.current) URL.revokeObjectURL(frame.url);
		frameRef.current = [];
		setFrames([]);
		setZipBlob(null);
	};

	const chooseFile = (nextFile: File | null) => {
		setError("");
		setProgress("");
		if (!nextFile) return;
		try {
			validateVideoFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Choose a supported video file.");
			return;
		}
		videoRef.current?.pause();
		clearFrames();
		setFile(nextFile);
		setDuration(0);
		setCurrent(0);
		setWidth(0);
		setHeight(0);
	};

	const onMetadata = () => {
		const video = videoRef.current;
		if (!video) return;
		if (!Number.isFinite(video.duration) || video.duration <= 0) {
			setError("This video does not have a seekable duration.");
			return;
		}
		setDuration(video.duration);
		setWidth(video.videoWidth);
		setHeight(video.videoHeight);
		setCurrent(video.currentTime);
		setError("");
	};

	const appendShots = (created: Omit<FrameShot, "id" | "url">[]) => {
		const additions = created.map((shot, index) => ({ ...shot, id: `${Date.now()}-${frameRef.current.length + index}`, url: URL.createObjectURL(shot.blob) }));
		const next = [...frameRef.current, ...additions];
		frameRef.current = next;
		setFrames(next);
		setZipBlob(null);
	};

	const snapshotAt = async (time: number, index: number) => {
		const video = videoRef.current;
		if (!video || !file) throw new Error("Choose a video first.");
		const blob = await canvasFrame(video, format, quality);
		return { blob, fileName: frameFileName(file.name, index, time, format), height: video.videoHeight, time, width: video.videoWidth };
	};

	const captureCurrent = async () => {
		const video = videoRef.current;
		if (!video || !duration) return;
		setError("");
		setBusy(true);
		try {
			const shot = await snapshotAt(video.currentTime, frames.length + 1);
			appendShots([shot]);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not capture this frame.");
		} finally {
			setBusy(false);
		}
	};

	const extractInterval = async () => {
		const video = videoRef.current;
		if (!video || !duration || !file) return;
		setError("");
		setZipBlob(null);
		let times: number[];
		try {
			times = frameTimes(duration, Number(interval), MAX_FRAME_COUNT - frames.length);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Choose a valid frame interval.");
			return;
		}
		setBusy(true);
		const wasPlaying = !video.paused;
		const originalTime = video.currentTime;
		video.pause();
		const created: Omit<FrameShot, "id" | "url">[] = [];
		try {
			for (const [index, time] of times.entries()) {
				setProgress(`Extracting frame ${index + 1} of ${times.length}…`);
				await seekVideo(video, time);
				created.push(await snapshotAt(time, frames.length + index + 1));
				setCurrent(time);
			}
			appendShots(created);
			setProgress(`${created.length} frames extracted.`);
		} catch (caught) {
			if (created.length) appendShots(created);
			setProgress(created.length ? `${created.length} frames extracted before the error.` : "");
			setError(caught instanceof Error ? caught.message : "Could not extract these frames.");
		} finally {
			try {
				await seekVideo(video, originalTime);
				setCurrent(originalTime);
			} catch {
				// Keep the extracted frames even if the source cannot seek back to its old position.
			}
			if (wasPlaying) void video.play().catch(() => undefined);
			setBusy(false);
		}
	};

	const downloadAll = async () => {
		if (!frames.length) return;
		setError("");
		setBusy(true);
		setProgress("Building a ZIP of the extracted frames…");
		try {
			const entries = await Promise.all(frames.map(async (frame) => ({ name: frame.fileName, data: new Uint8Array(await frame.blob.arrayBuffer()) })));
			const bytes = await createZip(entries, { compress: false });
			setZipBlob(new Blob([bytes.slice().buffer], { type: "application/zip" }));
			setProgress(`${frames.length} frames packed into a ZIP.`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the ZIP archive.");
			setProgress("");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<section className="flex flex-col gap-3" aria-labelledby="video-upload-heading">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="video-upload-heading">Choose a video</h2>
					<p className={`${hintClassName} mt-1`}>MP4, MOV, WebM, and other formats your browser can play. The video stays on this device.</p>
				</div>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="frame-video-file">
					Video file
					<input accept={VIDEO_ACCEPT} className={fileInputClassName} disabled={busy} id="frame-video-file" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} type="file" />
				</label>
				<p className={hintClassName}>Files up to {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB. Video and still-image format support depends on this browser.</p>
				{error ? <ErrorNote message={error} /> : null}
			</section>

			{file ? (
				<>
					<section className="flex flex-col gap-3" aria-label="Video preview">
						<video className="max-h-[430px] w-full border border-line bg-[#171916]" controls playsInline preload="metadata" ref={videoRef} src={videoUrl} onError={() => setError("This browser could not play that video. Try an MP4, MOV, or WebM file encoded with a browser-supported codec.")} onLoadedMetadata={onMetadata} onDurationChange={onMetadata} onTimeUpdate={() => { if (videoRef.current) setCurrent(videoRef.current.currentTime); }} />
						{duration > 0 ? (
							<>
								<div className="flex items-center justify-between gap-3 text-xs text-muted">
									<span className="truncate font-medium text-ink">{file.name}</span>
									<span className="shrink-0 font-mono">{width} × {height} · {formatMediaTime(current)} / {formatMediaTime(duration)}</span>
								</div>
								<label className={labelClassName} htmlFor="video-timeline">Scrub timeline
									<input className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]" id="video-timeline" max={duration} min={0} onChange={(event) => { const time = Number(event.target.value); setCurrent(time); if (videoRef.current) videoRef.current.currentTime = time; }} step="0.01" type="range" value={current} />
								</label>
							</>
						) : <p className="m-0 text-xs text-muted">Loading video metadata…</p>}
					</section>

					{duration > 0 ? (
						<>
							<section className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2" aria-label="Frame output options">
								<label className={labelClassName} htmlFor="frame-format">Still-image format
									<select className={selectClassName} id="frame-format" onChange={(event) => { setFormat(event.target.value as FrameFormat); setZipBlob(null); }} value={format}>
										{FRAME_FORMATS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
									</select>
								</label>
								<label className={`${labelClassName} ${format === "image/png" ? "text-muted" : ""}`} htmlFor="frame-quality">Image quality · {quality}%
									<input className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]" disabled={format === "image/png"} id="frame-quality" max={100} min={40} onChange={(event) => setQuality(Number(event.target.value))} step={1} type="range" value={quality} />
								</label>
							</section>

							<div className="flex flex-wrap items-center gap-2">
								<button className={rowButtonClassName} disabled={busy || frames.length >= MAX_FRAME_COUNT} onClick={() => { void captureCurrent(); }} type="button"><Camera aria-hidden="true" size={13} /> Capture this frame</button>
								<span className={hintClassName}>{frames.length} of {MAX_FRAME_COUNT} frames kept · {width} × {height}</span>
							</div>

							<section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="frame-interval-heading">
								<div>
									<h2 className="m-0 text-sm font-semibold text-ink" id="frame-interval-heading">Extract frames at intervals</h2>
									<p className={`${hintClassName} mt-1`}>Start at the beginning and capture every chosen number of seconds, up to {MAX_FRAME_COUNT} frames total.</p>
								</div>
								<div className="flex flex-wrap items-end gap-2">
									<label className={`${labelClassName} w-full max-w-44`} htmlFor="frame-interval">Every (seconds)
										<input className={fieldClassName} id="frame-interval" max={duration} min={0.1} onChange={(event) => setInterval(event.target.value)} step="0.1" type="number" value={interval} />
									</label>
									<button className={rowButtonClassName} disabled={busy || frames.length >= MAX_FRAME_COUNT} onClick={() => { void extractInterval(); }} type="button"><Images aria-hidden="true" size={13} /> Extract frames</button>
								</div>
							</section>

							{busy || progress ? <p className="m-0 text-xs text-muted" role="status">{progress || "Working…"}</p> : null}
							{frames.length ? (
								<section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="extracted-frames-heading">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<h2 className="m-0 text-sm font-semibold text-ink" id="extracted-frames-heading">Extracted frames</h2>
											<p className={`${hintClassName} mt-1`}>{frames.length} image{frames.length === 1 ? "" : "s"} · format shown in each filename · {width} × {height}</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<button className={smallActionClassName} disabled={busy} onClick={() => { void downloadAll(); }} type="button"><Archive aria-hidden="true" size={13} /> Build ZIP</button>
											<button aria-label="Clear extracted frames" className={smallActionClassName} disabled={busy} onClick={clearFrames} type="button"><Trash2 aria-hidden="true" size={13} /> Clear</button>
										</div>
									</div>
									{zipUrl ? <FileDownloadLink fileName={`${stem}-frames.zip`} label="Download all frames (.zip)" url={zipUrl} /> : null}
									<ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
										{frames.map((frame) => (
											<li className="flex min-w-0 gap-3 border border-line bg-[#fbfaf7] p-2" key={frame.id}>
												<Image alt={`Frame at ${formatMediaTime(frame.time)}`} className="h-16 w-24 shrink-0 bg-[#171916] object-contain" height={90} src={frame.url} unoptimized width={160} />
												<div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
													<p className="m-0 text-[11px] text-ink">{formatMediaTime(frame.time)} · {frame.width} × {frame.height}</p>
													<a className={smallActionClassName} download={frame.fileName} href={frame.url}><Download aria-hidden="true" size={12} /> Download</a>
												</div>
											</li>
										))}
									</ul>
								</section>
							) : null}
						</>
					) : null}
				</>
			) : (
				<p className="m-0 flex items-center gap-2 border border-dashed border-line p-4 text-xs leading-relaxed text-muted"><Film aria-hidden="true" className="shrink-0 text-forest" size={16} /> Upload a video to scrub its timeline, capture a still, or extract a set of frames at regular intervals.</p>
			)}
		</ToolPanel>
	);
};
