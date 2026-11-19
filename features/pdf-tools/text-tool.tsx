"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { extractPdfText } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, parsePageRange, pdfBaseName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type PageText = { page: number; text: string };

const countWords = (text: string) => text.split(/\s+/u).filter(Boolean).length;

export const PdfTextTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [range, setRange] = useState("");
	const [perPage, setPerPage] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [pages, setPages] = useState<PageText[] | null>(null);
	const [copied, setCopied] = useState(false);
	const text = pages
		? pages
				.map((page) => (perPage ? `— page ${page.page} —\n${page.text}` : page.text))
				.join("\n\n")
				.trim()
		: "";
	const blob = pages ? new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" }) : null;
	const url = useObjectUrl(blob);
	const fileName = file ? `${pdfBaseName(file.name)}.txt` : "text.txt";

	const chooseFile = async (chosen: File | null) => {
		setError("");
		setPageCount(null);
		setPages(null);
		setRange("");
		setFile(chosen);
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const info = await readPdfInfo(await readFileBytes(chosen));
			setPageCount(info.pageCount);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const extract = async () => {
		if (!file) return;
		let wanted: number[] | undefined;
		if (range.trim()) {
			try {
				wanted = parsePageRange(range, pageCount ?? 1);
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "That page range could not be read.");
				return;
			}
		}
		setBusy(true);
		setError("");
		setCopied(false);
		try {
			const out = await extractPdfText(await readFileBytes(file), wanted);
			setPages(out);
			if (!out.some((page) => page.text.length > 0)) setError("This PDF has no text layer — it is probably a scan. Run it through a scanner's text recognition first.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The text could not be read out of this PDF.");
		} finally {
			setBusy(false);
		}
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Reads the words already stored in the file, keeping the order they appear in. Nothing is uploaded and nothing is re-typed."
				id="pdf-text-file"
				label="PDF to read"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<label className={labelClassName} htmlFor="pdf-text-range">
							Pages to read
						</label>
						<input
							className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							id="pdf-text-range"
							onChange={(event) => {
								setRange(event.target.value);
								setPages(null);
							}}
							placeholder={`All ${pageWord(pageCount)}`}
							spellCheck={false}
							type="text"
							value={range}
						/>
						<p className={`${hintClassName} mt-2`}>Leave empty for the whole document, or type 1-3, 7.</p>
					</div>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]">
						<input checked={perPage} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setPerPage(event.target.checked)} type="checkbox" />
						Mark where each page starts
					</label>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Words", value: pages ? String(countWords(text)) : "—" },
							{ label: "Characters", value: pages ? String(text.length) : "—" },
							{ label: "Size", value: blob ? describeBytes(blob.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy} onClick={extract} type="button">
						{busy ? "Reading…" : "Read the text"}
					</button>
					{pages ? (
						<>
							<div>
								<label className={labelClassName} htmlFor="pdf-text-output">
									Text found
								</label>
								<textarea
									className="mt-2 min-h-56 w-full border border-line bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									id="pdf-text-output"
									readOnly
									spellCheck={false}
									value={text}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button className={buttonClassName} onClick={copy} type="button">
									{copied ? "Copied" : "Copy all"}
								</button>
								{url ? <FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={url} /> : null}
								<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
									Choose another PDF
								</button>
							</div>
						</>
					) : null}
				</>
			) : null}
			{pageCount !== null && !pages ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
