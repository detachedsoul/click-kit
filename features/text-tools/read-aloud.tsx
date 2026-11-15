"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LockKeyhole, Pause, Play, RotateCcw, Square, Volume2, RefreshCw } from "lucide-react";
import { countGraphemes } from "@/features/text-tools/text-utils";

type SpeechSnapshot = {
	supported: boolean;
	voices: SpeechSynthesisVoice[];
};

const emptySpeechSnapshot: SpeechSnapshot = { supported: false, voices: [] };
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

const ReadAloud = () => {
	const [text, setText] = useState("");
	const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
	const [rate, setRate] = useState(1);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [message, setMessage] = useState("");
	const activeUtteranceId = useRef(0);
	const { supported: isSupported, voices } = useSyncExternalStore(subscribeToSpeech, getSpeechSnapshot, getServerSpeechSnapshot);

	useEffect(() => {
		if (!isSupported) return;
		return () => {
			activeUtteranceId.current += 1;
			window.speechSynthesis?.cancel();
		};
	}, [isSupported]);

	const startReading = (nextRate = rate, voiceURI = selectedVoiceURI) => {
		if (!text.trim() || !isSupported) return;
		const synthesis = window.speechSynthesis;
		if (!synthesis) return;

		activeUtteranceId.current += 1;
		const utteranceId = activeUtteranceId.current;
		synthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		const voice = voices.find((item) => item.voiceURI === voiceURI);
		if (voice) utterance.voice = voice;
		utterance.rate = nextRate;
		utterance.onstart = () => {
			if (activeUtteranceId.current === utteranceId) setIsSpeaking(true);
		};
		utterance.onend = () => {
			if (activeUtteranceId.current !== utteranceId) return;
			setIsSpeaking(false);
			setIsPaused(false);
		};
		utterance.onerror = (event) => {
			if (activeUtteranceId.current !== utteranceId || event.error === "canceled" || event.error === "interrupted") return;
			setIsSpeaking(false);
			setIsPaused(false);
			setMessage("Playback stopped unexpectedly. Try again.");
		};

		setIsSpeaking(true);
		setIsPaused(false);
		setMessage("");
		synthesis.speak(utterance);
	};

	const handleVoiceChange = (voiceURI: string) => {
		setSelectedVoiceURI(voiceURI);
		if (isSpeaking) startReading(rate, voiceURI);
	};

	const handleRateChange = (nextRate: number) => {
		setRate(nextRate);
		if (isSpeaking) startReading(nextRate, selectedVoiceURI);
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
	};

	const handleTextChange = (nextText: string) => {
		setText(nextText);
		setMessage("");
		if (isSpeaking) stopReading();
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
						<select
							className="h-10 min-w-0 flex-1 cursor-pointer border border-line bg-surface px-3 text-xs text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
							id="read-aloud-voice"
							value={selectedVoiceURI}
							onChange={(event) => handleVoiceChange(event.target.value)}
							disabled={!isSupported}
						>
							<option value="">System default voice</option>
							{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}{voice.default ? " · default" : ""}</option>)}
						</select>
						<button className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 border border-line bg-surface px-3 text-[11px] text-ink transition-colors hover:border-[#aaa69a] disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={refreshSpeechSnapshot} disabled={!isSupported} title="Reload voices from your browser">
							<RefreshCw size={14} aria-hidden="true" /><span className="max-[420px]:sr-only">Refresh</span>
						</button>
					</div>
					<p className="mb-0 mt-[7px] text-[11px] leading-[1.5] text-muted">{voices.length > 0 ? "Choose a voice provided by your browser or device." : "No extra voices are exposed right now; refresh or use the system default."}</p>
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
						aria-valuetext={`${rate.toFixed(1)} times normal speed`}
					/>
				</div>
			</div>
			<p className="-mt-3 mb-0 text-[11px] leading-[1.5] text-muted">Changing the voice or speed during playback restarts from the beginning with your new settings.</p>

			<div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 max-[520px]:items-stretch max-[520px]:flex-col">
				<div className="flex flex-wrap gap-2 max-[520px]:grid max-[520px]:grid-cols-2">
					<button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-forest bg-forest px-4 text-xs font-medium text-white transition-colors hover:bg-[#354d44] disabled:cursor-not-allowed disabled:border-[#b8b9b1] disabled:bg-[#b8b9b1]" type="button" onClick={() => startReading()} disabled={!isSupported || !text.trim()}>
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
