"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { epubToMarkdown, readEpub, type EpubBook } from "@/features/converter-tools/epub";

type Output = "book" | "chapter";

const MAX_BYTES = 50 * 1024 * 1024;

export const EpubTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [book, setBook] = useState<EpubBook | null>(null);
	const [output, setOutput] = useState<Output>("book");
	const [chapterIndex, setChapterIndex] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [text, setText] = useState<{ value: string; name: string } | null>(null);
	const blob = text ? new Blob([text.value], { type: "text/markdown;charset=utf-8" }) : null;
	const url = useObjectUrl(blob);

	const read = async (chosen: File) => {
		setBusy(true);
		setError("");
		setText(null);
		setBook(null);
		setFile(chosen);
		setChapterIndex(0);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the book under 50 MB.");
			const bytes = new Uint8Array(await chosen.arrayBuffer());
			const parsed = await readEpub(bytes);
			setBook(parsed);
			const base = chosen.name.replace(/\.epub$/iu, "") || "book";
			setText({ value: await epubToMarkdown(bytes), name: `${base}.md` });
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/not a zip|central directory/iu.test(message)) setError("That file could not be opened as an EPUB. Only .epub books work here.");
			else setError(message || "This book could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const switchOutput = (next: Output) => {
		setOutput(next);
	};

	const pickChapter = (index: number) => {
		if (!book) return;
		setChapterIndex(index);
		const chapter = book.chapters[index];
		setText({ value: `# ${book.title}\n\n${chapter.markdown}\n`, name: `${(file?.name ?? "book").replace(/\.epub$/iu, "")}-${index + 1}.md` });
	};

	const wholeBook = async () => {
		if (!file) return;
		const bytes = new Uint8Array(await file.arrayBuffer());
		setText({ value: await epubToMarkdown(bytes), name: `${file.name.replace(/\.epub$/iu, "")}.md` });
	};

	return (
		<ToolPanel>
			<FileField
				accept=".epub,application/epub+zip"
				hint="The book is unpacked in this tab. Chapters come out in reading order, with their own headings, paragraphs, and emphasis kept."
				id="epub-file"
				label="EPUB book"
				onFile={(chosen) => {
					if (chosen) void read(chosen);
					else {
						setFile(null);
						setBook(null);
						setText(null);
						setError("");
					}
				}}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName}>Unpacking the book…</p> : null}
			{book ? (
				<>
					<StatGrid
						items={[
							{ label: "Title", value: book.title },
							{ label: "Author", value: book.author || "Not stated" },
							{ label: "Chapters", value: String(book.chapters.length) },
							{ label: "File size", value: describeBytes(file?.size ?? 0) },
						]}
					/>
					<SegmentedControl<Output>
						label="What to save"
						onChange={switchOutput}
						options={[
							{ id: "book", label: "Whole book" },
							{ id: "chapter", label: "One chapter" },
						]}
						value={output}
					/>
					{output === "chapter" ? (
						<div>
							<label className={labelClassName} htmlFor="epub-chapter">
								Chapter
							</label>
							<select
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="epub-chapter"
								onChange={(event) => {
									const index = Number(event.target.value);
									if (index === -1) void wholeBook();
									else pickChapter(index);
								}}
								value={output === "chapter" ? chapterIndex : -1}
							>
								{book.chapters.map((chapter, index) => (
									<option key={chapter.name} value={index}>
										{index + 1}. {chapter.name}
									</option>
								))}
							</select>
							<p className={`${hintClassName} mt-2`}>Chapter files are named the way the book names them; the number here is their place in the reading order.</p>
						</div>
					) : null}
					{text ? (
						<>
							<label className={labelClassName} htmlFor="epub-output">
								Markdown
							</label>
							<textarea
								className="min-h-64 w-full border border-line bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="epub-output"
								readOnly
								spellCheck={false}
								value={text.value}
							/>
							<div className="flex flex-wrap items-center gap-2">
								<FileDownloadLink fileName={text.name} label={`Download ${text.name}`} url={url} />
								<button className={buttonClassName} onClick={() => void wholeBook()} type="button">
									Whole book again
								</button>
							</div>
						</>
					) : null}
					<button className={primaryButtonClassName} disabled={busy} onClick={() => file && void read(file)} type="button">
						{busy ? "Reading…" : "Read it again"}
					</button>
				</>
			) : null}
		</ToolPanel>
	);
};
