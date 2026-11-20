"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { buttonClassName, choiceButtonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { todayIso } from "@/features/productivity-tools/local-day";
import { clearStore, useStoredState } from "@/features/productivity-tools/stored-state";
import {
	addBook,
	type Book,
	MAX_BOOKS,
	pagesLeft,
	percentRead,
	READING_KEY,
	readingListAsMarkdown,
	type ReadingStatus,
	removeBook,
	renameBook,
	reviveBooks,
	setProgress,
	setStatus,
	sortBooks,
	STATUSES,
	totals,
} from "@/features/productivity-tools/reading-utils";

export const ReadingList = () => {
	const [books, setBooks, ready] = useStoredState<Book[]>(READING_KEY, [], reviveBooks);
	const [title, setTitle] = useState("");
	const [author, setAuthor] = useState("");
	const [pages, setPages] = useState("");
	const [error, setError] = useState("");
	const [editing, setEditing] = useState<string | null>(null);
	const [editDraft, setEditDraft] = useState("");

	const today = todayIso();
	const all = totals(books);
	const sorted = sortBooks(books);

	const add = () => {
		const next = addBook(books, { title, author, pages }, today);
		if (next === books) {
			setError(!title.trim() ? "Give the book a title." : `That is ${MAX_BOOKS} books, which is plenty.`);
			return;
		}
		setBooks(next);
		setTitle("");
		setAuthor("");
		setPages("");
		setError("");
	};

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="sm:col-span-2">
					<label className={labelClassName} htmlFor="reading-title">
						Title
					</label>
					<input className={fieldClassName} id="reading-title" onChange={(event) => setTitle(event.target.value)} placeholder="What are you reading next?" type="text" value={title} />
				</div>
				<div>
					<label className={labelClassName} htmlFor="reading-pages">
						Pages (optional)
					</label>
					<input className={fieldClassName} id="reading-pages" inputMode="numeric" min={0} onChange={(event) => setPages(event.target.value)} type="number" value={pages} />
				</div>
			</div>
			<div>
				<label className={labelClassName} htmlFor="reading-author">
					Author (optional)
				</label>
				<input className={fieldClassName} id="reading-author" onChange={(event) => setAuthor(event.target.value)} type="text" value={author} />
			</div>
			{error ? <ErrorNote message={error} /> : null}
			<button className={primaryButtonClassName} onClick={add} type="button">
				Add to the list
			</button>
			<StatGrid
				items={[
					{ label: "On the go", value: String(all.reading) },
					{ label: "Waiting", value: String(all.next) },
					{ label: "Finished", value: String(all.finished) },
					{ label: "Pages read", value: all.pagesRead.toLocaleString("en-GB") },
				]}
			/>
			{!ready ? (
				<p className={hintClassName}>Reading this browser&apos;s list…</p>
			) : sorted.length === 0 ? (
				<p className={hintClassName}>Nothing on the shelf yet. The list is kept on this device only — no account, no sync, no server.</p>
			) : (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{sorted.map((book) => (
						<li className={`flex flex-col gap-2 border border-line px-3 py-2 ${book.status === "dropped" ? "opacity-60" : ""}`} key={book.id}>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0">
									{editing === book.id ? (
										<input
											aria-label={`New title for ${book.title}`}
											className={`${fieldClassName} mt-0 h-9`}
											onBlur={() => setEditing(null)}
											onChange={(event) => setEditDraft(event.target.value)}
											onKeyDown={(event) => {
												if (event.key !== "Enter") return;
												setBooks(renameBook(books, book.id, editDraft));
												setEditing(null);
											}}
											value={editDraft}
										/>
									) : (
										<p className="m-0 text-sm font-medium text-ink">
											{book.title}
											{book.author ? <span className="font-normal text-muted"> — {book.author}</span> : null}
										</p>
									)}
									<p className="m-0 mt-1 text-xs text-muted">
										{book.status === "finished"
											? book.pages
												? `Finished · ${book.pages} pages`
												: "Finished"
											: book.pages
												? `${book.progress} of ${book.pages} pages · ${percentRead(book)}% · ${pagesLeft(book)} to go`
												: book.progress
													? `${book.progress} pages read`
													: "Not started"}
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									{STATUSES.map((status) => (
										<button aria-pressed={book.status === status.id} className={choiceButtonClassName(book.status === status.id)} key={status.id} onClick={() => setBooks(setStatus(books, book.id, status.id as ReadingStatus))} type="button">
											{status.label}
										</button>
									))}
									<button aria-label={`Rename ${book.title}`} className={buttonClassName} onClick={() => { setEditing(book.id); setEditDraft(book.title); }} type="button">
										Rename
									</button>
									<button aria-label={`Remove ${book.title}`} className={buttonClassName} onClick={() => setBooks(removeBook(books, book.id))} type="button">
										<Trash2 aria-hidden="true" size={13} /> Remove
									</button>
								</div>
							</div>
							{book.status === "reading" || book.status === "finished" ? (
								<div className="flex flex-wrap items-end gap-3">
									<div className="w-32">
										<label className={labelClassName} htmlFor={`reading-progress-${book.id}`}>
											Page reached
										</label>
										<input
											className={`${fieldClassName} mt-1 h-9`}
											id={`reading-progress-${book.id}`}
											inputMode="numeric"
											min={0}
											onChange={(event) => setBooks(setProgress(books, book.id, Number.parseFloat(event.target.value)))}
											type="number"
											value={book.progress}
										/>
									</div>
									<p className="m-0 flex items-center gap-1 pb-2 text-xs text-muted">
										<Check aria-hidden="true" size={12} /> {percentRead(book)}% done
									</p>
								</div>
							) : null}
						</li>
					))}
				</ul>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<CopyTextButton text={readingListAsMarkdown(books)} />
				<button
					className={buttonClassName}
					onClick={() => {
						setBooks([]);
						clearStore(READING_KEY);
						setEditing(null);
					}}
					type="button"
				>
					Clear the shelf
				</button>
			</div>
			<p className={hintClassName}>Marking a book finished fills in the pages; setting a page number that reaches the end does the same thing. Nothing leaves this tab.</p>
		</ToolPanel>
	);
};
