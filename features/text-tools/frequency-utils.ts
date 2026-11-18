export const stopWords = new Set([
	"a",
	"about",
	"after",
	"all",
	"also",
	"an",
	"and",
	"any",
	"are",
	"as",
	"at",
	"be",
	"because",
	"been",
	"but",
	"by",
	"can",
	"could",
	"did",
	"do",
	"does",
	"for",
	"from",
	"had",
	"has",
	"have",
	"he",
	"her",
	"his",
	"how",
	"i",
	"if",
	"in",
	"into",
	"is",
	"it",
	"its",
	"just",
	"me",
	"more",
	"most",
	"my",
	"no",
	"not",
	"of",
	"on",
	"or",
	"our",
	"out",
	"she",
	"so",
	"some",
	"than",
	"that",
	"the",
	"their",
	"them",
	"then",
	"there",
	"these",
	"they",
	"this",
	"to",
	"too",
	"up",
	"us",
	"was",
	"we",
	"were",
	"what",
	"when",
	"which",
	"who",
	"will",
	"with",
	"would",
	"you",
	"your",
]);

export type FrequencyOptions = { ngram: 1 | 2 | 3; ignoreCase: boolean; removeStopWords: boolean; minimumLength: number; limit: number };
export type FrequencyRow = { phrase: string; count: number; share: number };

export const tokenize = (source: string, ignoreCase: boolean) => {
	const tokens = source.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
	return ignoreCase ? tokens.map((token) => token.toLowerCase()) : tokens;
};

export const wordFrequency = (source: string, options: Partial<FrequencyOptions> = {}) => {
	const settings: FrequencyOptions = { ngram: 1, ignoreCase: true, removeStopWords: false, minimumLength: 1, limit: 50, ...options };
	if (!source.trim()) throw new Error("Paste some text to analyse.");
	if (!Number.isInteger(settings.limit) || settings.limit < 1 || settings.limit > 500) throw new Error("Show between 1 and 500 phrases.");
	const tokens = tokenize(source, settings.ignoreCase).filter((token) => token.length >= settings.minimumLength);
	if (tokens.length === 0) throw new Error("No words found in this text.");
	const counts = new Map<string, number>();
	let total = 0;
	for (let index = 0; index <= tokens.length - settings.ngram; index += 1) {
		const gram = tokens.slice(index, index + settings.ngram);
		if (settings.removeStopWords && gram.some((token) => stopWords.has(token))) continue;
		const phrase = gram.join(" ");
		counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
		total += 1;
	}
	if (counts.size === 0) throw new Error("Every phrase was filtered out. Try keeping stop words or lowering the minimum length.");
	const rows: FrequencyRow[] = [...counts.entries()]
		.map(([phrase, count]) => ({ phrase, count, share: Math.round((count / total) * 1000) / 10 }))
		.sort((left, right) => right.count - left.count || left.phrase.localeCompare(right.phrase));
	return { rows: rows.slice(0, settings.limit), total, unique: counts.size, words: tokens.length, ngram: settings.ngram };
};

export const frequencyToCsv = (rows: FrequencyRow[]) => ["phrase,count,share", ...rows.map((row) => `"${row.phrase.replaceAll('"', '""')}",${row.count},${row.share}`)].join("\n");

export const frequencyToJson = (rows: FrequencyRow[]) => JSON.stringify(rows, null, 2);
