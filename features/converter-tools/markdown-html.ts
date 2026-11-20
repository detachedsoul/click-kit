/**
 * Markdown to HTML without a library or a network call. The source is escaped before any
 * markup is added, so a pasted `<script>` tag comes out as text rather than as a tag.
 */

export type MarkdownOptions = { keepLinks?: boolean; keepImages?: boolean; fullPage?: boolean; title?: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/gu, (character) => ESCAPES[character]);

/** Only http(s), mailto, and relative targets survive; `javascript:` and `data:` links are dropped. */
const safeUrl = (url: string): string | null => {
	const trimmed = url.trim().replace(/^<|>$/gu, "");
	if (!trimmed) return null;
	if (/^(?:javascript|vbscript|data|file):/iu.test(trimmed)) return null;
	if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed) && !/^(?:https?|mailto|tel):/iu.test(trimmed)) return null;
	return escapeHtml(trimmed);
};

/** Inline spans. Runs on already-escaped text, and leaves code spans alone. */
export const inlineHtml = (text: string, options: MarkdownOptions = {}): string => {
	const keepLinks = options.keepLinks ?? true;
	const codeSpans: string[] = [];
	let work = text.replace(/`([^`]+)`/gu, (_match, code: string) => {
		codeSpans.push(`<code>${code}</code>`);
		return `\u0000${codeSpans.length - 1}\u0000`;
	});

	work = work.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu, (match, alt: string, url: string) => {
		if (options.keepImages === false) return alt;
		const href = safeUrl(url);
		return href ? `<img src="${href}" alt="${alt}" />` : match;
	});

	if (keepLinks) {
		work = work
			.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu, (match, label: string, url: string) => {
				const href = safeUrl(url);
				return href ? `<a href="${href}">${label}</a>` : match;
			})
			.replace(/<(https?:\/\/[^\s>]+)>/gu, (_match, url: string) => `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
	}

	work = work
		.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
		.replace(/__([^_]+)__/gu, "<strong>$1</strong>")
		.replace(/(^|[\s(])\*([^*\n]+)\*/gu, "$1<em>$2</em>")
		.replace(/(^|[\s(])_([^_\n]+)_/gu, "$1<em>$2</em>")
		.replace(/~~([^~]+)~~/gu, "<del>$1</del>");

	return work.replace(/\u0000(\d+)\u0000/gu, (_match, index: string) => codeSpans[Number(index)] ?? "");
};

const isBlank = (line: string) => line.trim() === "";

const tableCells = (line: string): string[] =>
	line
		.trim()
		.replace(/^\||\|$/gu, "")
		.split("|")
		.map((cell) => cell.trim());

const isTableDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/u.test(line) && line.includes("-");

const listMatch = (line: string) => /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/u.exec(line);

export const markdownToHtml = (source: string, options: MarkdownOptions = {}): string => {
	const lines = source.replace(/\r\n?/gu, "\n").split("\n");
	const out: string[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];

		if (isBlank(line)) {
			index += 1;
			continue;
		}

		const fence = /^\s*(```|~~~)\s*([^`]*)$/u.exec(line);
		if (fence) {
			const marker = fence[1];
			const language = fence[2].trim();
			const body: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].trim().startsWith(marker)) {
				body.push(lines[index]);
				index += 1;
			}
			index += 1; // skip the closing fence, or run off the end of an unclosed one
			const className = language ? ` class="language-${escapeHtml(language.split(/\s+/u)[0])}"` : "";
			out.push(`<pre><code${className}>${escapeHtml(body.join("\n"))}</code></pre>`);
			continue;
		}

		const heading = /^(#{1,6})\s+(.*?)\s*#*$/u.exec(line);
		if (heading) {
			out.push(`<h${heading[1].length}>${inlineHtml(escapeHtml(heading[2]), options)}</h${heading[1].length}>`);
			index += 1;
			continue;
		}

		if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(line)) {
			out.push("<hr />");
			index += 1;
			continue;
		}

		if (/^\s*>/u.test(line)) {
			const quoted: string[] = [];
			while (index < lines.length && /^\s*>/u.test(lines[index])) {
				quoted.push(lines[index].replace(/^\s*>\s?/u, ""));
				index += 1;
			}
			out.push(`<blockquote>${markdownToHtml(quoted.join("\n"), options)}</blockquote>`);
			continue;
		}

		if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
			const head = tableCells(line);
			const rows: string[][] = [];
			index += 2;
			while (index < lines.length && lines[index].includes("|") && !isBlank(lines[index])) {
				rows.push(tableCells(lines[index]));
				index += 1;
			}
			const headCells = head.map((cell) => `<th>${inlineHtml(escapeHtml(cell), options)}</th>`).join("");
			const bodyRows = rows
				.map((row) => `<tr>${head.map((_cell, column) => `<td>${inlineHtml(escapeHtml(row[column] ?? ""), options)}</td>`).join("")}</tr>`)
				.join("");
			out.push(`<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`);
			continue;
		}

		const list = listMatch(line);
		if (list) {
			const ordered = Boolean(list[2]);
			const items: string[] = [];
			while (index < lines.length) {
				const item = listMatch(lines[index]);
				if (!item || Boolean(item[2]) !== ordered) break;
				let text = item[3];
				index += 1;
				// A wrapped list item keeps its continuation lines.
				while (index < lines.length && !isBlank(lines[index]) && !listMatch(lines[index]) && !/^\s*>/u.test(lines[index])) {
					text += ` ${lines[index].trim()}`;
					index += 1;
				}
				items.push(`<li>${inlineHtml(escapeHtml(text), options)}</li>`);
			}
			const tag = ordered ? "ol" : "ul";
			out.push(`<${tag}>${items.join("")}</${tag}>`);
			continue;
		}

		const paragraph: string[] = [];
		while (
			index < lines.length &&
			!isBlank(lines[index]) &&
			!/^(#{1,6})\s/u.test(lines[index]) &&
			!/^\s*(?:```|~~~)/u.test(lines[index]) &&
			!/^\s*>/u.test(lines[index]) &&
			!listMatch(lines[index]) &&
			!/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u.test(lines[index])
		) {
			paragraph.push(...(index < lines.length ? [lines[index].trim()] : []));
			index += 1;
		}
		if (paragraph.length) out.push(`<p>${inlineHtml(escapeHtml(paragraph.join("\n")), options)}</p>`);
		else index += 1;
	}

	return out.join("\n");
};

/** Words, ignoring the punctuation-only tokens that Markdown syntax leaves behind (##, -, |). */
export const markdownWordCount = (source: string): number =>
	source
		.trim()
		.split(/\s+/u)
		.filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

export const headingCount = (source: string): number => source.split("\n").filter((line) => /^#{1,6}\s+\S/u.test(line)).length;

/** Wraps a fragment in a minimal, self-contained page. */
export const wrapInPage = (fragment: string, title = "Document"): string =>
	[
		"<!doctype html>",
		'<html lang="en">',
		"<head>",
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		`<title>${escapeHtml(title)}</title>`,
		"</head>",
		"<body>",
		fragment,
		"</body>",
		"</html>",
		"",
	].join("\n");
