export type FindReplaceOptions = {
	caseSensitive: boolean;
	wholeWord: boolean;
	useRegex: boolean;
};

export type ReadabilityStats = {
	words: number;
	sentences: number;
	syllables: number;
	readingEase: number | null;
	gradeLevel: number | null;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const createSearchExpression = (search: string, options: FindReplaceOptions) => {
	let source = options.useRegex ? search : escapeRegExp(search);
	if (options.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
	return new RegExp(source, options.caseSensitive ? "gu" : "giu");
};

export const splitTextMatches = (text: string, search: string, options: FindReplaceOptions) => {
	if (!text || !search) return [{ text, isMatch: false }];
	const expression = createSearchExpression(search, options);
	const segments: { text: string; isMatch: boolean }[] = [];
	let previousEnd = 0;
	for (const match of text.matchAll(expression)) {
		const start = match.index ?? 0;
		const matchedText = match[0];
		if (matchedText.length === 0 || start < previousEnd) continue;
		if (start > previousEnd) segments.push({ text: text.slice(previousEnd, start), isMatch: false });
		segments.push({ text: matchedText, isMatch: true });
		previousEnd = start + matchedText.length;
	}
	if (previousEnd < text.length) segments.push({ text: text.slice(previousEnd), isMatch: false });
	return segments.length ? segments : [{ text, isMatch: false }];
};

export const findAndReplaceText = (text: string, search: string, replacement: string, options: FindReplaceOptions) => {
	if (!search) return { text, matches: 0 };
	const expression = createSearchExpression(search, options);
	const matches = [...text.matchAll(expression)].length;
	return { text: text.replace(expression, replacement), matches };
};

export const sortTextLines = (text: string, options: { descending: boolean; caseSensitive: boolean; removeDuplicates: boolean; removeBlankLines: boolean }) => {
	const lines = text.replace(/\r\n?/gu, "\n").split("\n");
	const filteredLines = lines.filter((line) => !(options.removeBlankLines && line.trim() === ""));
	const seenLines = new Set<string>();
	const uniqueLines = options.removeDuplicates ? filteredLines.filter((line) => {
		const comparisonKey = options.caseSensitive ? line : line.toLocaleLowerCase();
		if (seenLines.has(comparisonKey)) return false;
		seenLines.add(comparisonKey);
		return true;
	}) : filteredLines;
	return uniqueLines.sort((left, right) => {
		const comparison = left.localeCompare(right, undefined, { sensitivity: options.caseSensitive ? "variant" : "base", numeric: true });
		return options.descending ? -comparison : comparison;
	}).join("\n");
};

export const createSlug = (text: string) => text
	.normalize("NFKD")
	.replace(/\p{M}/gu, "")
	.toLocaleLowerCase()
	.replace(/[^\p{L}\p{N}]+/gu, "-")
	.replace(/^-+|-+$/gu, "");

const countSyllables = (word: string) => {
	const normalizedWord = word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
	if (!normalizedWord) return 0;
	if (normalizedWord.length <= 3) return 1;
	const vowelGroups = normalizedWord.match(/[aeiouy]+/gu) ?? [];
	let syllables = vowelGroups.length;
	if (normalizedWord.endsWith("e") && !normalizedWord.endsWith("le") && syllables > 1) syllables -= 1;
	return Math.max(1, syllables);
};

export const analyzeReadability = (text: string): ReadabilityStats => {
	const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
	const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/gu)?.filter((sentence) => /[\p{L}\p{N}]/u.test(sentence)).length ?? 0;
	const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
	if (words.length === 0 || sentences === 0) return { words: words.length, sentences, syllables, readingEase: null, gradeLevel: null };
	const wordsPerSentence = words.length / sentences;
	const syllablesPerWord = syllables / words.length;
	return {
		words: words.length,
		sentences,
		syllables,
		readingEase: Math.round((206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord) * 10) / 10,
		gradeLevel: Math.round((0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10) / 10,
	};
};

export const extractTextItems = (text: string, kind: "emails" | "urls" | "phones" | "hashtags") => {
	const patterns: Record<typeof kind, RegExp> = {
		emails: /[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?)+/giu,
		urls: /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/giu,
		phones: /(?:\+?\d[\d\s().-]{6,}\d)/gu,
		hashtags: /#[\p{L}\p{N}_]+/gu,
	};
	const matches = text.match(patterns[kind]) ?? [];
	const normalizedMatches = kind === "urls" ? matches.map((match) => match.replace(/[.,!?;:]+$/u, "")) : matches;
	return [...new Set(normalizedMatches)];
};

const voidHtmlTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const blockHtmlTags = new Set(["address", "article", "aside", "blockquote", "body", "dd", "details", "dialog", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "li", "main", "nav", "ol", "p", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul"]);
const inlineHtmlTags = new Set(["a", "abbr", "b", "bdi", "bdo", "br", "button", "cite", "code", "em", "i", "img", "label", "q", "s", "small", "span", "strong", "sub", "sup", "time", "u"]);
const preservedHtmlTags = new Set(["pre", "textarea", "script", "style"]);

export const formatMarkup = (source: string, format: "html" | "xml", indentation = 2) => {
	if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return source;
	const parser = new DOMParser();
	const parsed = format === "html" ? parser.parseFromString(source, "text/html") : parser.parseFromString(source, "application/xml");
	if (format === "xml" && parsed.querySelector("parsererror")) throw new Error("The XML is not well-formed. Check the tags and attributes.");
	const indent = (depth: number) => " ".repeat(depth * indentation);
	const xmlSerializer = new XMLSerializer();
	const serializeXmlNode = (node: Node, depth: number): string => {
		if (node.nodeType !== Node.ELEMENT_NODE) return xmlSerializer.serializeToString(node);
		const element = node as Element;
		const shallowMarkup = xmlSerializer.serializeToString(element.cloneNode(false));
		const closingIndex = shallowMarkup.lastIndexOf("</");
		const childNodes = Array.from(element.childNodes);
		if (childNodes.length === 0) return shallowMarkup;
		const selfClosing = shallowMarkup.endsWith("/>");
		const opening = selfClosing ? `${shallowMarkup.slice(0, -2)}>` : shallowMarkup.slice(0, closingIndex);
		const closing = selfClosing ? `</${element.nodeName}>` : shallowMarkup.slice(closingIndex);
		const hasTextNode = childNodes.some((child) => child.nodeType === Node.TEXT_NODE);
		if (hasTextNode) return `${opening}${childNodes.map((child) => serializeXmlNode(child, depth + 1)).join("")}${closing}`;
		const formattedChildren = childNodes.map((child) => `${indent(depth + 1)}${serializeXmlNode(child, depth + 1)}`);
		return formattedChildren.length ? `${opening}\n${formattedChildren.join("\n")}\n${indent(depth)}${closing}` : shallowMarkup;
	};
	const serializeHtmlNode = (node: Node, depth: number): string => {
		if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? "").replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
		if (node.nodeType !== Node.ELEMENT_NODE) return new XMLSerializer().serializeToString(node);
		const element = node as HTMLElement;
		const tagName = element.tagName.toLowerCase();
		if (preservedHtmlTags.has(tagName)) return element.outerHTML;
		const shallowMarkup = (element.cloneNode(false) as HTMLElement).outerHTML;
		if (voidHtmlTags.has(tagName)) return shallowMarkup;
		const closingTag = `</${tagName}>`;
		const closingIndex = shallowMarkup.lastIndexOf(closingTag);
		const opening = closingIndex < 0 ? `<${tagName}>` : shallowMarkup.slice(0, closingIndex);
		const childNodes = Array.from(element.childNodes);
		const childTags = childNodes.filter((child): child is Element => child.nodeType === Node.ELEMENT_NODE).map((child) => child.tagName.toLowerCase());
		const hasTextContent = childNodes.some((child) => child.nodeType === Node.TEXT_NODE && Boolean(child.nodeValue?.trim()));
		const hasTextOnlyContent = childTags.length === 0 && childNodes.some((child) => child.nodeType === Node.TEXT_NODE);
		const hasOnlyInlineChildren = childTags.length > 0 && childTags.every((childTag) => inlineHtmlTags.has(childTag));
		if (hasTextContent || hasTextOnlyContent || hasOnlyInlineChildren || !blockHtmlTags.has(tagName)) return `${opening}${childNodes.map((child) => serializeHtmlNode(child, depth + 1)).join("")}${closingTag}`;
		const formattedChildren = childNodes.filter((child) => child.nodeType !== Node.TEXT_NODE || Boolean(child.nodeValue?.trim())).map((child) => `${indent(depth + 1)}${serializeHtmlNode(child, depth + 1)}`);
		return formattedChildren.length ? `${opening}\n${formattedChildren.join("\n")}\n${indent(depth)}${closingTag}` : `${opening}${closingTag}`;
	};
	if (format === "xml") return parsed.documentElement ? serializeXmlNode(parsed.documentElement, 0) : "";
	return Array.from(parsed.body.childNodes).filter((node) => node.nodeType !== Node.TEXT_NODE || Boolean(node.nodeValue?.trim())).map((node) => serializeHtmlNode(node, 0)).join("\n");
};

export const formatTextDocument = (source: string, format: "json" | "html" | "xml", indentation: number) => {
	if (format === "json") {
		const parsed: unknown = JSON.parse(source);
		return JSON.stringify(parsed, null, indentation);
	}
	if (format === "xml" && typeof DOMParser !== "undefined") {
		const parsed = new DOMParser().parseFromString(source, "application/xml");
		if (parsed.querySelector("parsererror")) throw new Error("The XML is not well-formed. Check the tags and attributes.");
	}
	if (format === "html" && typeof DOMParser !== "undefined" && !source.trim()) return "";
	return formatMarkup(source, format, indentation);
};

export const createMarkdownTable = (source: string, delimiter: "tab" | "comma") => {
	const separator = delimiter === "tab" ? "\t" : ",";
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let insideQuotes = false;
	const normalizedSource = source.replace(/\r\n?/gu, "\n");
	for (let index = 0; index < normalizedSource.length; index += 1) {
		const character = normalizedSource[index];
		if (character === '"') {
			if (insideQuotes && normalizedSource[index + 1] === '"') {
				cell += '"';
				index += 1;
			} else insideQuotes = !insideQuotes;
		} else if (character === separator && !insideQuotes) {
			row.push(cell.trim());
			cell = "";
		} else if (character === "\n" && !insideQuotes) {
			row.push(cell.trim());
			if (row.some((value) => value.length > 0)) rows.push(row);
			row = [];
			cell = "";
		} else cell += character;
	}
	row.push(cell.trim());
	if (row.some((value) => value.length > 0)) rows.push(row);
	if (rows.length === 0) return "";
	const columns = Math.max(...rows.map((items) => items.length));
	const normalizedRows = rows.map((items) => Array.from({ length: columns }, (_, index) => (items[index] ?? "").replace(/\\/gu, "\\\\").replace(/\n/gu, "<br>").replace(/\|/gu, "\\|")));
	const renderRow = (items: string[]) => `| ${items.join(" | ")} |`;
	return [renderRow(normalizedRows[0]), renderRow(Array.from({ length: columns }, () => "---")), ...normalizedRows.slice(1).map(renderRow)].join("\n");
};

export const encodeHtmlEntities = (text: string) => text.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);

export const decodeHtmlEntities = (text: string) => {
	if (typeof DOMParser === "undefined") return text.replace(/&(?:amp|lt|gt|quot|#39);/gu, (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" })[entity] ?? entity);
	return new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? "";
};

export const encodeUrlComponent = (text: string) => encodeURIComponent(text);
export const decodeUrlComponent = (text: string) => decodeURIComponent(text);

export const inspectUnicodeText = (text: string) => Array.from(text, (character) => {
	const codePoint = character.codePointAt(0) ?? 0;
	return { character, codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(codePoint <= 0xffff ? 4 : 5, "0")}`, decimal: codePoint };
});

export const reverseGraphemes = (text: string) => {
	if (typeof Intl.Segmenter !== "undefined") return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), ({ segment }) => segment).reverse().join("");
	return Array.from(text).reverse().join("");
};

export const generateLoremIpsum = (paragraphs: number, wordsPerParagraph: number) => {
	const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
	return Array.from({ length: paragraphs }, (_, paragraphIndex) => {
		const sentenceWords = Array.from({ length: wordsPerParagraph }, (_, wordIndex) => words[(paragraphIndex * wordsPerParagraph + wordIndex) % words.length]);
		const paragraph = sentenceWords.join(" ");
		return paragraph ? `${paragraph[0].toLocaleUpperCase()}${paragraph.slice(1)}.` : "";
	}).join("\n\n");
};

const escapeMarkdownHtml = (text: string) => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");

const renderInlineMarkdown = (text: string) => escapeMarkdownHtml(text)
	.replace(/`([^`]+)`/gu, "<code>$1</code>")
	.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
	.replace(/\*([^*]+)\*/gu, "<em>$1</em>")
	.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gu, '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>');

export const renderSafeMarkdown = (source: string) => {
	const lines = source.replace(/\r\n?/gu, "\n").split("\n");
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let list: string[] = [];
	let code: string[] = [];
	let insideCode = false;
	const flushParagraph = () => {
		if (paragraph.length) blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
		paragraph = [];
	};
	const flushList = () => {
		if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
		list = [];
	};
	for (const line of lines) {
		if (line.trimStart().startsWith("```")) {
			flushParagraph();
			flushList();
			if (insideCode) {
				blocks.push(`<pre><code>${escapeMarkdownHtml(code.join("\n"))}</code></pre>`);
				code = [];
			}
			insideCode = !insideCode;
			continue;
		}
		if (insideCode) {
			code.push(line);
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.+)$/u);
		const bullet = line.match(/^\s*[-*+]\s+(.+)$/u);
		if (heading) {
			flushParagraph();
			flushList();
			const level = heading[1].length;
			blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
		} else if (bullet) {
			flushParagraph();
			list.push(bullet[1]);
		} else if (line.trim() === "") {
			flushParagraph();
			flushList();
		} else if (/^---+$/u.test(line.trim())) {
			flushParagraph();
			flushList();
			blocks.push("<hr>");
		} else {
			flushList();
			paragraph.push(line.trim());
		}
	}
	flushParagraph();
	flushList();
	if (insideCode && code.length) blocks.push(`<pre><code>${escapeMarkdownHtml(code.join("\n"))}</code></pre>`);
	return blocks.join("");
};
