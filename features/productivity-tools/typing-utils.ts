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
		"the cat slept on the warm stone step all afternoon and woke up when the postman came up the path with a letter and a small brown box",
		"my sister keeps a list of all the books she has read on the back of an old map that hangs on the wall beside her desk",
		"it started to snow just as we reached the top of the hill and we stood there for a while and watched the fields turn white below us",
		"the shop on the corner sells bread and milk and a few other things, and the man who runs it knows everyone on the street by name",
		"after dinner we took the chairs out into the garden and sat under the apple tree while the last of the light went out of the sky",
		"a thin line of smoke rose from the chimney of the house at the end of the field where the old man had lived for most of his life",
		"every spring the garden fills with small white flowers and the bees come back and the air smells of wet grass and warm earth",
		"the train was full so we stood by the door and watched the towns go past in the rain, one after another, until our stop came",
		"he keeps his tools in a wooden box under the bench and puts each one back in its place before he closes the lid at the end of the day",
		"the wind came up in the night and the tree by the gate lost two of its branches, which we found across the path the next morning",
		"she learned to swim in the river behind the farm one summer when the water was low and warm and the days went on for ever",
		"we drove for hours along the coast road, past small towns and long empty beaches, and stopped for lunch at a place with blue shutters",
		"on the first warm day of the year we opened all the windows and let the smell of cut grass drift through every room in the house",
		"the baker on the high street starts at four in the morning and by six the whole lane smells of bread and the shutters are up",
	],
	medium: [
		"The meeting was moved to Thursday, so please bring the revised figures, a short summary of what changed, and any questions you have.",
		"I've read the draft twice now; the opening is strong, but the middle section needs trimming before we send it to the client.",
		"Rain is expected through the morning, clearing by two o'clock, with a light wind from the west and a high of nineteen degrees.",
		"Her first novel sold modestly, which surprised nobody more than her, and the second one sold enough to buy the house she still lives in.",
		"If the train is late again, take the bus to the square and walk the last few streets; it's faster than waiting on the platform.",
		"We keep the spare key with the neighbour across the hall, so if you arrive before us, knock twice and tell her I sent you.",
		"The library closes at six on Fridays, which leaves an hour after work, and the reading room upstairs is usually empty by then.",
		"He said the repairs would take a week, but three weeks later the kitchen was still half finished and the tiles were stacked in the hall.",
		"Before you book anything, check whether the price includes breakfast; last time it didn't, and the bill came as a small shock.",
		"She writes in the mornings, when the house is quiet, and spends the afternoons answering letters she would rather not read.",
		"Our neighbour has planted a hedge along the whole length of the fence, so the garden now has a little more shade in the afternoon.",
		"The form asks for your name, your address, and the date you started, and it must be signed before the end of the month.",
		"We spent the weekend painting the back room, which took longer than we thought, mostly because the walls needed two coats.",
		"When the power went out, we found candles in a drawer and sat in the kitchen talking until the lights came back on.",
		"The report is due on Monday, so could you send your notes by Friday afternoon at the latest, even if they are only rough?",
		"They met at a wedding in another city, and ten years later they still argue about who spoke to whom first that evening.",
		"If you take the path behind the church, it comes out by the river, and from there it is a short walk to the market square.",
		"The old photographs were kept in a tin, and most of them had no names on the back, so nobody could say who the people were.",
		"It is a small museum, three rooms and a garden, but the pieces inside it are older than anything else you will see in the city.",
		"The kettle is on, and the post has been opened, so the morning can begin in the usual order: tea, letters, and then the work.",
		"Every winter the road into the village floods, and every winter somebody writes to the council about it and nothing changes.",
		"She kept the receipts in a folder by the door, which turned out to be a great help when the tax office wrote to her in March.",
	],
	hard: [
		"Invoice #4471 came to 1,280.50 (34% over budget); email ops_team@site.co.uk by 17/03 with the ref: Q1-2026.",
		"const total = items.reduce((sum, item) => sum + item.price * item.qty, 0); // returns 42.75 at 10% VAT",
		"<section id=\"summary\" class=\"card-2\"><h2>Totals &amp; tax</h2><!-- 2026 figures --></section>",
		"Route 7B departs 08:45 and arrives 09:32; change at King's Cross (platform 3) and keep the ticket, it costs 4.10.",
		"SELECT name, SUM(amount) AS total FROM invoices WHERE paid_at >= '2026-01-01' GROUP BY name ORDER BY total DESC;",
		"\"/api/orders?status=open&limit=50\" = { next: null, count: 3, total: 1249.99 }",
		"git checkout -b fix/451-tokens && git commit -m \"fix(auth): reject expired tokens after 3 tries\"",
		"if (retries > 3 || !cache.has(key)) { log.warn(`miss: ${key} after ${retries} tries`); return null; }",
		"Total: $1,049.95 (2 x $499.99 + $49.97 shipping); VAT 20% included. Ref: INV-2026-0042 / PO 88123.",
		"curl -X POST https://api.example.com/v2/events -H \"Content-Type: application/json\" -d '{\"id\": \"evt_91\"}'",
		"expect(res.status).toBe(201); assert.deepEqual(body.items, [1, 2, 3]); // 3 ids, 0 errors",
		"Backup ran at 02:15 on 14/11/2026 and moved 1.8 GB in 4m 12s (avg 7.3 MB/s), exit code 0.",
		"UPDATE settings SET retries = 5, timeout_ms = 2500 WHERE service = 'billing' AND env IN ('stage', 'prod');",
		"Name: Ada Lovelace | Born: 10/12/1815 | Note: wrote the first algorithm in 1843 (see note #7, p. 42).",
		"npm run build -- --profile > out/build.log 2>&1; echo \"exit=$? size=$(du -sh out | cut -f1)\"",
		"the quick brown fox jumped over 13 lazy dogs at 06:45, 27% faster than yesterday's run of 41:12 (a PB).",
		"<a href=\"/docs/v2?page=3#faq\" target=\"_blank\" rel=\"noopener\">Read more &rarr; 2 min</a>",
		"user_id=8842&plan=pro&seats=12&renews=2027-03-01; upgrade at 15% off if paid before 31/12/2026.",
		"WHERE created_at BETWEEN '2026-01-01' AND '2026-06-30' AND status != 'void'; -- 1,208 rows",
		"export const RATE = 0.185; // 18.5% for orders over 2,500; see docs/rates.md#v2",
		"HTTP/1.1 429 Too Many Requests (retry after 30s); x-ratelimit-remaining: 0 of 60",
		"mkdir -p ./out/2026-11 && cp -R src/* ./out/2026-11/ && tar -czf out-11.tar.gz -C ./out 2026-11",
		"The 5th floor flat (No. 12b) costs 1,450/month + 12% service charge; deposit: 2 months.",
		"<tr><td>Qty</td><td>3</td><td>@ 12.50</td><td>= 37.50</td></tr><!-- row 4 of 9 -->",
		"if (n % 2 === 0 && n > 0) { sum += n ** 2; } else { count -= 1; } // 42 cases",
		"Meeting 09:30-10:15 (Room 4B): review Q3 -> Q4 plan, 3 open items, 12% behind.",
		"Why 2 + 2 = 4 and not 5: because 1 + 1 = 2, twice over; see p. 17, note #3.",
		"docker run -d -p 8080:80 --name web-2026 -e \"TZ=UTC\" -v /srv/app:/app:ro nginx:1.27",
	],
};

/** A test length's worth of text: twenty characters a second, well past any hand, so nobody runs dry. */
export const targetLengthFor = (duration: Duration) => duration * 20;

/** One pass through the whole pool in a random order, so a run does not repeat a sentence. */
const shuffled = (pool: string[], random: () => number) => {
	const copy = [...pool];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.min(index, Math.floor(random() * (index + 1)));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
};

/** A passage long enough for the test, every sentence used once before any is used again, ending on a whole word. */
export const passageFor = (difficulty: Difficulty, length: number, random: () => number = Math.random) => {
	const pool = PASSAGES[difficulty];
	let bag: string[] = [];
	let text = "";
	while (text.length < length) {
		if (bag.length === 0) bag = shuffled(pool, random);
		const pick = bag.pop();
		if (pick === undefined) break;
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
