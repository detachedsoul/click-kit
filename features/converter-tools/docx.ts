/**
 * Word documents (.docx) to Markdown or plain text.
 *
 * A .docx is a zip with `word/document.xml` inside. We read the paragraphs, headings,
 * lists, emphasis, and tables out of that XML — no library, no upload — and write them as
 * Markdown. Anything Word-only (comments, tracked changes, text boxes) is left behind
 * rather than guessed at.
 */

import { readZipFile } from "@/features/converter-tools/zip-reader";

const children = (element: Element) => Array.from(element.children);
const local = (element: Element) => element.localName;

const attribute = (element: Element | undefined, ...names: string[]) => {
	if (!element) return "";
	for (const name of names) {
		const value = element.getAttribute(`w:${name}`) ?? element.getAttribute(name);
		if (value) return value;
	}
	return "";
};

/** The visible text of a run, wrapped in the Markdown its formatting deserves. */
const runMarkdown = (run: Element): string => {
	let text = "";
	for (const node of children(run)) {
		const name = local(node);
		if (name === "t") text += node.textContent ?? "";
		else if (name === "tab") text += "  ";
		else if (name === "br" || name === "cr") text += "\n";
	}
	if (!text) return "";
	const properties = children(run).find((node) => local(node) === "rPr");
	if (!properties) return text;
	const on = (name: string) => {
		const flag = children(properties).find((node) => local(node) === name);
		if (!flag) return false;
		const value = attribute(flag, "val");
		return value !== "0" && value !== "false";
	};
	let wrapped = text;
	if (on("b")) wrapped = `**${wrapped}**`;
	if (on("i")) wrapped = `*${wrapped}*`;
	if (on("strike")) wrapped = `~~${wrapped}~~`;
	return wrapped;
};

/** Everything a paragraph says, hyperlinks included (their text, not their address). */
const paragraphInline = (paragraph: Element): string => {
	let text = "";
	for (const node of children(paragraph)) {
		const name = local(node);
		if (name === "r") text += runMarkdown(node);
		else if (name === "hyperlink" || name === "smartTag" || name === "ins") {
			for (const child of children(node)) if (local(child) === "r") text += runMarkdown(child);
		} else if (name === "del") continue;
	}
	return text;
};

const headingLevel = (paragraph: Element) => {
	const properties = children(paragraph).find((node) => local(node) === "pPr");
	const style = properties ? children(properties).find((node) => local(node) === "pStyle") : undefined;
	const name = attribute(style, "val").toLowerCase();
	if (name === "title") return 1;
	if (name === "subtitle") return 2;
	const match = /heading\s*(\d)/u.exec(name);
	if (match) return Math.min(Number(match[1]), 6);
	return 0;
};

const isListItem = (paragraph: Element) => {
	const properties = children(paragraph).find((node) => local(node) === "pPr");
	return Boolean(properties && children(properties).some((node) => local(node) === "numPr"));
};

const tableMarkdown = (table: Element): string => {
	const rows: string[][] = [];
	for (const row of children(table)) {
		if (local(row) !== "tr") continue;
		const cells: string[] = [];
		for (const cell of children(row)) {
			if (local(cell) !== "tc") continue;
			cells.push(
				children(cell)
					.filter((node) => local(node) === "p")
					.map((paragraph) => paragraphInline(paragraph))
					.join(" ")
					.replace(/\|/gu, "\\|")
					.trim(),
			);
		}
		if (cells.length) rows.push(cells);
	}
	if (rows.length === 0) return "";
	const width = Math.max(...rows.map((row) => row.length));
	const padded = rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => "")]);
	return [padded[0], padded[0].map(() => "---"), ...padded.slice(1)].map((row) => `| ${row.join(" | ")} |`).join("\n");
};

export type DocxOptions = { format?: "markdown" | "text" };

/** Reads `word/document.xml` and returns the document as Markdown (or plain text). */
export const docxToMarkdown = async (bytes: Uint8Array, options: DocxOptions = {}): Promise<string> => {
	const xml = await readZipFile(bytes, "word/document.xml");
	if (!xml) throw new Error("That file has no word/document.xml, so it is not a Word document.");
	const parsed = new DOMParser().parseFromString(xml, "text/xml");
	if (parsed.querySelector("parsererror")) throw new Error("This Word file could not be read — its document.xml is damaged.");
	const body = Array.from(parsed.getElementsByTagName("*")).find((element) => element.localName === "body");
	if (!body) throw new Error("This Word file has no body to read.");
	const blocks: string[] = [];
	for (const node of children(body)) {
		const name = local(node);
		if (name === "p") {
			const text = paragraphInline(node).trim();
			const heading = headingLevel(node);
			if (!text) continue;
			if (heading) blocks.push(`${"#".repeat(heading)} ${text}`);
			else if (isListItem(node)) blocks.push(`- ${text}`);
			else blocks.push(text);
		} else if (name === "tbl") {
			const table = tableMarkdown(node);
			if (table) blocks.push(table);
		}
	}
	const markdown = blocks.join("\n\n").trim();
	if (options.format === "text") {
		return markdown
			.replace(/^#{1,6} /gmu, "")
			.replace(/^[-*] /gmu, "")
			.replace(/^\| ?/gmu, "")
			.replace(/ ?\|$/gmu, "")
			.replace(/^---.*$/gmu, "")
			.replace(/\*\*(.+?)\*\*/gu, "$1")
			.replace(/\*(.+?)\*/gu, "$1")
			.replace(/~~(.+?)~~/gu, "$1")
			.replace(/\n{3,}/gu, "\n\n")
			.trim();
	}
	return markdown;
};

export const docxToText = (bytes: Uint8Array) => docxToMarkdown(bytes, { format: "text" });
