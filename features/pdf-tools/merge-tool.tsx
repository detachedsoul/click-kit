"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { mergePdfs, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfBaseName, validatePdfFiles } from "@/features/pdf-tools/pdf-utils";

type Entry = { id: string; file: File; pages: number | null; problem: string };
type Result = { blob: Blob; name: string; pages: number };

let nextId = 0;

export const PdfMergeTool = () => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const resultUrl = useObjectUrl(result?.blob ?? null);
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
			setResult({
				blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
				name: `${pdfBaseName(entries[0]?.file.name ?? "document")}-merged.pdf`,
				pages,
			});
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
						<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					</div>
					<p className="m-0 text-xs text-muted">
						{pageWord(result.pages)} · {describeBytes(result.blob.size)} · from {entries.length} files
					</p>
				</section>
			) : null}
			<p className={hintClassName}>
				Merging moves each page across as it stands, so the original text stays real text — fonts, links, and vector art are kept rather than
				re-rendered as an image. Password-protected files need their password removed first.
			</p>
		</ToolPanel>
	);
};
