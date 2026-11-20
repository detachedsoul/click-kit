/**
 * HTML → Markdown.
 *
 * A small, predictable walk of the parsed tree: the elements people actually paste
 * (headings, paragraphs, lists, quotes, code, links, images, tables) come out as plain
 * Markdown, and anything else keeps its text. No library, so nothing is uploaded and no
 * surprise HTML leaks into the output.
 */

export type HtmlToMarkdownOptions = {
	keepLinks?: boolean;
	keepImages?: boolean;
};

const BLOCK = new Set(["ADDRESS", "ARTICLE", "ASIDE", "DIV", "FOOTER", "HEADER", "MAIN", "NAV", "SECTION", "P"]);

const collapse = (text: string) => text.replace(/[ \t\u00a0]+/gu, " ").replace(/ ?\n ?/gu, "\n");

const escapeText = (text: string) => text.replace(/([\\`*_[\]])/gu, "\\$1");

const clean = (text: string) =>
	collapse(text)
		.replace(/\n{3,}/gu, "\n\n")
		.trim();

const childrenOf = (node: Node) => Array.from(node.childNodes);

const rawTextOf = (node: Node): string => {
	if (node.nodeType === 3) return node.textContent ?? "";
	return childrenOf(node)
		.map((child) => rawTextOf(child))
		.join("");
};

const listMarkdown = (element: Element, options: Required<HtmlToMarkdownOptions>) => {
	const ordered = element.tagName === "OL";
	return childrenOf(element)
		.filter((child): child is Element => child.nodeType === 1 && (child as Element).tagName === "LI")
		.map((item, index) => {
			const body = clean(walk(item, options)).replace(/\n/gu, "\n   ");
			return `${ordered ? `${index + 1}.` : "-"} ${body}`;
		})
		.join("\n");
};

const tableMarkdown = (element: Element, options: Required<HtmlToMarkdownOptions>) => {
	const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
		Array.from(row.querySelectorAll("th,td")).map((cell) => clean(walk(cell, options)).replace(/\|/gu, "\\|").replace(/\n/gu, " ")),
	);
	if (rows.length === 0) return "";
	const width = Math.max(...rows.map((row) => row.length));
	const padded = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
	const header = padded[0];
	const divider = header.map(() => "---");
	return [header, divider, ...padded.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
};

const walk = (node: Node, options: Required<HtmlToMarkdownOptions>): string => {
	if (node.nodeType === 3) return escapeText(collapse(node.textContent ?? ""));
	if (node.nodeType !== 1) return "";
	const element = node as Element;
	const tag = element.tagName;
	const inner = () => childrenOf(element).map((child) => walk(child, options)).join("");

	if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD"].includes(tag)) return "";
	if (tag === "BR") return "  \n";
	if (tag === "HR") return "\n\n---\n\n";
	if (BLOCK.has(tag)) return `\n\n${inner()}\n\n`;
	if (/^H[1-6]$/u.test(tag)) {
		const level = Number(tag.slice(1));
		return `\n\n${"#".repeat(level)} ${clean(inner())}\n\n`;
	}
	if (tag === "STRONG" || tag === "B") return `**${inner().trim()}**`;
	if (tag === "EM" || tag === "I") return `*${inner().trim()}*`;
	if (tag === "DEL" || tag === "S" || tag === "STRIKE") return `~~${inner().trim()}~~`;
	if (tag === "CODE" && element.parentElement?.tagName !== "PRE") return `\`${rawTextOf(element)}\``;
	if (tag === "PRE") {
		const code = element.querySelector("code");
		const language = (code?.className ?? "").match(/language-([\w-]+)/u)?.[1] ?? "";
		const body = rawTextOf(code ?? element).replace(/\n$/u, "");
		return `\n\n\`\`\`${language}\n${body}\n\`\`\`\n\n`;
	}
	if (tag === "BLOCKQUOTE") return `\n\n${clean(inner()).split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")}\n\n`;
	if (tag === "UL" || tag === "OL") return `\n\n${listMarkdown(element, options)}\n\n`;
	if (tag === "TABLE") return `\n\n${tableMarkdown(element, options)}\n\n`;
	if (tag === "A") {
		const href = element.getAttribute("href") ?? "";
		const label = clean(inner());
		if (!options.keepLinks || !href || href.startsWith("#")) return label;
		return `[${label || href}](${href})`;
	}
	if (tag === "IMG") {
		if (!options.keepImages) return "";
		const src = element.getAttribute("src") ?? "";
		const alt = element.getAttribute("alt") ?? "";
		return src ? `![${alt}](${src})` : "";
	}
	return inner();
};

/** Converts an HTML fragment or a whole document into Markdown. */
export const htmlToMarkdown = (html: string, options: HtmlToMarkdownOptions = {}) => {
	const settings = { keepLinks: options.keepLinks ?? true, keepImages: options.keepImages ?? true };
	if (typeof DOMParser === "undefined") return "";
	const doc = new DOMParser().parseFromString(html, "text/html");
	const root = doc.body ?? doc.documentElement;
	const markdown = childrenOf(root)
		.map((child) => walk(child, settings))
		.join("");
	return clean(
		markdown
			.split("\n")
			.map((line) => line.replace(/[ \t]+$/u, ""))
			.join("\n"),
	);
};

/** Title of the document, when it has one. */
export const htmlTitle = (html: string) => {
	if (typeof DOMParser === "undefined") return "";
	const doc = new DOMParser().parseFromString(html, "text/html");
	return doc.querySelector("title")?.textContent?.trim() ?? "";
};

const LINE_BREAKERS = new Set(["LI", "TR", "BLOCKQUOTE", "PRE", "FIGCAPTION"]);

/** The words only, one line per block, as a plain-text export would look. */
const textOfNode = (node: Node): string => {
	if (node.nodeType === 3) return node.textContent ?? "";
	if (node.nodeType !== 1) return "";
	const element = node as Element;
	const tag = element.tagName;
	if (["SCRIPT", "STYLE", "HEAD", "NOSCRIPT", "TEMPLATE"].includes(tag)) return "";
	if (tag === "BR") return "\n";
	const inner = childrenOf(element).map(textOfNode).join("");
	if (tag === "TD" || tag === "TH") return `${inner} `;
	if (BLOCK.has(tag) || /^H[1-6]$/u.test(tag) || LINE_BREAKERS.has(tag)) return `\n${inner}\n`;
	return inner;
};

export const textOfHtml = (html: string) => {
	if (typeof DOMParser === "undefined") return "";
	const doc = new DOMParser().parseFromString(html, "text/html");
	return clean(textOfNode(doc.body ?? doc.documentElement));
};
