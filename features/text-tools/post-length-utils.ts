export type Platform = { id: string; label: string; limit: number; note: string };

export const PLATFORMS: Platform[] = [
	{ id: "x", label: "X / Twitter", limit: 280, note: "Every link counts as 23 characters, however long it is." },
	{ id: "threads", label: "Threads", limit: 500, note: "500 characters per post." },
	{ id: "sms", label: "SMS", limit: 160, note: "A long message is split and billed as more than one SMS." },
	{ id: "meta-description", label: "Meta description", limit: 160, note: "Search results cut off after roughly this many." },
	{ id: "instagram", label: "Instagram caption", limit: 2200, note: "Only the first 125 characters show before “more”." },
	{ id: "linkedin", label: "LinkedIn post", limit: 3000, note: "Only the first three lines show before “see more”." },
	{ id: "youtube-title", label: "YouTube title", limit: 100, note: "Longer titles are rejected, not truncated." },
	{ id: "facebook", label: "Facebook post", limit: 63206, note: "Very long posts are collapsed behind “see more”." },
];

const URL_PATTERN = /\bhttps?:\/\/[^\s]+/giu;

/** People count what they see: an emoji or an accent counts once. */
export const countGraphemes = (text: string) => {
	const segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment: (input: string) => Iterable<{ segment: string }> } })
		.Segmenter;
	if (!segmenter) return [...text].length;
	let count = 0;
	for (const piece of new segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
		void piece;
		count += 1;
	}
	return count;
};

export const linkCount = (text: string) => (text.match(URL_PATTERN) ?? []).length;

/** X charges every link a flat 23 characters, so a long URL is not penalised. */
export const weightedLength = (text: string, platformId: string) => {
	if (platformId !== "x") return countGraphemes(text);
	return countGraphemes(text.replace(URL_PATTERN, "")) + linkCount(text) * 23;
};

const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\[~\]|€]*$/u;

/** An SMS is split at 160 characters — or 70 when the text leaves the GSM alphabet, at 153 per part after that. */
export const smsSegments = (text: string) => {
	const length = countGraphemes(text);
	if (length === 0) return 0;
	const basic = GSM7.test(text);
	if (length <= (basic ? 160 : 70)) return 1;
	return Math.ceil(length / (basic ? 153 : 67));
};

export type PlatformReport = Platform & { used: number; remaining: number; over: number; percent: number; fits: boolean };

export const platformReport = (text: string, platform: Platform): PlatformReport => {
	const used = weightedLength(text, platform.id);
	const remaining = Math.max(0, platform.limit - used);
	const over = Math.max(0, used - platform.limit);
	return {
		...platform,
		used,
		remaining,
		over,
		percent: platform.limit > 0 ? Math.min(100, Math.round((used / platform.limit) * 1000) / 10) : 0,
		fits: over === 0,
	};
};

export const allPlatformReports = (text: string) => PLATFORMS.map((platform) => platformReport(text, platform));

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/u).length : 0);

export const lengthSummary = ({ used, limit }: { used: number; limit: number }) => (used > limit ? `${used - limit} over the ${limit} limit` : `${limit - used} of ${limit} left`);
