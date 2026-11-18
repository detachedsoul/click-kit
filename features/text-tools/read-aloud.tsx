"use client";

import { SelectField } from "@/components/select-field";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LockKeyhole, Pause, Play, RotateCcw, Square, Volume2, RefreshCw } from "lucide-react";
import { countGraphemes } from "@/features/text-tools/text-utils";

type SpeechSnapshot = {
	supported: boolean;
	voices: SpeechSynthesisVoice[];
};

const emptySpeechSnapshot: SpeechSnapshot = { supported: false, voices: [] };
const maximumSpeechSegmentLength = 1600;
let speechSnapshot = emptySpeechSnapshot;

const speechSubscribers = new Set<() => void>();
const getSpeechSnapshot = () => speechSnapshot;
const getServerSpeechSnapshot = () => emptySpeechSnapshot;

const refreshSpeechSnapshot = () => {
	if (typeof window === "undefined" || !window.speechSynthesis) return;
	speechSnapshot = { supported: true, voices: window.speechSynthesis.getVoices() };
	speechSubscribers.forEach((subscriber) => subscriber());
};

const subscribeToSpeech = (onStoreChange: () => void) => {
	if (typeof window === "undefined" || !window.speechSynthesis) return () => undefined;
	const synthesis = window.speechSynthesis;
	speechSubscribers.add(onStoreChange);
	synthesis.addEventListener("voiceschanged", refreshSpeechSnapshot);
	refreshSpeechSnapshot();
	return () => {
		speechSubscribers.delete(onStoreChange);
		synthesis.removeEventListener("voiceschanged", refreshSpeechSnapshot);
	};
};

const splitLongSpeechSegment = (segment: string) => {
	const chunks: string[] = [];
	let remainingText = segment;
	while (remainingText.length > maximumSpeechSegmentLength) {
		const wordBoundary = remainingText.lastIndexOf(" ", maximumSpeechSegmentLength);
		const chunkEnd = wordBoundary > maximumSpeechSegmentLength / 2 ? wordBoundary + 1 : maximumSpeechSegmentLength;
		chunks.push(remainingText.slice(0, chunkEnd));
		remainingText = remainingText.slice(chunkEnd);
	}
	if (remainingText) chunks.push(remainingText);
	return chunks;
};

const splitSpeechText = (text: string) => {
	if (!text) return [];
	const sentences = typeof Intl.Segmenter === "undefined"
		? [text]
		: Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text), ({ segment }) => segment);
	return sentences.flatMap(splitLongSpeechSegment);
};

const ReadAloud = () => {
	const [text, setText] = useState("");
	const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
	const [selectedVoiceName, setSelectedVoiceName] = useState("");
	const [rate, setRate] = useState(1);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isPreviewing, setIsPreviewing] = useState(false);
	const [message, setMessage] = useState("");
	const activeUtteranceId = useRef(0);
	const speechChunks = useRef<string[]>([]);
	const { supported: isSupported, voices } = useSyncExternalStore(subscribeToSpeech, getSpeechSnapshot, getServerSpeechSnapshot);
	const speechSettings = useRef({ rate, voiceURI: selectedVoiceURI, voices });
	const selectedVoice = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
	const voiceUnavailable = selectedVoiceURI !== "" && !selectedVoice;

	useEffect(() => {
		if (!isSupported) return;
		return () => {
			activeUtteranceId.current += 1;
			window.speechSynthesis?.cancel();
		};
	}, [isSupported]);

	useEffect(() => {
		speechSettings.current = { rate, voiceURI: selectedVoiceURI, voices };
	}, [rate, selectedVoiceURI, voices]);

	const speakSegment = (segmentIndex: number, utteranceId: number) => {
		if (activeUtteranceId.current !== utteranceId) return;
		const synthesis = window.speechSynthesis;
		if (!synthesis) return;
		const textSegment = speechChunks.current[segmentIndex];
		if (!textSegment) {
			setIsSpeaking(false);
			setIsPaused(false);
			return;
		}

		const currentSettings = speechSettings.current;
		const voice = currentSettings.voices.find((item) => item.voiceURI === currentSettings.voiceURI);
		if (currentSettings.voiceURI && !voice) {
			setIsSpeaking(false);
			setIsPaused(false);
			setMessage("The selected voice/language is no longer available. Refresh voices or choose System default.");
			return;
		}

		const utterance = new SpeechSynthesisUtterance(textSegment);
		if (voice) utterance.voice = voice;
		utterance.rate = currentSettings.rate;
		utterance.onstart = () => {
			if (activeUtteranceId.current !== utteranceId) return;
			setIsSpeaking(true);
			setMessage("");
		};
		utterance.onend = () => {
			if (activeUtteranceId.current !== utteranceId) return;
			if (segmentIndex + 1 < speechChunks.current.length) {
				speakSegment(segmentIndex + 1, utteranceId);
				return;
			}
			setIsSpeaking(false);
			setIsPaused(false);
		};
		utterance.onerror = (event) => {
			if (activeUtteranceId.current !== utteranceId || event.error === "canceled" || event.error === "interrupted") return;
			setIsSpeaking(false);
			setIsPaused(false);
			const voiceLabel = voice ? `${voice.name} (${voice.lang})` : "System default voice";
			setMessage(`Could not play ${voiceLabel} (${event.error}). Test another voice or try System default.`);
		};
		synthesis.speak(utterance);
	};

	const startReading = () => {
		if (!text.trim() || !isSupported || isPreviewing) return;
		const synthesis = window.speechSynthesis;
		if (!synthesis) return;
		if (selectedVoiceURI && !voices.some((voice) => voice.voiceURI === selectedVoiceURI)) {
			setMessage("The selected voice/language is no longer available. Refresh voices or choose System default.");
			return;
		}

		speechChunks.current = splitSpeechText(text);
		activeUtteranceId.current += 1;
		const utteranceId = activeUtteranceId.current;
		synthesis.cancel();
		setIsSpeaking(true);
		setIsPaused(false);
		setMessage("");
		speakSegment(0, utteranceId);
	};

	const handleVoiceChange = (voiceURI: string) => {
		if (isPreviewing) return;
		const voice = voices.find((item) => item.voiceURI === voiceURI);
		speechSettings.current = { ...speechSettings.current, voiceURI, voices };
		setSelectedVoiceURI(voiceURI);
		setSelectedVoiceName(voice ? `${voice.name} · ${voice.lang}` : "");
		setMessage(isSpeaking ? "Your new voice will be used at the next speech segment." : "");
	};

	const handleRateChange = (nextRate: number) => {
		if (isPreviewing) return;
		speechSettings.current = { ...speechSettings.current, rate: nextRate };
		setRate(nextRate);
		setMessage(isSpeaking ? "Your new speed will be used at the next speech segment." : "");
	};

	const refreshVoices = () => {
		if (isPreviewing) return;
		refreshSpeechSnapshot();
		const currentVoices = window.speechSynthesis?.getVoices();
		if (!currentVoices) return;
		speechSettings.current = { ...speechSettings.current, voices: currentVoices };
		setMessage(currentVoices.length > 0
			? `Voice list refreshed: ${currentVoices.length} voice${currentVoices.length === 1 ? "" : "s"} found. Test a voice before using it.`
			: "Your browser reports no installed voices right now. Try refreshing again or use System default.");
	};

	const testVoice = () => {
		if (!isSupported || isSpeaking || isPreviewing) return;
		const synthesis = window.speechSynthesis;
		if (!synthesis) return;
		const voice = voices.find((item) => item.voiceURI === selectedVoiceURI);
		if (selectedVoiceURI && !voice) {
			setMessage("The selected voice/language is no longer available. Refresh voices or choose System default.");
			return;
		}

		activeUtteranceId.current += 1;
		const previewId = activeUtteranceId.current;
		const utterance = new SpeechSynthesisUtterance("This is a short sample of the selected voice.");
		if (voice) utterance.voice = voice;
		utterance.rate = rate;
		const voiceLabel = voice ? `${voice.name} (${voice.lang})` : "System default voice";
		utterance.onend = () => {
			if (activeUtteranceId.current !== previewId) return;
			setIsPreviewing(false);
			setMessage(`${voiceLabel} preview finished.`);
		};
		utterance.onerror = (event) => {
			if (activeUtteranceId.current !== previewId || event.error === "canceled" || event.error === "interrupted") return;
			setIsPreviewing(false);
			setMessage(`Could not play ${voiceLabel} (${event.error}). Try another voice or System default.`);
		};

		synthesis.cancel();
		setIsPreviewing(true);
		setMessage(`Testing ${voiceLabel}…`);
		synthesis.speak(utterance);
	};

	const togglePause = () => {
		const synthesis = window.speechSynthesis;
		if (!synthesis || !isSpeaking) return;

		if (isPaused) {
			synthesis.resume();
			setIsPaused(false);
		} else {
			synthesis.pause();
			setIsPaused(true);
		}
	};

	const stopReading = () => {
		activeUtteranceId.current += 1;
		window.speechSynthesis?.cancel();
		setIsSpeaking(false);
		setIsPaused(false);
		setIsPreviewing(false);
	};

	const handleTextChange = (nextText: string) => {
		setText(nextText);
		setMessage("");
		if (isSpeaking || isPreviewing) stopReading();
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5 max-[520px]:pb-4">
				<div>
					<p className="mb-1.5 font-mono text-[10px] uppercase tracking-[.08em] text-accent-dark">Listen to your words</p>
					<h2 className="m-0 font-serif text-[30px] font-normal leading-none tracking-[-.025em] max-[520px]:text-[26px]">Give your text a voice.</h2>
				</div>
				<div className="inline-flex items-center gap-2 border border-[#d9e1d2] bg-[#f0f3ec] px-2.5 py-[7px] text-[11px] leading-[1.45] text-[#4d6250]">
					<LockKeyhole className="shrink-0" size={14} aria-hidden="true" /><span>Speech is generated on your device.</span>
				</div>
			</div>

			{!isSupported && <p className="m-0 border-l-[3px] border-[#b78b42] bg-[#f8f2e2] px-3 py-2.5 text-xs leading-[1.5] text-[#61502b]" role="status">
				Your browser does not support built-in text-to-speech. Try a recent version of Chrome, Safari, Firefox, or Edge.
			</p>}

			<div className="border border-line bg-[#f8f7f3] p-[13px]">
				<div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center bg-[#e9e4d8] font-mono text-[10px] text-[#5c5a4f]">01</span><span className="font-mono text-[10px] uppercase tracking-[.06em] text-[#77786f]">Your script</span></div>
				<div className="min-w-0">
					<div className="mb-2 flex items-baseline justify-between gap-3">
						<label className="text-xs font-semibold text-[#3c3d37]" htmlFor="read-aloud-input">Text to read aloud</label>
						<span className="font-mono text-[10px] text-[#92928a]">{countGraphemes(text).toLocaleString()} characters</span>
					</div>
					<textarea
						id="read-aloud-input"
						className="block min-h-[220px] w-full resize-y border border-[#d9d7cd] bg-surface px-4 py-[15px] text-sm leading-[1.72] text-ink outline-2 outline-offset-2 outline-transparent transition-[border-color,outline-color] placeholder:text-[#96958c] focus:border-accent focus:outline-accent max-[520px]:min-h-[170px] max-[520px]:px-[11px] max-[520px]:py-[11px] max-[520px]:text-xs"
						value={text}
						onChange={(event) => handleTextChange(event.target.value)}
						placeholder="Paste an article, a paragraph, or a few sentences…"
						aria-describedby="read-aloud-hint"
					/>
					<p id="read-aloud-hint" className="mb-0 mt-[7px] text-[11px] leading-[1.5] text-muted">Paste as much as you like. Nothing is uploaded.</p>
				</div>
			</div>

			<div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,.7fr)] gap-4 max-[620px]:grid-cols-1">
				<div className="min-w-0">
					<label className="mb-2 block text-xs font-semibold text-[#3c3d37]" htmlFor="read-aloud-voice">Voice</label>
					<div className="flex gap-2">
						<SelectField
							containerClassName="relative min-w-0 flex-1" className="mt-0 h-10 min-w-0 w-full cursor-pointer text-xs"
							id="read-aloud-voice"
							value={selectedVoiceURI}
							onChange={(event) => handleVoiceChange(event.target.value)}
							aria-invalid={voiceUnavailable}
							disabled={!isSupported || isPreviewing}
						>
							{voiceUnavailable && <option value={selectedVoiceURI} disabled>{selectedVoiceName || "Selected voice"} · unavailable</option>}
							<option value="">System default voice</option>
							{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.default ? " · default" : ""}</option>)}
						</SelectField>
						<button className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 border border-line bg-surface px-3 text-[11px] text-ink transition-colors hover:border-[#aaa69a] disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={refreshVoices} disabled={!isSupported || isPreviewing} title="Reload voices from your browser">
							<RefreshCw size={14} aria-hidden="true" /><span className="max-[420px]:sr-only">Refresh</span>
						</button>
					</div>
					{voiceUnavailable
						? <p className="mb-0 mt-[7px] border-l-2 border-[#b78b42] bg-[#f8f2e2] px-2.5 py-2 text-[11px] leading-[1.5] text-[#61502b]" role="alert">The selected voice/language is unavailable. Refresh the list or choose System default.</p>
						: <p className="mb-0 mt-[7px] text-[11px] leading-[1.5] text-muted">{voices.length > 0 ? "Voices are supplied by your browser/device and may not all work. Test one before using it." : "No extra voices are exposed right now; refresh or use the system default."}</p>}
					<button className="mt-2 inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-line bg-surface px-2.5 text-[11px] text-[#54554e] transition-colors hover:border-[#aaa69a] disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={testVoice} disabled={!isSupported || isSpeaking || isPreviewing}>
						<Volume2 size={13} aria-hidden="true" /> Test voice
					</button>
				</div>
				<div>
					<div className="mb-2 flex items-center justify-between gap-3">
						<label className="text-xs font-semibold text-[#3c3d37]" htmlFor="read-aloud-rate">Speaking speed</label>
						<output className="font-mono text-[11px] text-[#64665e]" htmlFor="read-aloud-rate">{rate.toFixed(1)}×</output>
					</div>
					<input
						className="h-10 w-full cursor-pointer accent-accent-dark outline-2 outline-offset-2 outline-transparent focus:outline-accent"
						id="read-aloud-rate"
						type="range"
						min="0.5"
						max="2"
						step="0.1"
						value={rate}
						onChange={(event) => handleRateChange(Number(event.target.value))}
						disabled={isPreviewing}
						aria-valuetext={`${rate.toFixed(1)} times normal speed`}
					/>
				</div>
			</div>
			<p className="-mt-3 mb-0 text-[11px] leading-[1.5] text-muted">Changing voice or speed won’t interrupt the current segment; the new setting takes effect at the next segment.</p>

			<div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 max-[520px]:items-stretch max-[520px]:flex-col">
				<div className="flex flex-wrap gap-2 max-[520px]:grid max-[520px]:grid-cols-2">
					<button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-forest bg-forest px-4 text-xs font-medium text-white transition-colors hover:bg-[#354d44] disabled:cursor-not-allowed disabled:border-[#b8b9b1] disabled:bg-[#b8b9b1]" type="button" onClick={() => startReading()} disabled={!isSupported || !text.trim() || isPreviewing}>
						{isSpeaking && !isPaused ? <RotateCcw size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" fill="currentColor" />}
						{isSpeaking && !isPaused ? "Start again" : "Read aloud"}
					</button>
					<button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-line bg-surface px-4 text-xs text-ink transition-colors hover:border-[#aaa69a] disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={togglePause} disabled={!isSpeaking}>
						{isPaused ? <Play size={15} aria-hidden="true" fill="currentColor" /> : <Pause size={15} aria-hidden="true" />}{isPaused ? "Resume" : "Pause"}
					</button>
					<button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-line bg-surface px-4 text-xs text-ink transition-colors hover:border-[#aaa69a] disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={stopReading} disabled={!isSpeaking}>
						<Square size={14} aria-hidden="true" fill="currentColor" /> Stop
					</button>
				</div>
				<div className="inline-flex items-center gap-2 text-[11px] text-muted" role="status" aria-live="polite">
					<Volume2 className={isSpeaking && !isPaused ? "text-accent-dark" : "text-[#92928a]"} size={15} aria-hidden="true" />
					<span>{message || (isPaused ? "Paused" : isSpeaking ? "Reading your text…" : "Ready when you are")}</span>
				</div>
			</div>
		</div>
	);
};

export default ReadAloud;
