"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { mergePdfs, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { renderPageThumbnail } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfBaseName, pdfFileName, validatePdfFiles } from "@/features/pdf-tools/pdf-utils";

type Entry = { id: string; file: File; pages: number | null; problem: string };
type Result = { blob: Blob; defaultName: string; pages: number; previews: { page: number; thumb: string }[] };

/** Enough of the merged document to see that the order came out right. */
export const PREVIEW_PAGES = 8;

let nextId = 0;

export const PdfMergeTool = () => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [customName, setCustomName] = useState("");
	const alive = useRef(true);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	/** Typing in the name box renames the download straight away; an empty box keeps the default. */
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	useEffect(
		() => () => {
			alive.current = false;
		},
		[],
	);
	const totalPages = entries.reduce((sum, entry) => sum + (entry.pages ?? 0), 0);
	const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);

	const chooseFiles = async (files: File[]) => {
		setResult(null);
		const problem = validatePdfFiles(files);
		if (problem) {
			setError(problem);
			return;
		}
		setError("");
		const pending: Entry[] = files.map((file) => ({ id: `pdf-${nextId++}`, file, pages: null, problem: "" }));
		setEntries(pending);
		const measured = await Promise.all(
			pending.map(async (entry) => {
				try {
					const info = await readPdfInfo(await readFileBytes(entry.file));
					return { ...entry, pages: info.pageCount };
				} catch (caught) {
					return { ...entry, problem: caught instanceof Error ? caught.message : "This PDF could not be read." };
				}
			}),
		);
		setEntries(measured);
	};

	const move = (index: number, direction: -1 | 1) => {
		setResult(null);
		setEntries((current) => {
			const target = index + direction;
			if (target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	};

	const remove = (id: string) => {
		setResult(null);
		setEntries((current) => current.filter((entry) => entry.id !== id));
	};

	const merge = async () => {
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const broken = entries.find((entry) => entry.problem);
			if (broken) throw new Error(`${broken.file.name}: ${broken.problem}`);
			const sources = await Promise.all(entries.map((entry) => readFileBytes(entry.file)));
			const bytes = await mergePdfs(sources);
			const pages = entries.reduce((sum, entry) => sum + (entry.pages ?? 0), 0);
			const merged = new Uint8Array(bytes);
			setResult({
				blob: new Blob([merged.slice().buffer], { type: "application/pdf" }),
				defaultName: `${pdfBaseName(entries[0]?.file.name ?? "document")}-merged`,
				pages,
				previews: [],
			});
			for (let page = 1; page <= Math.min(pages, PREVIEW_PAGES); page += 1) {
				try {
					const thumb = await renderPageThumbnail(merged, page, 120);
					if (!alive.current) return;
					setResult((current) => (current ? { ...current, previews: [...current.previews, { page, thumb }] } : current));
				} catch {
					// A page that will not draw still merges; the preview is a nicety.
					if (!alive.current) return;
				}
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Those PDFs could not be merged.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<MultiFileField
				accept={ACCEPTED_PDF_TYPES}
				disabled={busy}
				hint="Pick two or more PDFs. They are joined in the order below — page content, fonts, and artwork are copied across untouched."
				id="merge-files"
				label="PDFs to merge"
				onFiles={(files) => void chooseFiles(files)}
			/>
			{entries.length ? (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{entries.map((entry, index) => (
						<li className="flex flex-wrap items-center gap-2 border border-line bg-[#fbfaf7] p-2.5" key={entry.id}>
							<span className="font-mono text-[11px] text-muted">{index + 1}</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-medium text-ink">{entry.file.name}</span>
								<span className="block text-xs text-muted">
									{describeBytes(entry.file.size)}
									{entry.pages !== null ? ` · ${pageWord(entry.pages)}` : ""}
									{entry.problem ? ` · ${entry.problem}` : ""}
								</span>
							</span>
							<span className="flex items-center gap-1">
								<button
									aria-label={`Move ${entry.file.name} up`}
									className={`${buttonClassName} border-line bg-surface text-ink hover:border-[#5f6259] disabled:cursor-not-allowed disabled:opacity-40`}
									disabled={index === 0 || busy}
									onClick={() => move(index, -1)}
									type="button"
								>
									<ArrowUp aria-hidden="true" size={14} />
								</button>
								<button
									aria-label={`Move ${entry.file.name} down`}
									className={`${buttonClassName} border-line bg-surface text-ink hover:border-[#5f6259] disabled:cursor-not-allowed disabled:opacity-40`}
									disabled={index === entries.length - 1 || busy}
									onClick={() => move(index, 1)}
									type="button"
								>
									<ArrowDown aria-hidden="true" size={14} />
								</button>
								<button
									aria-label={`Remove ${entry.file.name}`}
									className={`${buttonClassName} border-line bg-surface text-[#5f6259] hover:border-[#8a8779] hover:text-ink`}
									disabled={busy}
									onClick={() => remove(entry.id)}
									type="button"
								>
									<X aria-hidden="true" size={14} />
								</button>
							</span>
						</li>
					))}
				</ul>
			) : null}
			{entries.some((entry) => entry.pages === null) ? <p className={hintClassName}>Counting pages…</p> : null}
			{entries.length ? (
				<StatGrid
					items={[
						{ label: "Files", value: String(entries.length) },
						{ label: "Pages in total", value: String(totalPages) },
						{ label: "Combined size", value: describeBytes(totalBytes) },
					]}
				/>
			) : null}
			<button className={`${primaryButtonClassName} self-start`} disabled={!entries.length || busy || entries.some((entry) => entry.pages === null)} onClick={() => void merge()} type="button">
				{busy ? "Merging…" : "Merge PDFs"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Merged PDF</h2>
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
					</div>
					<div>
						<label className={labelClassName} htmlFor="merge-file-name">
							Name for the file
						</label>
						<input
							className={fieldClassName}
							id="merge-file-name"
							maxLength={100}
							onChange={(event) => setCustomName(event.target.value)}
							placeholder={`${pdfBaseName(entries[0]?.file.name ?? "document")}-merged`}
							type="text"
							value={customName}
						/>
						<p className={`${hintClassName} mt-2`}>{customName.trim() ? `Saved as ${fileName}` : `Leave empty to save as ${fileName}. The .pdf suffix is added for you.`}</p>
					</div>
					<p className="m-0 text-xs text-muted">
						{pageWord(result.pages)} · {describeBytes(result.blob.size)} · from {entries.length} files
					</p>
					{result.previews.length ? (
						<div>
							<p className={`${hintClassName} mb-2`}>
								First {result.previews.length === 1 ? "page" : `${result.previews.length} pages`} of the merged file, in order:
							</p>
							<ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 p-0">
								{result.previews.map((preview) => (
									<li className="border border-line bg-[#fbfaf7] p-1" key={preview.page}>
										{/* eslint-disable-next-line @next/next/no-img-element -- a rendered preview, not a layout image */}
										<img alt={`Merged page ${preview.page}`} className="mx-auto block max-h-28 w-auto" src={preview.thumb} />
										<p className="m-0 mt-1 text-center text-[11px] text-muted">{preview.page}</p>
									</li>
								))}
							</ul>
						</div>
					) : null}
				</section>
			) : null}
			<p className={hintClassName}>
				Merging moves each page across as it stands, so the original text stays real text — fonts, links, and vector art are kept rather than
				re-rendered as an image. Password-protected files need their password removed first.
			</p>
		</ToolPanel>
	);
};
