"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointerClick, RotateCcw, Timer, Type } from "lucide-react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { useStoredState } from "@/features/productivity-tools/stored-state";
import {
	attemptWhen,
	averageAccuracy,
	averageWpm,
	bestWpm,
	clock,
	compareTyped,
	customTarget,
	DEFAULT_DURATION,
	DURATIONS,
	type Duration,
	extrasOf,
	HISTORY_KEY,
	type Level,
	LEVELS,
	MIN_CUSTOM_LENGTH,
	MAX_CUSTOM_LENGTH,
	passageFor,
	recordAttempt,
	reviveHistory,
	statsFor,
	targetLengthFor,
	type Attempt,
	type TypedStats,
} from "@/features/productivity-tools/typing-utils";

type Phase = "idle" | "running" | "done";
type Result = { duration: Duration; level: Level; stats: TypedStats };

/** The first passage on screen is fixed, so the server and the page agree; every new test rolls. */
const firstPassage = (level: Level, duration: Duration) => (level === "custom" ? "" : passageFor(level, targetLengthFor(duration), () => 0.5));

const levelLabel = (level: Level) => LEVELS.find((entry) => entry.id === level)?.label ?? "Medium";

/** The three things a first visitor needs to know, in the order they need them. */
const STEPS = ["Pick how long you want to type, and how hard the text should be.", "Type the passage as it appears — the clock starts on your first key.", "Read your score, then run it again and try to beat it."];

/** Keys that are worth naming on screen. */
const KEY_HINTS: [string, string][] = [
	["Tab", "new passage"],
	["Esc", "start over"],
	["⌫", "fix a slip"],
];

const kbdClassName = "border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink";

export const TypingTester = () => {
	const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
	const [level, setLevel] = useState<Level>("medium");
	const [custom, setCustom] = useState("");
	const [complaint, setComplaint] = useState("");
	const [target, setTarget] = useState(() => firstPassage("medium", DEFAULT_DURATION));
	const [typed, setTyped] = useState("");
	const [phase, setPhase] = useState<Phase>("idle");
	const [startedAt, setStartedAt] = useState(0);
	const [now, setNow] = useState(0);
	const [focused, setFocused] = useState(false);
	const [result, setResult] = useState<Result | null>(null);
	const [history, setHistory] = useStoredState<Attempt[]>(HISTORY_KEY, [], reviveHistory);
	const surface = useRef<HTMLTextAreaElement | null>(null);
	const caret = useRef<HTMLSpanElement | null>(null);
	const resultBox = useRef<HTMLElement | null>(null);
	const finishRef = useRef<() => void>(() => undefined);
	const keyRef = useRef<(key: string) => boolean>(() => false);
	/** When the typing area lost focus mid-test, so the clock can wait for it to come back. */
	const pausedAt = useRef(0);

	const focusSurface = () => surface.current?.focus({ preventScroll: true });

	/** A fresh passage, and the clock put back to zero. */
	const restart = (focus = false) => {
		setTyped("");
		setPhase("idle");
		setStartedAt(0);
		setNow(0);
		setResult(null);
		pausedAt.current = 0;
		if (focus) focusSurface();
	};

	const buildTarget = (nextLevel: Level, nextDuration: Duration, text = custom) => {
		if (nextLevel !== "custom") return passageFor(nextLevel, targetLengthFor(nextDuration));
		if (text.trim().length < MIN_CUSTOM_LENGTH) return null;
		return customTarget(text, targetLengthFor(nextDuration));
	};

	const choose = (nextLevel: Level, nextDuration: Duration) => {
		setLevel(nextLevel);
		setDuration(nextDuration);
		const next = buildTarget(nextLevel, nextDuration);
		if (next === null) {
			setTarget("");
			setComplaint(`Your own text needs at least ${MIN_CUSTOM_LENGTH} characters before it can start a test.`);
			restart();
			return;
		}
		setComplaint("");
		setTarget(next);
		// A new test is ready, so put the cursor back where the typing happens — unless the
		// visitor is on their way to the text box that holds their own words.
		restart(nextLevel !== "custom");
	};

	useEffect(() => {
		if (phase !== "running") return;
		const tick = window.setInterval(() => {
			// Nothing is being typed: hold the clock where it is until focus comes back.
			if (pausedAt.current) return;
			const moment = Date.now();
			if (moment - startedAt < duration * 1000) {
				setNow(moment);
				return;
			}
			// Time is up: stop the clock, then read the passage as it stands.
			window.clearInterval(tick);
			setNow(moment);
			finishRef.current();
		}, 100);
		return () => window.clearInterval(tick);
	}, [phase, startedAt, duration]);

	// Scroll the caret into view as the lines run past the bottom of the box.
	useEffect(() => {
		const node = caret.current;
		if (!node || typeof node.scrollIntoView !== "function") return;
		node.scrollIntoView({ block: "nearest" });
	}, [typed.length]);

	// Bring the score into view when the clock stops, so the answer is not below the fold.
	useEffect(() => {
		if (phase !== "done") return;
		const node = resultBox.current;
		if (!node || typeof node.scrollIntoView !== "function") return;
		node.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [phase]);

	/**
	 * Typing does not have to start with a click: a printable key anywhere on the page that is
	 * not a field or a button is taken as the first keystroke, and pulls focus in with it.
	 */
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const node = event.target instanceof HTMLElement ? event.target : null;
			if (node && surface.current?.contains(node)) return;
			if (node?.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
			focusSurface();
			if (keyRef.current(event.key)) event.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const finish = () => {
		const stats = statsFor(target, typed, duration);
		setResult({ duration, level, stats });
		setPhase("done");
		setHistory((current) =>
			recordAttempt(current, {
				accuracy: stats.accuracy,
				at: Date.now(),
				correct: stats.correct,
				cpm: stats.cpm,
				duration,
				incorrect: stats.incorrect,
				level,
				wpm: stats.wpm,
			}),
		);
	};

	// The clock fires from an interval, so it reads the newest finish through a ref.
	useEffect(() => {
		finishRef.current = finish;
	});

	/** Keep a screen or two of passage ahead of the fingers. */
	const grow = (text: string) => {
		if (level === "custom") return `${text} ${customTarget(custom, 200)}`;
		return `${text} ${passageFor(level, 200)}`;
	};

	/** The passage as the field now holds it: the one place a test gets its characters. */
	const accept = (next: string) => {
		if (phase === "done") return;
		const capped = next.replace(/\s/gu, (space) => (space === "\n" ? "" : space)).slice(0, target.length + 40);
		if (phase === "idle" && capped.length === 0) return;
		if (phase === "idle") {
			const started = Date.now();
			setStartedAt(started);
			setNow(started);
			setPhase("running");
		}
		setTyped(capped);
		if (target.length - capped.length < 120) setTarget((text) => grow(text));
	};

	/** One keystroke from elsewhere on the page. Returns false when the key is not ours. */
	const applyKey = (key: string) => {
		// Shortcuts belong to the browser.
		if (key === "Tab" || key === "Escape") {
			restart(true);
			return true;
		}
		if (key === "Backspace") {
			accept(typed.slice(0, -1));
			return true;
		}
		// Letters, digits, spaces, and punctuation only; Enter, arrows, and F-keys do nothing.
		if (key.length !== 1) return false;
		if (phase === "done") return false;
		accept(`${typed}${key}`);
		return true;
	};

	useEffect(() => {
		keyRef.current = applyKey;
	});

	/** The field itself takes letters, spaces, and Backspace; only the shortcuts need handling. */
	const type = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "Tab" || event.key === "Escape") {
			event.preventDefault();
			restart(true);
			return;
		}
		// A typing test has no use for a second line.
		if (event.key === "Enter") event.preventDefault();
	};

	const onBlur = () => {
		setFocused(false);
		// Do not let the clock run while the hands are away from the keyboard.
		if (phase === "running") pausedAt.current = Date.now();
	};

	const onFocus = () => {
		setFocused(true);
		if (!pausedAt.current) return;
		const gap = Date.now() - pausedAt.current;
		pausedAt.current = 0;
		if (phase !== "running") return;
		setStartedAt((at) => at + gap);
		setNow(Date.now());
	};

	const elapsed = phase === "running" ? Math.min(duration, (now - startedAt) / 1000) : 0;
	const remaining = phase === "running" ? Math.max(0, duration - elapsed) : duration;
	const live = statsFor(target, typed, Math.max(elapsed, 0.2));
	const marks = compareTyped(target, typed);
	const extras = extrasOf(target, typed);
	const running = phase === "running";
	const finished = phase === "done" ? result : null;
	const historyBest = bestWpm(history);
	const waiting = !focused && !finished && target.length > 0;

	const charClass = (mark: string) => {
		if (mark === "correct") return "text-ink";
		if (mark === "incorrect") return "bg-[#f7ded6] text-accent-dark underline decoration-accent decoration-2";
		return "text-muted";
	};

	return (
		<ToolPanel>
			<p className={`${hintClassName} m-0`}>Type the passage exactly as it appears. Your clock starts on the first key, and every attempt stays on this device.</p>

			{history.length === 0 ? (
				<ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
					{STEPS.map((step, index) => (
						<li className="flex items-start gap-2 border border-line bg-[#fbfaf7] px-3 py-2" key={step}>
							<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center bg-forest font-mono text-[11px] font-semibold text-paper">{index + 1}</span>
							<span className="text-xs leading-relaxed text-ink">{step}</span>
						</li>
					))}
				</ol>
			) : null}

			<SegmentedControl<string>
				label="Test length"
				onChange={(value) => choose(level, Number(value) as Duration)}
				options={DURATIONS.map((seconds) => ({ id: String(seconds), label: `${seconds}s` }))}
				value={String(duration)}
			/>
			<SegmentedControl<Level>
				label="Difficulty"
				onChange={(value) => choose(value, duration)}
				options={LEVELS.map((entry) => ({ id: entry.id, label: entry.label }))}
				value={level}
			/>
			<p className={`${hintClassName} -mt-1`}>{LEVELS.find((entry) => entry.id === level)?.blurb}</p>

			{level === "custom" ? (
				<div>
					<label className={labelClassName} htmlFor="typing-custom">
						Your own text ({custom.trim().length} characters)
					</label>
					<textarea
						className="mt-2 min-h-24 w-full border border-line bg-surface p-3 text-sm leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						id="typing-custom"
						maxLength={MAX_CUSTOM_LENGTH}
						onChange={(event) => {
							setCustom(event.target.value);
							const text = event.target.value;
							if (text.trim().length >= MIN_CUSTOM_LENGTH) {
								setComplaint("");
								setTarget(customTarget(text, targetLengthFor(duration)));
								restart();
							}
						}}
						placeholder="Paste a paragraph you want to get faster at."
						value={custom}
					/>
					<p className={hintClassName}>Repeated for as long as the test runs, so the passage never runs out.</p>
				</div>
			) : null}

			{complaint ? <ErrorNote message={complaint} /> : null}

			<div className="grid gap-3 sm:grid-cols-4">
				<StatGrid
					items={[
						{ label: "Time left", value: clock(remaining) },
						{ label: "Words per minute", value: String(finished ? finished.stats.wpm : live.wpm) },
						{ label: "Accuracy", value: finished ? `${finished.stats.accuracy}%` : live.typed === 0 ? "—" : `${live.accuracy}%` },
						{ label: "Characters", value: String(finished ? finished.stats.typed : live.typed) },
					]}
				/>
			</div>

			<div className="relative" onClick={focusSurface}>
				<div className={`max-h-[264px] cursor-text overflow-y-auto border bg-surface p-4 font-mono text-[15px] leading-[1.9] outline-2 outline-offset-2 outline-transparent transition-colors focus-within:outline-accent ${running || waiting ? "border-accent" : "border-line"}`}>
					{target ? (
						<p className="m-0">
							{marks.map((mark, index) => {
								const char = target[index];
								const current = !finished && index === typed.length;
								return (
									<span
										className={`${charClass(mark)} ${current ? "border-b-2 border-accent" : ""} ${char === " " ? "whitespace-pre-wrap" : ""}`}
										data-current={current ? "true" : undefined}
										data-status={mark}
										key={index}
										ref={current ? caret : undefined}
									>
										{char}
									</span>
								);
							})}
							{extras ? <span className="bg-[#f7ded6] text-accent-dark underline decoration-accent decoration-2">{extras}</span> : null}
						</p>
					) : (
						<p className="m-0 text-sm text-muted">Paste your own text above and the test starts here.</p>
					)}
				</div>

				{/* A real field, hidden but focusable: the phone keyboard needs one, and it keeps the text off the page. */}
				<textarea
					aria-describedby="typing-help"
					aria-label="Typing area"
					autoCapitalize="none"
					autoComplete="off"
					autoCorrect="off"
					className="sr-only"
					inputMode="text"
					maxLength={target.length + 40}
					onBlur={onBlur}
					onChange={(event) => accept(event.target.value)}
					onFocus={onFocus}
					onKeyDown={type}
					ref={surface}
					spellCheck={false}
					value={typed}
				/>

				{waiting ? (
					<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/85 p-4 text-center">
						<p className="m-0 max-w-xs text-sm font-medium text-ink">
							<MousePointerClick aria-hidden="true" className="mr-1.5 inline align-[-2px]" size={15} />
							{running || typed ? "Paused — click here to keep typing" : "Click here and start typing"}
						</p>
						{running || typed ? null : <p className="m-0 text-xs text-muted">With a keyboard in front of you, just start typing.</p>}
					</div>
				) : null}

				<div aria-hidden="true" className="mt-2 h-1 w-full bg-sage">
					<div className="h-full bg-forest transition-[width] duration-100" style={{ width: `${Math.round((remaining / duration) * 100)}%` }} />
				</div>
			</div>

			<div className={`${hintClassName} flex flex-wrap items-center gap-x-3 gap-y-1`} id="typing-help">
				<span>Type the passage — no need to click first.</span>
				{KEY_HINTS.map(([key, meaning]) => (
					<span className="inline-flex items-center gap-1" key={key}>
						<kbd className={kbdClassName}>{key}</kbd> {meaning}
					</span>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<button className={buttonClassName} onClick={() => restart(true)} type="button">
					<RotateCcw aria-hidden="true" size={13} /> {running || typed ? "Start over" : "New passage"}
				</button>
				<span className="inline-flex items-center gap-1.5 text-xs text-muted">
					<Timer aria-hidden="true" size={13} /> {duration} seconds on {levelLabel(level)}
				</span>
			</div>

			{finished ? (
				<section aria-live="polite" className="flex flex-col gap-3 border border-line bg-[#fbfaf7] p-3" ref={resultBox}>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="m-0 text-sm font-semibold text-ink">Your result</h2>
						<span className="text-xs text-muted">
							{finished.duration}s · {levelLabel(finished.level)}
						</span>
					</div>
					<StatGrid
						items={[
							{ label: "Words per minute", value: String(finished.stats.wpm) },
							{ label: "Characters per minute", value: String(finished.stats.cpm) },
							{ label: "Accuracy", value: `${finished.stats.accuracy}%` },
							{ label: "Mistakes", value: String(finished.stats.incorrect) },
						]}
					/>
					<p className="m-0 text-xs leading-relaxed text-ink">
						{finished.duration} seconds on {levelLabel(finished.level).toLowerCase()}: <strong>{finished.stats.wpm} wpm</strong> at <strong>{finished.stats.accuracy}%</strong> — {finished.stats.correct} characters right, {finished.stats.incorrect} wrong.
						{historyBest > finished.stats.wpm ? ` Your best is ${historyBest} wpm.` : history.length > 1 ? " That is your best so far." : ""}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<button className={primaryButtonClassName} onClick={() => restart(true)} type="button">
							<RotateCcw aria-hidden="true" size={13} /> Type again
						</button>
						<span className="text-xs text-muted">Same test, a fresh passage — the clock starts when you do.</span>
					</div>
					<p className="m-0 text-xs text-muted">
						<Type aria-hidden="true" className="mr-1 inline" size={12} />
						Every attempt is kept on this device only, so you can watch the number climb.
					</p>
				</section>
			) : null}

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold text-ink">Your history</h2>
					{history.length ? (
						<span className="text-xs text-muted">
							{history.length} attempt{history.length === 1 ? "" : "s"} kept on this device
						</span>
					) : null}
				</div>
				{history.length ? (
					<>
						<StatGrid
							items={[
								{ label: "Best", value: `${bestWpm(history)} wpm` },
								{ label: "Average", value: `${averageWpm(history)} wpm` },
								{ label: "Mean accuracy", value: `${averageAccuracy(history)}%` },
								{ label: "Attempts", value: String(history.length) },
							]}
						/>
						<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
							{history.map((attempt) => (
								<li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-line bg-surface px-3 py-2 text-xs text-ink" key={`${attempt.at}-${attempt.wpm}-${attempt.duration}`}>
									<span className="font-mono text-[11px] text-muted">{attemptWhen(attempt.at)}</span>
									<span className="font-semibold">{attempt.wpm} wpm</span>
									<span>{attempt.accuracy}% accurate</span>
									<span className="text-muted">
										{attempt.cpm} cpm · {attempt.duration}s · {levelLabel(attempt.level)}
									</span>
								</li>
							))}
						</ul>
						<button className={`${buttonClassName} self-start`} onClick={() => setHistory(() => [])} type="button">
							Clear history
						</button>
					</>
				) : (
					<p className="m-0 text-xs text-muted">No attempts yet. Finish a test and it will be listed here.</p>
				)}
			</section>
		</ToolPanel>
	);
};
