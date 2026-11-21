"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, Radio, Square, Video } from "lucide-react";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, smallActionClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import { fileInputClassName, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { AUDIO_ACCEPT, audioFileType, formatAudioTime, MAX_AUDIO_BYTES, validateAudioFile } from "@/features/audio-tools/audio-trimmer-utils";

type VisualStyle = "waveform" | "bars" | "circle";
type BackgroundStyle = "solid" | "gradient" | "transparent";
type Resolution = "720p" | "1080p" | "1440p";
type AudioGraph = { context: AudioContext; analyser: AnalyserNode; source: MediaElementAudioSourceNode };

const RESOLUTIONS: Record<Resolution, { width: number; height: number }> = {
	"720p": { width: 1280, height: 720 },
	"1080p": { width: 1920, height: 1080 },
	"1440p": { width: 2560, height: 1440 },
};

const getRecorderMimeType = () => {
	if (typeof MediaRecorder === "undefined") return "";
	const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
	return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const safeStem = (name: string) => name.replace(/\.[^.]+$/u, "").replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "audio";

export const AudioVisualizer = () => {
	const audioRef = useRef<HTMLAudioElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const graphRef = useRef<AudioGraph | null>(null);
	const recorderRef = useRef<MediaRecorder | null>(null);
	const recordStreamsRef = useRef<MediaStream[]>([]);
	const recordDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const mountedRef = useRef(true);
	const recordingStartedAtRef = useRef(0);
	const [file, setFile] = useState<File | null>(null);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [recording, setRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
	const [recordedExtension, setRecordedExtension] = useState("webm");
	const [style, setStyle] = useState<VisualStyle>("waveform");
	const [foreground, setForeground] = useState("#79f2c0");
	const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>("solid");
	const [background, setBackground] = useState("#111a22");
	const [gradientEnd, setGradientEnd] = useState("#35254d");
	const [resolution, setResolution] = useState<Resolution>("1080p");
	const [error, setError] = useState("");
	const [status, setStatus] = useState("");

	const sourceUrl = useObjectUrl(file);
	const outputUrl = useObjectUrl(recordedVideo);
	const fileType = file ? audioFileType(file) : null;
	const canvasSize = RESOLUTIONS[resolution];

	const releaseRecordStreams = () => {
		for (const stream of recordStreamsRef.current) {
			for (const track of stream.getTracks()) track.stop();
		}
		recordStreamsRef.current = [];
		if (recordDestinationRef.current && graphRef.current) {
			try { graphRef.current.analyser.disconnect(recordDestinationRef.current); } catch { /* It may already be disconnected. */ }
		}
		recordDestinationRef.current = null;
	};

	const stopRecording = () => {
		const recorder = recorderRef.current;
		if (!recorder || recorder.state === "inactive") return;
		setStatus("Finishing your video…");
		try {
			recorder.stop();
		} catch {
			setError("The recording could not be stopped. Try again.");
			releaseRecordStreams();
			setRecording(false);
		}
	};

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			const recorder = recorderRef.current;
			if (recorder && recorder.state !== "inactive") {
				try { recorder.stop(); } catch { /* The browser is already closing the recording. */ }
			}
			releaseRecordStreams();
			if (graphRef.current) {
				graphRef.current.source.disconnect();
				graphRef.current.analyser.disconnect();
				void graphRef.current.context.close();
				graphRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!recording) return;
		const timer = window.setInterval(() => setRecordingTime((Date.now() - recordingStartedAtRef.current) / 1000), 250);
		return () => window.clearInterval(timer);
	}, [recording]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		let frame = 0;
		const timeData = new Uint8Array(graphRef.current?.analyser.fftSize ?? 2048);
		const frequencyData = new Uint8Array(graphRef.current?.analyser.frequencyBinCount ?? 1024);
		const { width, height } = canvasSize;

		const paintBackground = () => {
			if (backgroundStyle === "transparent") {
				context.clearRect(0, 0, width, height);
				return;
			}
			if (backgroundStyle === "gradient") {
				const gradient = context.createLinearGradient(0, 0, width, height);
				gradient.addColorStop(0, background);
				gradient.addColorStop(1, gradientEnd);
				context.fillStyle = gradient;
			} else context.fillStyle = background;
			context.fillRect(0, 0, width, height);
		};

		const draw = () => {
			const analyser = graphRef.current?.analyser;
			if (analyser) {
				analyser.getByteTimeDomainData(timeData);
				analyser.getByteFrequencyData(frequencyData);
			} else {
				timeData.fill(128);
				frequencyData.fill(0);
			}
			paintBackground();
			context.strokeStyle = foreground;
			context.fillStyle = foreground;
			context.lineWidth = Math.max(2, width / 640);
			context.lineCap = "round";
			context.lineJoin = "round";

			if (style === "waveform") {
				context.beginPath();
				for (let index = 0; index < timeData.length; index += 1) {
					const x = (index / (timeData.length - 1)) * width;
					const y = (timeData[index] / 255) * height;
					if (index === 0) context.moveTo(x, y);
					else context.lineTo(x, y);
				}
				context.stroke();
			} else if (style === "bars") {
				const count = 96;
				const gap = Math.max(2, width / 640);
				const barWidth = (width - gap * (count - 1)) / count;
				for (let index = 0; index < count; index += 1) {
					const dataIndex = Math.floor((index / count) * frequencyData.length);
					const amplitude = frequencyData[dataIndex] / 255;
					const barHeight = Math.max(height * 0.008, amplitude * height * 0.78);
					context.fillRect(index * (barWidth + gap), (height - barHeight) / 2, barWidth, barHeight);
				}
			} else {
				const centerX = width / 2;
				const centerY = height / 2;
				const baseRadius = Math.min(width, height) * 0.2;
				const maxLength = Math.min(width, height) * 0.22;
				context.beginPath();
				context.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
				context.stroke();
				const count = 144;
				for (let index = 0; index < count; index += 1) {
					const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
					const amplitude = frequencyData[Math.floor((index / count) * frequencyData.length)] / 255;
					const outerRadius = baseRadius + Math.max(2, amplitude * maxLength);
					context.beginPath();
					context.moveTo(centerX + Math.cos(angle) * baseRadius, centerY + Math.sin(angle) * baseRadius);
					context.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
					context.stroke();
				}
			}
			frame = window.requestAnimationFrame(draw);
		};

		frame = window.requestAnimationFrame(draw);
		return () => window.cancelAnimationFrame(frame);
	}, [background, backgroundStyle, canvasSize, file, foreground, gradientEnd, style]);

	const chooseFile = (nextFile: File | null) => {
		if (!nextFile) return;
		try {
			validateAudioFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Choose a supported audio file.");
			return;
		}
		audioRef.current?.pause();
		setFile(nextFile);
		setDuration(0);
		setCurrentTime(0);
		setPlaying(false);
		setRecordedVideo(null);
		setError("");
		setStatus("");
	};

	const ensureAudioGraph = (audio: HTMLAudioElement) => {
		if (graphRef.current) return graphRef.current;
		const AudioContextConstructor = window.AudioContext;
		if (!AudioContextConstructor) throw new Error("Audio playback analysis is not available in this browser.");
		const context = new AudioContextConstructor();
		const analyser = context.createAnalyser();
		analyser.fftSize = 2048;
		analyser.smoothingTimeConstant = 0.82;
		const source = context.createMediaElementSource(audio);
		source.connect(analyser);
		analyser.connect(context.destination);
		const graph = { context, analyser, source };
		graphRef.current = graph;
		return graph;
	};

	const togglePlayback = async () => {
		const audio = audioRef.current;
		if (!audio || !file) return;
		setError("");
		if (!audio.paused) {
			audio.pause();
			return;
		}
		try {
			const graph = ensureAudioGraph(audio);
			await graph.context.resume();
			if (audio.currentTime >= duration) audio.currentTime = 0;
			await audio.play();
		} catch {
			setError("This browser could not play that audio file.");
		}
	};

	const startRecording = async () => {
		const audio = audioRef.current;
		const canvas = canvasRef.current;
		if (!audio || !canvas || recording) return;
		setError("");
		setRecordedVideo(null);
		try {
			if (!window.MediaRecorder) throw new Error("Video recording is not available in this browser.");
			if (typeof canvas.captureStream !== "function") throw new Error("Canvas video capture is not available in this browser.");
			const graph = ensureAudioGraph(audio);
			await graph.context.resume();
			if (audio.paused) {
				if (audio.currentTime >= duration) audio.currentTime = 0;
				await audio.play();
			}
			const mimeType = getRecorderMimeType();
			if (!mimeType) throw new Error("This browser cannot record a video in a supported format.");
			const canvasStream = canvas.captureStream(30);
			const audioDestination = graph.context.createMediaStreamDestination();
			graph.analyser.connect(audioDestination);
			const recordingStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
			const recorder = new MediaRecorder(recordingStream, { mimeType });
			chunksRef.current = [];
			recordStreamsRef.current = [canvasStream, audioDestination.stream, recordingStream];
			recordDestinationRef.current = audioDestination;
			recorderRef.current = recorder;
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunksRef.current.push(event.data);
			};
			recorder.onerror = () => {
				if (mountedRef.current) setError("The browser could not finish recording this visualizer.");
				releaseRecordStreams();
				if (mountedRef.current) setRecording(false);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType });
				chunksRef.current = [];
				releaseRecordStreams();
				if (mountedRef.current) {
					if (blob.size) {
						setRecordedVideo(blob);
						setRecordedExtension((recorder.mimeType || mimeType).includes("mp4") ? "mp4" : "webm");
						setStatus("Video ready to preview and download.");
					} else setError("No video data was captured. Try recording again.");
					setRecording(false);
				}
			};
			recorder.start(250);
			recordingStartedAtRef.current = Date.now();
			setRecordingTime(0);
			setRecording(true);
			setStatus("Recording your visualizer…");
		} catch (caught) {
			releaseRecordStreams();
			setError(caught instanceof Error ? caught.message : "Could not start video recording.");
		}
	};

	const clearRecordedVideo = () => {
		setRecordedVideo(null);
		setStatus("");
	};

	const stem = safeStem(file?.name ?? "audio");

	return (
		<ToolPanel>
			<section className="flex flex-col gap-3" aria-labelledby="audio-visualizer-upload-title">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="audio-visualizer-upload-title">Choose an audio file</h2>
					<p className={`${hintClassName} mt-1`}>Play a song or recording and turn it into a moving waveform, bars, or circular display.</p>
				</div>
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="audio-visualizer-file">
					Audio file
					<input accept={AUDIO_ACCEPT} className={fileInputClassName} disabled={recording} id="audio-visualizer-file" onChange={(event) => { chooseFile(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ""; }} type="file" />
				</label>
				<p className={hintClassName}>MP3, WAV, M4A, AAC, Ogg, Opus, FLAC, or WebM · up to {Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MB. Your audio stays on this device.</p>
				{error ? <ErrorNote message={error} /> : null}
			</section>

			{file ? (
				<>
					<section aria-label="Audio details" className="flex flex-wrap items-center justify-between gap-2 border border-line bg-[#fbfaf7] px-3 py-2">
						<div className="min-w-0">
							<p className="m-0 truncate text-xs font-semibold text-ink">{file.name}</p>
							<p className="m-0 mt-1 text-[11px] text-muted">{fileType?.label ?? "Audio"} · {(file.size / (1024 * 1024)).toFixed(1)} MB</p>
						</div>
						<span className="shrink-0 font-mono text-xs text-muted">{duration ? formatAudioTime(duration) : "Reading audio…"}</span>
					</section>

					<audio
						aria-hidden="true"
						className="sr-only"
						preload="metadata"
						ref={audioRef}
						src={sourceUrl}
						onError={() => setError("This browser could not read that audio file. Try another format.")}
						onLoadedMetadata={(event) => {
							const mediaDuration = event.currentTarget.duration;
							if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration);
							else setError("This audio file does not have a usable duration.");
						}}
						onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
						onPlay={() => setPlaying(true)}
						onPause={() => setPlaying(false)}
						onEnded={() => { setPlaying(false); if (recording) stopRecording(); }}
					/>

					<section className="flex flex-col gap-3" aria-labelledby="audio-visualizer-preview-title">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<h2 className="m-0 text-sm font-semibold text-ink" id="audio-visualizer-preview-title">Visualizer preview</h2>
							<span className="font-mono text-[11px] text-muted">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
						</div>
						<canvas
							aria-label={`${style === "waveform" ? "Waveform" : style === "bars" ? "Frequency bars" : "Circular visualizer"} preview`}
							className="block h-auto max-h-[480px] w-full border border-line bg-[#111a22]"
							height={canvasSize.height}
							ref={canvasRef}
							role="img"
							width={canvasSize.width}
						/>
						<label className={labelClassName} htmlFor="audio-visualizer-seek">Audio position
							<input className="mt-2 block h-8 w-full cursor-pointer accent-[#263b34]" disabled={!duration} id="audio-visualizer-seek" max={duration || 1} min={0} onChange={(event) => {
							const time = Number(event.target.value);
							setCurrentTime(time);
							if (audioRef.current) audioRef.current.currentTime = time;
						}} step="0.01" type="range" value={Math.min(currentTime, duration || 0)} />
						</label>
						<div className="flex flex-wrap items-center gap-2">
							<button className={primaryButtonClassName} disabled={!duration || recording} onClick={() => { void togglePlayback(); }} type="button">
								{playing ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}{playing ? "Pause" : "Play audio"}
							</button>
							<button className={smallActionClassName} disabled={!duration} onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); } }} type="button">Restart</button>
						</div>
					</section>

					<section className="grid gap-3 sm:grid-cols-2" aria-label="Visualizer appearance">
						<label className={labelClassName} htmlFor="audio-visualizer-style">Style
							<select className={selectClassName} disabled={recording} id="audio-visualizer-style" onChange={(event) => { setStyle(event.target.value as VisualStyle); clearRecordedVideo(); }} value={style}>
								<option value="waveform">Waveform</option>
								<option value="bars">Frequency bars</option>
								<option value="circle">Circular</option>
							</select>
						</label>
						<label className={labelClassName} htmlFor="audio-visualizer-background-style">Background
							<select className={selectClassName} disabled={recording} id="audio-visualizer-background-style" onChange={(event) => { setBackgroundStyle(event.target.value as BackgroundStyle); clearRecordedVideo(); }} value={backgroundStyle}>
								<option value="solid">Solid colour</option>
								<option value="gradient">Gradient</option>
								<option value="transparent">Transparent</option>
							</select>
						</label>
						<label className={labelClassName} htmlFor="audio-visualizer-colour">Visualizer colour
							<input className="mt-2 block h-11 w-full cursor-pointer border border-field bg-surface p-1" disabled={recording} id="audio-visualizer-colour" onChange={(event) => { setForeground(event.target.value); clearRecordedVideo(); }} type="color" value={foreground} />
						</label>
						{backgroundStyle !== "transparent" ? (
							<label className={labelClassName} htmlFor="audio-visualizer-background-colour">{backgroundStyle === "gradient" ? "Gradient start" : "Background colour"}
								<input className="mt-2 block h-11 w-full cursor-pointer border border-field bg-surface p-1" disabled={recording} id="audio-visualizer-background-colour" onChange={(event) => { setBackground(event.target.value); clearRecordedVideo(); }} type="color" value={background} />
							</label>
						) : null}
						{backgroundStyle === "gradient" ? (
							<label className={labelClassName} htmlFor="audio-visualizer-gradient-end">Gradient end
								<input className="mt-2 block h-11 w-full cursor-pointer border border-field bg-surface p-1" disabled={recording} id="audio-visualizer-gradient-end" onChange={(event) => { setGradientEnd(event.target.value); clearRecordedVideo(); }} type="color" value={gradientEnd} />
							</label>
						) : null}
						<label className={labelClassName} htmlFor="audio-visualizer-resolution">Recording size
							<select className={selectClassName} disabled={recording} id="audio-visualizer-resolution" onChange={(event) => { setResolution(event.target.value as Resolution); clearRecordedVideo(); }} value={resolution}>
								{(Object.keys(RESOLUTIONS) as Resolution[]).map((size) => <option key={size} value={size}>{size} · {RESOLUTIONS[size].width} × {RESOLUTIONS[size].height}</option>)}
							</select>
						</label>
					</section>

					<div className="flex flex-wrap items-center gap-2">
						{recording ? (
							<button className={smallActionClassName} onClick={stopRecording} type="button"><Square aria-hidden="true" size={13} /> Stop and save · {formatAudioTime(recordingTime)}</button>
						) : (
							<button className={primaryButtonClassName} disabled={!duration} onClick={() => { void startRecording(); }} type="button"><Video aria-hidden="true" size={14} /> Record video</button>
						)}
						{status ? <p className="m-0 text-xs text-muted" role="status">{status}</p> : null}
					</div>

					{recordedVideo && outputUrl ? (
						<section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby="audio-visualizer-result-title">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h2 className="m-0 text-sm font-semibold text-ink" id="audio-visualizer-result-title">Your visualizer video</h2>
								<a className={smallActionClassName} download={`${stem}-visualizer.${recordedExtension}`} href={outputUrl}><Download aria-hidden="true" size={13} /> Download {recordedExtension.toUpperCase()}</a>
							</div>
							<video aria-label="Recorded audio visualizer" className="max-h-[480px] w-full border border-line bg-[#111a22]" controls playsInline preload="metadata" src={outputUrl} />
							<p className={hintClassName}>{recordedExtension.toUpperCase()} · {recordedVideo.size ? `${(recordedVideo.size / (1024 * 1024)).toFixed(1)} MB` : ""}</p>
						</section>
					) : null}
				</>
			) : (
				<p className="m-0 flex items-center gap-2 border border-dashed border-line p-4 text-xs leading-relaxed text-muted"><Radio aria-hidden="true" className="shrink-0 text-forest" size={16} /> Choose an audio file to see and record its visualizer.</p>
			)}
		</ToolPanel>
	);
};
