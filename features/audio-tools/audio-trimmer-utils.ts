/** The source and both output encoders stay on-device; no audio is uploaded to a server. */
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MIN_SELECTION_SECONDS = 0.01;
export const PEAK_COUNT = 800;
export const MP3_BITRATES = [128, 192, 256, 320] as const;
export type Mp3Bitrate = (typeof MP3_BITRATES)[number];
export const MAX_MP3_BYTES = 100 * 1024 * 1024;
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
	if (dataBytes > 0xffff_ffff - 36) throw new Error("That WAV selection is too large. Choose a shorter section or export it as MP3.");
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

/**
 * MP3 is encoded entirely in JS so exporting does not need a server or FFmpeg runtime.
 * If an AudioBuffer uses an unusual rate, linearly resample it to 44.1 kHz, which LAME supports.
 */
export const encodeTrimmedMp3 = async (buffer: AudioBuffer, startSeconds: number, endSeconds: number, bitrate: Mp3Bitrate) => {
	const { start, end } = clampTrimRange(buffer.duration, startSeconds, endSeconds);
	const inputStart = Math.max(0, Math.floor(start * buffer.sampleRate));
	const inputEnd = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
	const inputFrames = inputEnd - inputStart;
	if (inputFrames <= 0) throw new Error("Select a longer section of audio before exporting.");

	const supportedRates = new Set([8_000, 11_025, 12_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000]);
	const sampleRate = supportedRates.has(buffer.sampleRate) ? buffer.sampleRate : 44_100;
	const ratio = buffer.sampleRate / sampleRate;
	const outputFrames = Math.ceil(inputFrames / ratio);
	const estimate = Math.ceil((outputFrames / sampleRate) * bitrate * 1_000 / 8);
	if (estimate > MAX_MP3_BYTES) throw new Error("That MP3 would exceed 100 MB. Choose a shorter section or a lower bitrate.");

	const { Mp3Encoder } = await import("@breezystack/lamejs");
	const sourceChannels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
	const channels = buffer.numberOfChannels === 1 ? 1 : 2;
	const encoder = new Mp3Encoder(channels, sampleRate, bitrate);
	const blocks: Uint8Array[] = [];
	const blockSize = 1_152;
	const toInt16 = (value: number) => {
		const sample = Math.max(-1, Math.min(1, value));
		return sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
	};

	for (let firstOutput = 0; firstOutput < outputFrames; firstOutput += blockSize) {
		const count = Math.min(blockSize, outputFrames - firstOutput);
		const left = new Int16Array(count);
		const right = channels === 2 ? new Int16Array(count) : undefined;
		for (let index = 0; index < count; index += 1) {
			const sourcePosition = inputStart + (firstOutput + index) * ratio;
			const floor = Math.min(inputEnd - 1, Math.floor(sourcePosition));
			const ceil = Math.min(inputEnd - 1, floor + 1);
			const fraction = sourcePosition - floor;
			const sampleAt = (channel: number) => {
				const data = sourceChannels[channel];
				return (data[floor] ?? 0) * (1 - fraction) + (data[ceil] ?? 0) * fraction;
			};
			const mix = (outputChannel: number) => {
				if (buffer.numberOfChannels <= 2) return sampleAt(outputChannel);
				let sum = 0;
				let count = 0;
				for (let channel = outputChannel; channel < buffer.numberOfChannels; channel += 2) {
					sum += sampleAt(channel);
					count += 1;
				}
				return count ? sum / count : 0;
			};
			left[index] = toInt16(mix(0));
			if (right) right[index] = toInt16(mix(1));
		}
		const encoded = encoder.encodeBuffer(left, right);
		if (encoded.length) blocks.push(encoded);
	}
	const tail = encoder.flush();
	if (tail.length) blocks.push(tail);
	if (!blocks.length) throw new Error("The MP3 encoder did not produce audio. Try WAV instead.");
	return new Blob(blocks.map((block) => new Uint8Array(block).buffer), { type: "audio/mpeg" });
};
