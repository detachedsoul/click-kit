/**
 * The reading list's rules, as plain functions over plain values.
 *
 * A reading list is mostly a queue with an opinion: what is next, what is part-read, and
 * what is done. Everything here works on plain arrays so it can be checked without a browser.
 */

export type ReadingStatus = "next" | "reading" | "finished" | "dropped";

export type Book = {
	id: string;
	title: string;
	author: string;
	/** Pages read so far. Kept as a number so progress can be computed, not guessed. */
	progress: number;
	pages: number;
	status: ReadingStatus;
	added: string;
};

export const READING_KEY = "clickkit.reading.v1";
export const MAX_BOOKS = 300;
export const MAX_TITLE = 120;
export const MAX_AUTHOR = 80;
export const MAX_PAGES = 20_000;

export const STATUSES: { id: ReadingStatus; label: string }[] = [
	{ id: "next", label: "Next" },
	{ id: "reading", label: "Reading" },
	{ id: "finished", label: "Finished" },
	{ id: "dropped", label: "Dropped" },
];

const trim = (text: string, limit: number) => text.replace(/\s+/gu, " ").trim().slice(0, limit);

export const cleanTitle = (title: string) => trim(title, MAX_TITLE);
export const cleanAuthor = (author: string) => trim(author, MAX_AUTHOR);

export const clampPages = (pages: number) => (Number.isFinite(pages) ? Math.min(Math.max(Math.round(pages), 0), MAX_PAGES) : 0);

export const nextBookId = (books: Book[]): string => {
	const used = new Set(books.map((book) => book.id));
	let seed = books.length + 1;
	while (used.has(`book-${seed}`)) seed += 1;
	return `book-${seed}`;
};

export const addBook = (books: Book[], draft: { title: string; author: string; pages: string }, today: string): Book[] => {
	const title = cleanTitle(draft.title);
	if (!title || books.length >= MAX_BOOKS) return books;
	const pages = clampPages(Number.parseFloat(draft.pages));
	return [...books, { id: nextBookId(books), title, author: cleanAuthor(draft.author), progress: 0, pages, status: "next", added: today }];
};

export const removeBook = (books: Book[], id: string) => books.filter((book) => book.id !== id);

export const setStatus = (books: Book[], id: string, status: ReadingStatus): Book[] =>
	books.map((book) => {
		if (book.id !== id) return book;
		// Finishing a book fills it in; un-finishing it keeps the pages read, so nothing is lost.
		if (status === "finished" && book.pages) return { ...book, status, progress: book.pages };
		return { ...book, status };
	});

/** Pages read, kept inside the book's own length and never behind zero. */
export const setProgress = (books: Book[], id: string, pages: number): Book[] =>
	books.map((book) => {
		if (book.id !== id) return book;
		const progress = Math.min(Math.max(Math.round(Number.isFinite(pages) ? pages : 0), 0), book.pages || MAX_PAGES);
		const status: ReadingStatus = book.pages && progress >= book.pages ? "finished" : progress > 0 && book.status === "next" ? "reading" : book.status;
		return { ...book, progress, status };
	});

export const renameBook = (books: Book[], id: string, title: string): Book[] => {
	const clean = cleanTitle(title);
	if (!clean) return books;
	return books.map((book) => (book.id === id ? { ...book, title: clean } : book));
};

/** 0–100, rounded. A book with no page count cannot be measured, so it reads as 0 or 100. */
export const percentRead = (book: Book): number => {
	if (book.status === "finished") return 100;
	if (!book.pages) return 0;
	return Math.min(100, Math.round((book.progress / book.pages) * 100));
};

export const pagesLeft = (book: Book): number => (book.pages ? Math.max(book.pages - book.progress, 0) : 0);

export const totals = (books: Book[]) => ({
	all: books.length,
	next: books.filter((book) => book.status === "next").length,
	reading: books.filter((book) => book.status === "reading").length,
	finished: books.filter((book) => book.status === "finished").length,
	dropped: books.filter((book) => book.status === "dropped").length,
	pagesRead: books.reduce((sum, book) => sum + (book.status === "finished" ? book.pages : book.progress), 0),
});

const ORDER: Record<ReadingStatus, number> = { reading: 0, next: 1, finished: 2, dropped: 3 };

/** What you are reading, then what is next, then what is done; oldest first inside a group. */
export const sortBooks = (books: Book[]): Book[] =>
	[...books].sort((left, right) => {
		const group = ORDER[left.status] - ORDER[right.status];
		if (group !== 0) return group;
		if (left.added !== right.added) return left.added.localeCompare(right.added);
		return left.title.localeCompare(right.title);
	});

export const readingListAsMarkdown = (books: Book[]): string => {
	const all = totals(books);
	const lines = [`# Reading list — ${all.finished} finished, ${all.reading} on the go, ${all.next} waiting`, ""];
	for (const status of ["reading", "next", "finished", "dropped"] as const) {
		const group = sortBooks(books).filter((book) => book.status === status);
		if (!group.length) continue;
		lines.push(`## ${STATUSES.find((entry) => entry.id === status)?.label}`, "");
		for (const book of group) {
			const author = book.author ? ` — ${book.author}` : "";
			const length = book.pages ? `, ${book.pages} pages` : "";
			const progress = status === "reading" ? ` (${percentRead(book)}%)` : "";
			lines.push(`- ${book.title}${author}${length}${progress}`);
		}
		lines.push("");
	}
	return lines.join("\n").trim();
};

/** Reads back whatever a previous visit left behind, ignoring anything malformed. */
export const reviveBooks = (raw: unknown): Book[] => {
	if (!Array.isArray(raw)) return [];
	const statuses = new Set(STATUSES.map((entry) => entry.id));
	return raw
		.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
		.map((entry) => ({
			id: String(entry.id ?? ""),
			title: cleanTitle(String(entry.title ?? "")),
			author: cleanAuthor(String(entry.author ?? "")),
			progress: clampPages(Number(entry.progress)),
			pages: clampPages(Number(entry.pages)),
			status: statuses.has(entry.status as ReadingStatus) ? (entry.status as ReadingStatus) : "next",
			added: typeof entry.added === "string" ? entry.added : "",
		}))
		.filter((entry) => entry.id && entry.title)
		.slice(0, MAX_BOOKS);
};
