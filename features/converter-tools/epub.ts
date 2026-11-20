/**
 * EPUB books to Markdown.
 *
 * An EPUB is a zip with a manifest: `META-INF/container.xml` points at the OPF package,
 * and the package's spine gives the reading order. We follow that order, convert each
 * chapter's HTML with the same walker the HTML tool uses, and join the result.
 */

import { htmlToMarkdown } from "@/features/converter-tools/html-markdown";
import { readZipEntries, type ZipEntry } from "@/features/converter-tools/zip-reader";

export type EpubChapter = { name: string; markdown: string };

export type EpubBook = { title: string; author: string; chapters: EpubChapter[] };

const decoder = new TextDecoder("utf-8");

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);

/** Resolves an href the way a browser would, inside the archive. */
const resolve = (base: string, href: string) => {
	const clean = href.split("#")[0];
	if (!clean) return "";
	if (clean.startsWith("/")) return clean.slice(1);
	const parts = `${base}${clean}`.split("/");
	const out: string[] = [];
	for (const part of parts) {
		if (part === "." || part === "") continue;
		if (part === "..") out.pop();
		else out.push(part);
	}
	return out.join("/");
};

const parseXml = (text: string) => {
	const parsed = new DOMParser().parseFromString(text, "application/xml");
	if (parsed.querySelector("parsererror")) throw new Error("This book's package file is damaged.");
	return parsed;
};

const find = (element: Document | Element, name: string) => Array.from(element.getElementsByTagName("*")).filter((node) => node.localName === name);

const textOf = (element: Element | undefined) => element?.textContent?.trim() ?? "";

export const readEpub = async (bytes: Uint8Array): Promise<EpubBook> => {
	const entries = await readZipEntries(bytes);
	const byPath = new Map<string, ZipEntry>(entries.map((entry) => [entry.name.toLowerCase(), entry]));
	const get = (path: string) => byPath.get(path.toLowerCase());

	const container = get("META-INF/container.xml");
	if (!container) throw new Error("That file has no META-INF/container.xml, so it is not an EPUB book.");
	const containerDoc = parseXml(decoder.decode(container.bytes));
	const rootPath = find(containerDoc, "rootfile")[0]?.getAttribute("full-path");
	if (!rootPath) throw new Error("This book does not say where its package file is.");

	const opf = get(rootPath);
	if (!opf) throw new Error("This book's package file is missing from the archive.");
	const opfDoc = parseXml(decoder.decode(opf.bytes));
	const base = dirOf(rootPath);

	const title = textOf(find(opfDoc, "title")[0]) || rootPath.replace(/\.[^.]+$/u, "");
	const author = textOf(find(opfDoc, "creator")[0]);

	const manifest = new Map<string, string>();
	for (const item of find(opfDoc, "item")) {
		const id = item.getAttribute("id");
		const href = item.getAttribute("href");
		if (id && href) manifest.set(id, resolve(base, href));
	}
	const spine = find(opfDoc, "itemref")
		.map((item) => manifest.get(item.getAttribute("idref") ?? ""))
		.filter((path): path is string => Boolean(path));

	const chapters: EpubChapter[] = [];
	for (const path of spine) {
		const file = get(path);
		if (!file) continue;
		const markdown = htmlToMarkdown(decoder.decode(file.bytes));
		if (markdown) chapters.push({ name: path.split("/").pop() ?? path, markdown });
	}
	if (chapters.length === 0) throw new Error("This book has no readable chapters.");
	return { title, author, chapters };
};

/** The whole book as one Markdown document, chapters separated by a rule. */
export const epubToMarkdown = async (bytes: Uint8Array, options: { frontMatter?: boolean } = {}) => {
	const book = await readEpub(bytes);
	const body = book.chapters.map((chapter) => chapter.markdown).join("\n\n---\n\n");
	if (options.frontMatter === false) return body;
	const byline = book.author ? `\n\n*by ${book.author}*` : "";
	return `# ${book.title}${byline}\n\n${body}`;
};
