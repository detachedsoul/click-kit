import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingList } from "@/features/productivity-tools/reading-list";
import {
	addBook,
	type Book,
	clampPages,
	pagesLeft,
	percentRead,
	READING_KEY,
	readingListAsMarkdown,
	removeBook,
	renameBook,
	reviveBooks,
	setProgress,
	setStatus,
	sortBooks,
	totals,
} from "@/features/productivity-tools/reading-utils";

const book = (over: Partial<Book> = {}): Book => ({ id: "book-1", title: "Piranesi", author: "Susanna Clarke", progress: 0, pages: 200, status: "next", added: "2026-11-01", ...over });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("reading list rules", () => {
	it("adds a book and tidies its fields", () => {
		const list = addBook([], { title: "  The   Dispossessed ", author: " Le Guin ", pages: "387" }, "2026-11-15");
		expect(list[0]).toMatchObject({ title: "The Dispossessed", author: "Le Guin", pages: 387, progress: 0, status: "next", added: "2026-11-15" });
		expect(addBook([], { title: "  ", author: "", pages: "" }, "2026-11-15")).toEqual([]);
		expect(removeBook(list, "book-1")).toEqual([]);
	});

	it("keeps page counts sane", () => {
		expect(clampPages(-4)).toBe(0);
		expect(clampPages(Number.NaN)).toBe(0);
		expect(clampPages(120.6)).toBe(121);
	});

	it("computes progress", () => {
		expect(percentRead(book({ progress: 50 }))).toBe(25);
		expect(percentRead(book({ status: "finished" }))).toBe(100);
		expect(percentRead(book({ pages: 0, progress: 12 }))).toBe(0);
		expect(pagesLeft(book({ progress: 50 }))).toBe(150);
	});

	it("fills the book in when it is marked finished", () => {
		expect(setStatus([book()], "book-1", "finished")[0]).toMatchObject({ status: "finished", progress: 200 });
	});

	it("starts reading when pages are logged", () => {
		const [reading] = setProgress([book()], "book-1", 40);
		expect(reading).toMatchObject({ progress: 40, status: "reading" });
		expect(setProgress([book({ status: "reading" })], "book-1", 200)[0].status).toBe("finished");
		expect(setProgress([book()], "book-1", 9999)[0].progress).toBe(200);
		expect(setProgress([book()], "book-1", -5)[0].progress).toBe(0);
	});

	it("renames without accepting a blank title", () => {
		expect(renameBook([book()], "book-1", "Jonathan Strange")[0].title).toBe("Jonathan Strange");
		expect(renameBook([book()], "book-1", "   ")[0].title).toBe("Piranesi");
	});

	it("sorts the shelf: reading, then next, then finished, then dropped", () => {
		const list = [book({ id: "book-1", status: "finished", added: "2026-11-01" }), book({ id: "book-2", status: "next", added: "2026-11-02" }), book({ id: "book-3", status: "reading", added: "2026-11-03" }), book({ id: "book-4", status: "dropped", added: "2026-11-04" })];
		expect(sortBooks(list).map((entry) => entry.id)).toEqual(["book-3", "book-2", "book-1", "book-4"]);
	});

	it("adds it all up", () => {
		const list = [book(), book({ id: "book-2", status: "finished" }), book({ id: "book-3", status: "reading", progress: 20 })];
		expect(totals(list)).toEqual({ all: 3, next: 1, reading: 1, finished: 1, dropped: 0, pagesRead: 220 });
	});

	it("writes the shelf out", () => {
		const markdown = readingListAsMarkdown([book({ status: "reading", progress: 50 }), book({ id: "book-2", title: "Solaris", status: "finished", pages: 0 })]);
		expect(markdown).toContain("# Reading list — 1 finished, 1 on the go, 0 waiting");
		expect(markdown).toContain("- Piranesi — Susanna Clarke, 200 pages (25%)");
		expect(markdown).toContain("- Solaris");
	});

	it("ignores storage it cannot trust", () => {
		expect(reviveBooks("nope")).toEqual([]);
		expect(reviveBooks([{ id: "book-1", title: "Kept", status: "nonsense", pages: "12", progress: -3 }, { title: "no id" }, null])).toEqual([{ id: "book-1", title: "Kept", author: "", progress: 0, pages: 12, status: "next", added: "" }]);
	});
});

describe("reading list tool", () => {
	const addABook = async (user: ReturnType<typeof userEvent.setup>, title = "Piranesi", pages = "200") => {
		await user.type(screen.getByLabelText("Title"), title);
		if (pages) await user.type(screen.getByLabelText("Pages (optional)"), pages);
		await user.click(screen.getByRole("button", { name: "Add to the list" }));
	};

	it("starts with an empty shelf", async () => {
		render(<ReadingList />);
		expect(await screen.findByText(/Nothing on the shelf yet/u)).toBeTruthy();
		expect(screen.getByText("Finished").parentElement?.textContent).toContain("0");
	});

	it("adds a book and counts it as waiting", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await addABook(user);
		expect(screen.getByText("Piranesi")).toBeTruthy();
		expect(screen.getByText("Waiting").parentElement?.textContent).toContain("1");
		expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
	});

	it("asks for a title", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await user.click(screen.getByRole("button", { name: "Add to the list" }));
		expect(screen.getByRole("alert").textContent).toContain("Give the book a title");
	});

	it("moves a book to reading and logs pages", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await addABook(user);
		await user.click(screen.getByRole("button", { name: "Reading" }));
		expect(screen.getByText(/0 of 200 pages · 0%/u)).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Page reached"), { target: { value: "50" } });
		expect(screen.getByText(/50 of 200 pages · 25%/u)).toBeTruthy();
		expect(screen.getByText("On the go").parentElement?.textContent).toContain("1");
	});

	it("marks a book finished by reaching the last page", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await addABook(user);
		await user.click(screen.getByRole("button", { name: "Reading" }));
		fireEvent.change(screen.getByLabelText("Page reached"), { target: { value: "200" } });
		expect(screen.getByText("Pages read").parentElement?.textContent).toContain("200");
		expect(screen.getByText(/^Finished · 200 pages$/u)).toBeTruthy();
	});

	it("renames and removes", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await addABook(user, "Piranesi");
		await user.click(screen.getByRole("button", { name: "Rename Piranesi" }));
		const field = screen.getByLabelText("New title for Piranesi");
		fireEvent.change(field, { target: { value: "Piranesi (reread)" } });
		fireEvent.keyDown(field, { key: "Enter" });
		expect(screen.getByText("Piranesi (reread)")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Remove Piranesi (reread)" }));
		expect(await screen.findByText(/Nothing on the shelf yet/u)).toBeTruthy();
	});

	it("remembers the shelf between visits", async () => {
		const user = userEvent.setup();
		const first = render(<ReadingList />);
		await addABook(user, "Solaris");
		await waitFor(() => expect(window.localStorage.getItem(READING_KEY)).toContain("Solaris"));
		first.unmount();
		render(<ReadingList />);
		expect(await screen.findByText("Solaris")).toBeTruthy();
	});

	it("clears the shelf", async () => {
		const user = userEvent.setup();
		render(<ReadingList />);
		await addABook(user);
		await user.click(screen.getByRole("button", { name: "Clear the shelf" }));
		expect(await screen.findByText(/Nothing on the shelf yet/u)).toBeTruthy();
	});
});
