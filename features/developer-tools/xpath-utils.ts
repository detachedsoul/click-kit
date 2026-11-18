export type XPathMatch = { index: number; path: string; name: string; value: string };

export type XPathResultReport =
	| { kind: "nodes"; count: number; matches: XPathMatch[]; truncated: boolean }
	| { kind: "string"; count: 1; matches: XPathMatch[]; truncated: false }
	| { kind: "number"; count: 1; matches: XPathMatch[]; truncated: false }
	| { kind: "boolean"; count: 1; matches: XPathMatch[]; truncated: false };

const maximumMatches = 200;

export const parseXml = (source: string) => {
	if (!source.trim()) throw new Error("Paste XML to query first.");
	const isHtml = /^\s*<!doctype html/iu.test(source) || /^\s*<html[\s>]/iu.test(source);
	const parser = new DOMParser();
	const doc = parser.parseFromString(source, isHtml ? "text/html" : "application/xml");
	const failure = isHtml ? null : doc.querySelector("parsererror");
	if (failure) throw new Error(`Invalid XML: ${(failure.textContent ?? "could not parse document").replace(/\s+/gu, " ").trim().slice(0, 240)}`);
	if (isHtml && !doc.body) throw new Error("Could not parse this HTML document.");
	return doc;
};

const nodePath = (node: Node): string => {
	if (node.nodeType === Node.ATTRIBUTE_NODE) {
		const attribute = node as Attr;
		return `${attribute.ownerElement ? nodePath(attribute.ownerElement) : "/"}/@${attribute.name}`;
	}
	if (node.nodeType === Node.TEXT_NODE) {
		return `${node.parentNode ? nodePath(node.parentNode) : "/"}/text()`;
	}
	const segments: string[] = [];
	let current: Node | null = node;
	while (current && current.nodeType === Node.ELEMENT_NODE) {
		const element = current as Element;
		const parent = element.parentNode;
		if (!parent) break;
		const siblings = Array.from(parent.childNodes).filter(
			(sibling) => sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === element.tagName,
		);
		const index = siblings.indexOf(element) + 1;
		segments.unshift(`${element.tagName.toLowerCase()}[${index}]`);
		current = parent;
	}
	return segments.length ? `/${segments.join("/")}` : "/";
};

const describeValue = (node: Node) => {
	if (node.nodeType === Node.ATTRIBUTE_NODE) return (node as Attr).value;
	const text = (node.textContent ?? "").replace(/\s+/gu, " ").trim();
	if (text.length > 160) return `${text.slice(0, 160)}…`;
	if (node.nodeType === Node.ELEMENT_NODE) return `<${(node as Element).tagName.toLowerCase()}>${text}`;
	return text;
};

const looksUnbalanced = (expression: string) => {
	let round = 0;
	let square = 0;
	let quote: string | null = null;
	for (const character of expression) {
		if (quote) {
			if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"') quote = character;
		else if (character === "(") round += 1;
		else if (character === ")") round -= 1;
		else if (character === "[") square += 1;
		else if (character === "]") square -= 1;
		if (round < 0 || square < 0) return true;
	}
	return round !== 0 || square !== 0 || quote !== null;
};

export const runXPath = (doc: Document, expression: string): XPathResultReport => {
	if (!expression.trim()) throw new Error("Enter an XPath expression.");
	if (looksUnbalanced(expression)) throw new Error("Invalid XPath expression: unbalanced brackets, parentheses, or quotes.");
	let result: XPathResult;
	try {
		result = doc.evaluate(expression, doc, null, XPathResult.ANY_TYPE, null);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message.replace(/^Failed to execute 'evaluate' on 'Document': /u, "") : "Invalid XPath expression.");
	}
	if (result.resultType === XPathResult.UNORDERED_NODE_ITERATOR_TYPE || result.resultType === XPathResult.ORDERED_NODE_ITERATOR_TYPE) {
		const matches: XPathMatch[] = [];
		let truncated = false;
		for (let node = result.iterateNext(); node; node = result.iterateNext()) {
			if (matches.length >= maximumMatches) {
				truncated = true;
				break;
			}
			matches.push({ index: matches.length + 1, path: nodePath(node), name: node.nodeName.toLowerCase(), value: describeValue(node) });
		}
		return { kind: "nodes", count: matches.length, matches, truncated };
	}
	if (result.resultType === XPathResult.STRING_TYPE) {
		const value = result.stringValue;
		return { kind: "string", count: 1, matches: [{ index: 1, path: "string()", name: "string", value: value.length > 400 ? `${value.slice(0, 400)}…` : value }], truncated: false };
	}
	if (result.resultType === XPathResult.NUMBER_TYPE) {
		return { kind: "number", count: 1, matches: [{ index: 1, path: "number()", name: "number", value: String(result.numberValue) }], truncated: false };
	}
	return { kind: "boolean", count: 1, matches: [{ index: 1, path: "boolean()", name: "boolean", value: String(result.booleanValue) }], truncated: false };
};

export const xpathExamples = [
	"//book",
	"//book[@id='b2']/title",
	"//title/text()",
	"count(//book)",
	"string(//book[1]/author)",
	"//*[price > 30]",
];
