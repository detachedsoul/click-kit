/** Keep the browser decode path honest: the output is PCM WAV, so no server or codec upload is involved. */
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MIN_SELECTION_SECONDS = 0.01;
export const PEAK_COUNT = 800;
export const AUDIO_ACCEPT = ".mp3,.wav,.m4a,.aac,.ogg,.oga,.opus,.flac,.webm,.mp4,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus,audio/flac,audio/webm";

const EXTENSION_TYPE: Record<string, string> = {
	aac: "AAC",
	flac: "FLAC",
	m4a: "M4A",
	mp3: "MP3",
	oga: "Ogg",
	ogg: "Ogg",
	opus: "Opus",
	wav: "WAV",
	webm: "WebM audio",
	mp4: "MP4 audio",
};

export const audioFileType = (file: Pick<File, "name" | "type">) => {
	const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
	return EXTENSION_TYPE[extension] ? { extension, label: EXTENSION_TYPE[extension] } : null;
};

export const validateAudioFile = (file: Pick<File, "name" | "type" | "size">) => {
	if (!audioFileType(file)) throw new Error("Choose an MP3, WAV, M4A, AAC, Ogg, Opus, FLAC, or WebM audio file.");
	if (file.size <= 0) throw new Error("That audio file is empty.");
	if (file.size > MAX_AUDIO_BYTES) throw new Error("Choose an audio file smaller than 100 MB so it can be decoded safely in this browser.");
};

export const formatAudioTime = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds - minutes * 60;
	return `${minutes}:${remainder.toFixed(2).padStart(5, "0")}`;
};

export type TrimRange = { start: number; end: number };

/** Keep a real, non-empty selection inside the decoded duration. */
export const clampTrimRange = (duration: number, start: number, end: number): TrimRange => {
	if (!Number.isFinite(duration) || duration <= 0) throw new Error("Audio duration must be greater than zero.");
	const minimum = Math.min(MIN_SELECTION_SECONDS, duration);
	const safeStart = Math.max(0, Math.min(duration - minimum, Number.isFinite(start) ? start : 0));
	const safeEnd = Math.max(safeStart + minimum, Math.min(duration, Number.isFinite(end) ? end : duration));
	return { start: safeStart, end: safeEnd };
};

/** Reduce all channel samples to a fixed count of peak bars for a compact waveform. */
export const waveformPeaks = (channels: readonly Float32Array[], count = PEAK_COUNT) => {
	if (!channels.length || count < 1) return [];
	const sampleCount = Math.min(...channels.map((channel) => channel.length));
	if (!sampleCount) return Array.from({ length: count }, () => 0);
	return Array.from({ length: count }, (_, index) => {
		const first = Math.floor((index * sampleCount) / count);
		const last = Math.max(first + 1, Math.floor(((index + 1) * sampleCount) / count));
		let peak = 0;
		for (const channel of channels) {
			for (let sample = first; sample < Math.min(last, channel.length); sample += 1) peak = Math.max(peak, Math.abs(channel[sample]));
		}
		return Math.min(1, peak);
	});
};

/** Encode a slice of a decoded AudioBuffer as browser-independent 16-bit PCM WAV. */
export const encodeTrimmedWav = (buffer: AudioBuffer, startSeconds: number, endSeconds: number) => {
	const { start, end } = clampTrimRange(buffer.duration, startSeconds, endSeconds);
	const firstFrame = Math.max(0, Math.floor(start * buffer.sampleRate));
	const lastFrame = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
	const frames = lastFrame - firstFrame;
	if (frames <= 0) throw new Error("Select a longer section of audio before exporting.");
	const channels = buffer.numberOfChannels;
	const bytesPerSample = 2;
	const dataBytes = frames * channels * bytesPerSample;
	const output = new ArrayBuffer(44 + dataBytes);
	const view = new DataView(output);
	const writeText = (offset: number, text: string) => {
		for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
	};
	writeText(0, "RIFF");
	view.setUint32(4, 36 + dataBytes, true);
	writeText(8, "WAVE");
	writeText(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, channels, true);
	view.setUint32(24, buffer.sampleRate, true);
	view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
	view.setUint16(32, channels * bytesPerSample, true);
	view.setUint16(34, 16, true);
	writeText(36, "data");
	view.setUint32(40, dataBytes, true);

	let offset = 44;
	for (let frame = firstFrame; frame < lastFrame; frame += 1) {
		for (let channel = 0; channel < channels; channel += 1) {
			const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame] ?? 0));
			view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
			offset += bytesPerSample;
		}
	}
	return new Blob([output], { type: "audio/wav" });
};
