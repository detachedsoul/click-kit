"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Timer, Type } from "lucide-react";
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
	const [result, setResult] = useState<Result | null>(null);
	const [history, setHistory] = useStoredState<Attempt[]>(HISTORY_KEY, [], reviveHistory);
	const surface = useRef<HTMLDivElement | null>(null);
	const caret = useRef<HTMLSpanElement | null>(null);
	const finishRef = useRef<() => void>(() => undefined);

	/** A fresh passage, and the clock put back to zero. */
	const restart = () => {
		setTyped("");
		setPhase("idle");
		setStartedAt(0);
		setNow(0);
		setResult(null);
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
		restart();
	};

	useEffect(() => {
		if (phase !== "running") return;
		const tick = window.setInterval(() => {
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

	useEffect(() => {
		surface.current?.focus();
	}, []);

	// Scroll the caret into view as the lines run past the bottom of the box.
	useEffect(() => {
		const node = caret.current;
		if (!node || typeof node.scrollIntoView !== "function") return;
		node.scrollIntoView({ block: "nearest" });
	}, [typed.length]);

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

	const type = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const key = event.key;
		// Shortcuts belong to the browser.
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (key === "Tab" || key === "Escape") {
			event.preventDefault();
			restart();
			return;
		}
		if (key === "Backspace") {
			event.preventDefault();
			if (phase === "done") return;
			setTyped((current) => current.slice(0, -1));
			return;
		}
		// Letters, digits, spaces, and punctuation only; Enter, arrows, and F-keys do nothing.
		if (key.length !== 1) return;
		event.preventDefault();
		if (phase === "done") return;
		if (phase === "idle") {
			const started = Date.now();
			setStartedAt(started);
			setNow(started);
			setPhase("running");
		}
		const next = `${typed}${key}`;
		setTyped(next);
		if (target.length - next.length < 120) setTarget((text) => grow(text));
	};

	const elapsed = phase === "running" ? Math.min(duration, (now - startedAt) / 1000) : 0;
	const remaining = phase === "running" ? Math.max(0, duration - elapsed) : duration;
	const live = statsFor(target, typed, Math.max(elapsed, 0.2));
	const marks = compareTyped(target, typed);
	const extras = extrasOf(target, typed);
	const running = phase === "running";
	const finished = phase === "done" ? result : null;
	const historyBest = bestWpm(history);

	const charClass = (mark: string) => {
		if (mark === "correct") return "text-ink";
		if (mark === "incorrect") return "bg-[#f7ded6] text-accent-dark underline decoration-accent decoration-2";
		return "text-muted";
	};

	return (
		<ToolPanel>
			<SegmentedControl<string>
				label="How long"
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
						{ label: "Accuracy", value: `${finished ? finished.stats.accuracy : live.accuracy}%` },
						{ label: "Characters", value: String(finished ? finished.stats.typed : live.typed) },
					]}
				/>
			</div>

			<div
				aria-describedby="typing-help"
				aria-label="Typing area"
				className={`relative max-h-[264px] overflow-y-auto border bg-surface p-4 font-mono text-[15px] leading-[1.9] outline-2 outline-offset-2 outline-transparent transition-colors focus:outline-accent ${running ? "border-accent" : "border-line"}`}
				onClick={() => surface.current?.focus()}
				onKeyDown={type}
				ref={surface}
				role="textbox"
				tabIndex={0}
			>
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
			<p className={hintClassName} id="typing-help">
				Click the passage and start typing — the clock starts on your first key. Tab or Escape brings up a fresh passage, Backspace fixes a slip, and the text grows as you go so a fast test never runs out.
			</p>

			<div className="flex flex-wrap items-center gap-2">
				<button className={primaryButtonClassName} onClick={restart} type="button">
					<RotateCcw aria-hidden="true" size={13} /> {running ? "Start over" : "New passage"}
				</button>
				<span className="inline-flex items-center gap-1.5 text-xs text-muted">
					<Timer aria-hidden="true" size={13} /> {duration} seconds on {levelLabel(level)}
				</span>
			</div>

			{finished ? (
				<section aria-live="polite" className="flex flex-col gap-3 border border-line bg-[#fbfaf7] p-3">
					<h2 className="m-0 text-sm font-semibold text-ink">Your result</h2>
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
					<p className="m-0 text-xs text-muted">
						<Type aria-hidden="true" className="mr-1 inline" size={12} />
						Every attempt is kept on this device only, so you can watch the number climb.
					</p>
				</section>
			) : null}

			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold text-ink">Your history</h2>
					{history.length ? <span className="text-xs text-muted">{history.length} attempt{history.length === 1 ? "" : "s"} kept on this device</span> : null}
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
