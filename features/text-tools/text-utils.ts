export type TextStatistics = {
	words: number;
	charactersWithSpaces: number;
	charactersWithoutSpaces: number;
	readingMinutes: number;
};

export type TextCase = "uppercase" | "lowercase" | "title" | "sentence" | "camel" | "kebab" | "snake";

export type CleanTextOptions = {
	trimLineWhitespace: boolean;
	collapseHorizontalWhitespace: boolean;
	removeBlankLines: boolean;
};

export type TextDiffKind = "same" | "added" | "removed";

export type TextDiffSegment = {
	kind: TextDiffKind;
	text: string;
};

export type TextDiffResult = {
	segments: TextDiffSegment[];
	added: number;
	removed: number;
};

export const DEFAULT_CLEAN_TEXT_OPTIONS: Readonly<CleanTextOptions> = {
	trimLineWhitespace: true,
	collapseHorizontalWhitespace: true,
	removeBlankLines: false,
};

const wordSegmenter = typeof Intl.Segmenter === "undefined"
	? undefined
	: new Intl.Segmenter(undefined, { granularity: "word" });
const graphemeSegmenter = typeof Intl.Segmenter === "undefined"
	? undefined
	: new Intl.Segmenter(undefined, { granularity: "grapheme" });

const countWords = (text: string): number => {
	let words = 0;
	if (wordSegmenter) {
		for (const segment of wordSegmenter.segment(text)) {
			if (segment.isWordLike) words += 1;
		}
		return words;
	}

	const wordPattern = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
	while (wordPattern.exec(text)) words += 1;
	return words;
};

const countGraphemeCharacters = (text: string) => {
	let charactersWithSpaces = 0;
	let charactersWithoutSpaces = 0;
	const segments = graphemeSegmenter?.segment(text);

	if (segments) {
		for (const { segment } of segments) {
			charactersWithSpaces += 1;
			if (!/\s/u.test(segment)) charactersWithoutSpaces += 1;
		}
		return { charactersWithSpaces, charactersWithoutSpaces };
	}

	for (const character of text) {
		charactersWithSpaces += 1;
		if (!/\s/u.test(character)) charactersWithoutSpaces += 1;
	}
	return { charactersWithSpaces, charactersWithoutSpaces };
};

export const countGraphemes = (text: string): number => countGraphemeCharacters(text).charactersWithSpaces;

export const countText = (text: string): TextStatistics => {
	const words = countWords(text);
	const { charactersWithSpaces, charactersWithoutSpaces } = countGraphemeCharacters(text);

	return {
		words,
		charactersWithSpaces,
		charactersWithoutSpaces,
		readingMinutes: words === 0 ? 0 : Math.ceil(words / 200),
	};
};

const splitWords = (text: string): string[] => {
	const separatedCaseBoundaries = text
		.replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
		.replace(/([\p{Lu}])([\p{Lu}][\p{Ll}])/gu, "$1 $2");

	return separatedCaseBoundaries.match(/[\p{L}\p{N}]+/gu) ?? [];
};

const toTitleCase = (text: string): string => text.replace(/[\p{L}][\p{L}\p{M}\p{N}'’]*/gu, (word) => {
	const [firstLetter, ...remainingLetters] = Array.from(word);
	return `${firstLetter.toUpperCase()}${remainingLetters.join("").toLowerCase()}`;
});

const toSentenceCase = (text: string): string => {
	let capitalizeNextLetter = true;

	return Array.from(text.toLowerCase(), (character) => {
		if (/\p{L}/u.test(character) && capitalizeNextLetter) {
			capitalizeNextLetter = false;
			return character.toUpperCase();
		}
		if (/[.!?]/u.test(character)) capitalizeNextLetter = true;
		return character;
	}).join("");
};

export const convertCase = (text: string, textCase: TextCase): string => {
	switch (textCase) {
		case "uppercase":
			return text.toUpperCase();
		case "lowercase":
			return text.toLowerCase();
		case "title":
			return toTitleCase(text.toLowerCase());
		case "sentence":
			return toSentenceCase(text);
		case "camel": {
			const [firstWord, ...remainingWords] = splitWords(text).map((word) => word.toLowerCase());
			return `${firstWord ?? ""}${remainingWords.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join("")}`;
		}
		case "kebab":
			return splitWords(text).map((word) => word.toLowerCase()).join("-");
		case "snake":
			return splitWords(text).map((word) => word.toLowerCase()).join("_");
	}
};

export const cleanText = (
	text: string,
	options: CleanTextOptions = DEFAULT_CLEAN_TEXT_OPTIONS,
): string => {
	const lines = text.replace(/\r\n?/gu, "\n").split("\n").map((line) => {
		const edgeCleanedLine = options.trimLineWhitespace ? line.trim() : line;
		return options.collapseHorizontalWhitespace
			? edgeCleanedLine.replace(/[ \t]+/gu, " ")
			: edgeCleanedLine;
	});

	return (options.removeBlankLines ? lines.filter((line) => line.trim().length > 0) : lines).join("\n");
};

const tokenizeForDiff = (text: string): string[] => text.match(/\s+|[^\s]+/gu) ?? [];

const getLcsLengths = (left: string[], right: string[]): Uint32Array => {
	let previous = new Uint32Array(right.length + 1);

	for (const leftToken of left) {
		const current = new Uint32Array(right.length + 1);
		for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
			current[rightIndex + 1] = leftToken === right[rightIndex]
				? previous[rightIndex] + 1
				: Math.max(previous[rightIndex + 1], current[rightIndex]);
		}
		previous = current;
	}

	return previous;
};

type Match = { leftIndex: number; rightIndex: number };

const findCommonMatches = (
	left: string[],
	right: string[],
	leftOffset = 0,
	rightOffset = 0,
): Match[] => {
	if (left.length === 0 || right.length === 0) return [];

	let commonPrefixLength = 0;
	while (commonPrefixLength < left.length && commonPrefixLength < right.length && left[commonPrefixLength] === right[commonPrefixLength]) {
		commonPrefixLength += 1;
	}

	let commonSuffixLength = 0;
	while (
		commonSuffixLength < left.length - commonPrefixLength
		&& commonSuffixLength < right.length - commonPrefixLength
		&& left[left.length - commonSuffixLength - 1] === right[right.length - commonSuffixLength - 1]
	) {
		commonSuffixLength += 1;
	}

	const prefixMatches = Array.from({ length: commonPrefixLength }, (_, index) => ({
		leftIndex: leftOffset + index,
		rightIndex: rightOffset + index,
	}));
	const suffixMatches = Array.from({ length: commonSuffixLength }, (_, index) => ({
		leftIndex: leftOffset + left.length - commonSuffixLength + index,
		rightIndex: rightOffset + right.length - commonSuffixLength + index,
	}));
	const middleLeft = left.slice(commonPrefixLength, left.length - commonSuffixLength);
	const middleRight = right.slice(commonPrefixLength, right.length - commonSuffixLength);

	if (middleLeft.length === 0 || middleRight.length === 0) return [...prefixMatches, ...suffixMatches];
	const rightTokens = new Set(middleRight);
	if (!middleLeft.some((token) => rightTokens.has(token))) return [...prefixMatches, ...suffixMatches];
	if (middleLeft.length === 1) {
		const rightIndex = middleRight.indexOf(middleLeft[0]);
		const middleMatches = rightIndex === -1 ? [] : [{
			leftIndex: leftOffset + commonPrefixLength,
			rightIndex: rightOffset + commonPrefixLength + rightIndex,
		}];
		return [...prefixMatches, ...middleMatches, ...suffixMatches];
	}

	const leftMiddle = Math.floor(middleLeft.length / 2);
	const leftHalfLengths = getLcsLengths(middleLeft.slice(0, leftMiddle), middleRight);
	const rightHalfLengths = getLcsLengths(middleLeft.slice(leftMiddle).reverse(), middleRight.slice().reverse());
	let rightMiddle = 0;
	let longestLength = -1;

	for (let rightIndex = 0; rightIndex <= middleRight.length; rightIndex += 1) {
		const combinedLength = leftHalfLengths[rightIndex] + rightHalfLengths[middleRight.length - rightIndex];
		if (combinedLength > longestLength) {
			longestLength = combinedLength;
			rightMiddle = rightIndex;
		}
	}

	return [
		...prefixMatches,
		...findCommonMatches(middleLeft.slice(0, leftMiddle), middleRight.slice(0, rightMiddle), leftOffset + commonPrefixLength, rightOffset + commonPrefixLength),
		...findCommonMatches(middleLeft.slice(leftMiddle), middleRight.slice(rightMiddle), leftOffset + commonPrefixLength + leftMiddle, rightOffset + commonPrefixLength + rightMiddle),
		...suffixMatches,
	];
};

const countChangedUnits = (text: string): number => {
	const visibleUnits = text.match(/\S+/gu)?.length ?? 0;
	return visibleUnits || (text.length > 0 ? 1 : 0);
};

export const diffText = (originalText: string, revisedText: string): TextDiffResult => {
	if (originalText === revisedText) {
		return {
			segments: originalText ? [{ kind: "same", text: originalText }] : [],
			added: 0,
			removed: 0,
		};
	}

	const originalTokens = tokenizeForDiff(originalText);
	const revisedTokens = tokenizeForDiff(revisedText);
	const matches = findCommonMatches(originalTokens, revisedTokens);
	const segments: TextDiffSegment[] = [];
	const appendSegment = (kind: TextDiffKind, text: string) => {
		if (!text) return;
		const previous = segments.at(-1);
		if (previous?.kind === kind) previous.text += text;
		else segments.push({ kind, text });
	};

	let originalIndex = 0;
	let revisedIndex = 0;
	for (const match of matches) {
		while (originalIndex < match.leftIndex) {
			appendSegment("removed", originalTokens[originalIndex]);
			originalIndex += 1;
		}
		while (revisedIndex < match.rightIndex) {
			appendSegment("added", revisedTokens[revisedIndex]);
			revisedIndex += 1;
		}
		appendSegment("same", originalTokens[match.leftIndex]);
		originalIndex = match.leftIndex + 1;
		revisedIndex = match.rightIndex + 1;
	}

	while (originalIndex < originalTokens.length) {
		appendSegment("removed", originalTokens[originalIndex]);
		originalIndex += 1;
	}
	while (revisedIndex < revisedTokens.length) {
		appendSegment("added", revisedTokens[revisedIndex]);
		revisedIndex += 1;
	}

	return {
		segments,
		added: segments.filter((segment) => segment.kind === "added").reduce((total, segment) => total + countChangedUnits(segment.text), 0),
		removed: segments.filter((segment) => segment.kind === "removed").reduce((total, segment) => total + countChangedUnits(segment.text), 0),
	};
};
