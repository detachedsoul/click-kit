const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export const tokenizeWords = (text: string) => text.match(wordPattern) ?? [];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const phrasePattern = (phrase: string, caseSensitive: boolean) => {
	const words = tokenizeWords(phrase).map(escapeRegExp);
	if (!words.length) return null;
	// Boundaries keep "art" from matching "chart", while allowing punctuation between words.
	return new RegExp(`(?<![\\p{L}\\p{N}])${words.join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`, caseSensitive ? "gu" : "giu");
};

export type KeywordResult = {
	keyword: string;
	count: number;
	words: number;
	density: number;
	firstIndex: number;
};

export type DensityReport = {
	totalWords: number;
	uniqueWords: number;
	keywords: KeywordResult[];
	topTerms: { term: string; count: number; density: number }[];
	missing: string[];
};

export const analyseKeywordDensity = (
	text: string,
	keywords: string[],
	options: { caseSensitive?: boolean; topCount?: number } = {},
): DensityReport => {
	const caseSensitive = options.caseSensitive ?? false;
	const topCount = options.topCount ?? 10;
	const words = tokenizeWords(text);
	const totalWords = words.length;
	const normalized = caseSensitive ? words : words.map((word) => word.toLowerCase());
	const frequency = new Map<string, number>();
	for (const word of normalized) frequency.set(word, (frequency.get(word) ?? 0) + 1);
	const results: KeywordResult[] = keywords
		.map((keyword) => keyword.trim())
		.filter(Boolean)
		.map((keyword) => {
			const pattern = phrasePattern(keyword, caseSensitive);
			const matches = pattern ? [...text.matchAll(pattern)] : [];
			const keywordWords = tokenizeWords(keyword).length;
			const countedWords = matches.length * keywordWords;
			return {
				keyword,
				count: matches.length,
				words: countedWords,
				density: totalWords ? Math.round((countedWords / totalWords) * 1000) / 10 : 0,
				firstIndex: matches[0]?.index ?? -1,
			};
		});
	return {
		totalWords,
		uniqueWords: frequency.size,
		keywords: results,
		topTerms: [...frequency.entries()]
			.map(([term, count]) => ({ term, count, density: totalWords ? Math.round((count / totalWords) * 1000) / 10 : 0 }))
			.sort((left, right) => right.count - left.count || left.term.localeCompare(right.term))
			.slice(0, topCount),
		missing: results.filter((result) => result.count === 0).map((result) => result.keyword),
	};
};

export const verdictFor = (density: number) => {
	if (density === 0) return "not used";
	if (density < 0.5) return "very low";
	if (density < 1) return "low";
	if (density <= 2.5) return "healthy";
	if (density <= 4) return "high";
	return "stuffed";
};
