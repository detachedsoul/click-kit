/**
 * Typing speed: the passages, the arithmetic, and the history.
 *
 * Words per minute is the usual measure — five characters make a word, so WPM is the correctly
 * typed characters divided by five and by the minutes spent. Characters per minute counts every
 * keystroke that landed, right or wrong, which is the number that says how fast the hands move.
 * Accuracy is the share of keystrokes that matched the passage, and a mistake is never hidden by
 * a slower result.
 */

export type Duration = 15 | 30 | 60 | 120;
export type Difficulty = "easy" | "medium" | "hard";
export type Level = Difficulty | "custom";

export const DURATIONS: Duration[] = [15, 30, 60, 120];
export const DEFAULT_DURATION: Duration = 30;
export const MAX_CUSTOM_LENGTH = 2000;
export const MIN_CUSTOM_LENGTH = 20;
export const HISTORY_KEY = "clickkit-typing-history";
export const MAX_ATTEMPTS = 20;

export const LEVELS: { id: Level; label: string; blurb: string }[] = [
	{ id: "easy", label: "Easy", blurb: "Short, plain words. Nothing but letters and spaces." },
	{ id: "medium", label: "Medium", blurb: "Full sentences with capitals, commas, and full stops." },
	{ id: "hard", label: "Hard", blurb: "Numbers, symbols, and mixed case, the way real work looks." },
	{ id: "custom", label: "Your own text", blurb: "Paste a paragraph you want to practise." },
];

export const PASSAGES: Record<Difficulty, string[]> = {
	easy: [
		"the sun came up over the hill and the birds began to sing in the trees near the water while a small boat drifted slowly past the old stone bridge",
		"she put the kettle on and sat down by the window to read the paper for a while before the children came home from school in the rain",
		"a small dog ran across the field and stopped to look at the gate near the road where the bus went by every morning at half past seven",
		"we walked down to the river and watched the boats go by until it was dark and the lights of the town came on one by one along the bank",
		"he opened the box and found a map inside that showed the way to the old mill at the end of the lane past the farm with the red roof",
		"there was a long line at the market so we left the car by the park and walked the rest of the way to save a little time before lunch",
	],
	medium: [
		"The meeting was moved to Thursday, so please bring the revised figures, a short summary of what changed, and any questions you have.",
		"I've read the draft twice now; the opening is strong, but the middle section needs trimming before we send it to the client.",
		"Rain is expected through the morning, clearing by two o'clock, with a light wind from the west and a high of nineteen degrees.",
		"Her first novel sold modestly, which surprised nobody more than her, and the second one sold enough to buy the house she still lives in.",
		"If the train is late again, take the bus to the square and walk the last few streets; it's faster than waiting on the platform.",
		"We keep the spare key with the neighbour across the hall, so if you arrive before us, knock twice and tell her I sent you.",
	],
	hard: [
		"Invoice #4471 came to 1,280.50 (34% over budget); email ops_team@site.co.uk by 17/03 with the ref: Q1-2026.",
		"const total = items.reduce((sum, item) => sum + item.price * item.qty, 0); // returns 42.75 at 10% VAT",
		"<section id=\"summary\" class=\"card-2\"><h2>Totals &amp; tax</h2><!-- 2026 figures --></section>",
		"Route 7B departs 08:45 → 09:32; transfer at King's Cross (platform 3) and keep the ticket — it costs £4.10.",
		"SELECT name, SUM(amount) AS total FROM invoices WHERE paid_at >= '2026-01-01' GROUP BY name ORDER BY total DESC;",
		"\"/api/orders?status=open&limit=50\" = { next: null, count: 3, total: 1249.99 }",
	],
};

/** How much text a test of this length might need, with room to spare for a fast typist. */
export const targetLengthFor = (duration: Duration) => duration * 14;

/** A passage long enough for the test, ending on a whole word. */
export const passageFor = (difficulty: Difficulty, length: number, random: () => number = Math.random) => {
	const pool = PASSAGES[difficulty];
	let text = "";
	while (text.length < length) {
		const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
		text = text ? `${text} ${pick}` : pick;
	}
	// Break after the requested length, at a space, so a test never ends mid-word.
	const end = text.indexOf(" ", length);
	return end > 0 ? text.slice(0, end) : text;
};

/** Custom text, repeated until it can fill the test. */
export const customTarget = (text: string, length: number) => {
	const clean = text.replace(/\r\n/gu, "\n").trim();
	if (!clean) return "";
	let out = clean;
	while (out.length < length) out = `${out} ${clean}`;
	const end = out.indexOf(" ", length);
	return end > 0 ? out.slice(0, end) : out;
};

export type Mark = "correct" | "incorrect" | "pending";

/** One mark per character of the passage: typed and right, typed and wrong, or not yet reached. */
export const compareTyped = (target: string, typed: string): Mark[] =>
	Array.from(target, (_char, index) => (index >= typed.length ? "pending" : target[index] === typed[index] ? "correct" : "incorrect"));

export type TypedStats = { accuracy: number; correct: number; cpm: number; incorrect: number; typed: number; wpm: number };

/** Everything the readout needs, from one pass over the two strings. */
export const statsFor = (target: string, typed: string, seconds: number): TypedStats => {
	const marks = compareTyped(target, typed);
	const correct = marks.filter((mark) => mark === "correct").length;
	const incorrect = typed.length - correct;
	const minutes = seconds / 60;
	return {
		accuracy: typed.length ? Math.round((correct / typed.length) * 1000) / 10 : 100,
		correct,
		cpm: minutes > 0 ? Math.round(typed.length / minutes) : 0,
		incorrect,
		typed: typed.length,
		wpm: minutes > 0 ? Math.round(correct / 5 / minutes) : 0,
	};
};

/** "0:30" — a clock the eye can read while typing. */
export const clock = (seconds: number) => {
	const whole = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** The characters typed past the end of the passage, which count as mistakes. */
export const extrasOf = (target: string, typed: string) => (typed.length > target.length ? typed.slice(target.length) : "");

export type Attempt = {
	at: number;
	accuracy: number;
	correct: number;
	cpm: number;
	duration: number;
	incorrect: number;
	level: Level;
	wpm: number;
};

const isAttempt = (value: unknown): value is Attempt => {
	if (!value || typeof value !== "object") return false;
	const attempt = value as Record<string, unknown>;
	return (
		typeof attempt.at === "number" &&
		typeof attempt.wpm === "number" &&
		typeof attempt.cpm === "number" &&
		typeof attempt.accuracy === "number" &&
		typeof attempt.duration === "number" &&
		typeof attempt.level === "string" &&
		["easy", "medium", "hard", "custom"].includes(attempt.level)
	);
};

/** Stored attempts, oldest mistakes and all, with anything unreadable dropped. */
export const reviveHistory = (raw: unknown): Attempt[] => (Array.isArray(raw) ? raw.filter(isAttempt).slice(0, MAX_ATTEMPTS) : []);

/** Newest first, and never longer than the shelf. */
export const recordAttempt = (history: Attempt[], attempt: Attempt) => [attempt, ...history].slice(0, MAX_ATTEMPTS);

export const bestWpm = (history: Attempt[]) => (history.length ? Math.max(...history.map((attempt) => attempt.wpm)) : 0);

export const averageWpm = (history: Attempt[]) => (history.length ? Math.round(history.reduce((total, attempt) => total + attempt.wpm, 0) / history.length) : 0);

export const averageAccuracy = (history: Attempt[]) =>
	history.length ? Math.round((history.reduce((total, attempt) => total + attempt.accuracy, 0) / history.length) * 10) / 10 : 0;

/** The date an attempt was made, in the reader's own words. */
export const attemptWhen = (at: number) => {
	const date = new Date(at);
	const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
	return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
};
