"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { createZip } from "@/features/image-tools/zip-utils";
import { extractPages, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, formatPageList, pageWord, parseRangeGroups, pdfBaseName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Mode = "ranges" | "burst" | "chunks";

type Part = { name: string; pages: number[] };

type Result = { blob: Blob; name: string; note: string };

const encoderLabel = (count: number) => (count === 1 ? "1 file" : `${count} files`);

/** Turn the mode plus its input into the list of parts to write out. */
export const planParts = (mode: Mode, input: string, pageCount: number): Part[] | string => {
	try {
		if (mode === "burst") {
			return Array.from({ length: pageCount }, (_, index) => ({ name: "", pages: [index + 1] }));
		}
		if (mode === "chunks") {
			const size = Number.parseInt(input.trim() || "1", 10);
			if (!Number.isFinite(size) || size < 1) return "Choose how many pages go in each file.";
			const parts: Part[] = [];
			for (let start = 1; start <= pageCount; start += size) {
				const pages: number[] = [];
				for (let page = start; page < Math.min(start + size, pageCount + 1); page += 1) pages.push(page);
				parts.push({ name: "", pages });
			}
			return parts;
		}
		return parseRangeGroups(input, pageCount).map((pages) => ({ name: "", pages }));
	} catch (caught) {
		return caught instanceof Error ? caught.message : "That page range could not be read.";
	}
};

export const PdfSplitTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [mode, setMode] = useState<Mode>("ranges");
	const [ranges, setRanges] = useState("1-");
	const [chunkSize, setChunkSize] = useState("2");
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const plan = pageCount === null ? null : planParts(mode, mode === "chunks" ? chunkSize : ranges, pageCount);

	const chooseFile = async (chosen: File | null) => {
		setResult(null);
		setError("");
		setPageCount(null);
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
			setRanges(`1-${info.pageCount}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const split = async () => {
		if (!file || pageCount === null) return;
		const parts = planParts(mode, mode === "chunks" ? chunkSize : ranges, pageCount);
		if (typeof parts === "string") {
			setError(parts);
			return;
		}
		setBusy(true);
		setError("");
		try {
			const bytes = await readFileBytes(file);
			const base = pdfBaseName(file.name);
			const written: { name: string; bytes: Uint8Array }[] = [];
			for (const [index, part] of parts.entries()) {
				const out = await extractPages(bytes, part.pages);
				const name = mode === "burst" ? `${base}-page-${part.pages[0]}.pdf` : `${base}-part-${index + 1}.pdf`;
				written.push({ name, bytes: out });
			}
			if (written.length === 1) {
				setResult({ blob: new Blob([written[0].bytes.slice().buffer], { type: "application/pdf" }), name: written[0].name, note: formatPageList(parts[0].pages) });
			} else {
				const zip = await createZip(written.map((entry) => ({ name: entry.name, data: entry.bytes })), { compress: true });
				setResult({
					blob: new Blob([zip.slice().buffer], { type: "application/zip" }),
					name: `${base}-split.zip`,
					note: `${parts.length} PDFs inside`,
				});
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be split.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Split and burst keep every page exactly as it was — text stays selectable and fonts stay embedded."
				id="pdf-split-file"
				label="PDF to split"
				onFile={chooseFile}
			/>
			{pageCount !== null ? (
				<>
					<StatGrid items={[{ label: "Pages", value: String(pageCount) }, { label: "File size", value: file ? describeBytes(file.size) : "—" }]} />
					<SegmentedControl
						label="How to split"
						onChange={(value) => {
							setMode(value);
							setResult(null);
							setError("");
						}}
						options={[
							{ id: "ranges", label: "Page ranges" },
							{ id: "chunks", label: "Every N pages" },
							{ id: "burst", label: "One file per page" },
						]}
						value={mode}
					/>
					{mode === "ranges" ? (
						<div>
							<label className={labelClassName} htmlFor="pdf-split-ranges">
								Ranges, one file each
							</label>
							<input
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="pdf-split-ranges"
								onChange={(event) => {
									setRanges(event.target.value);
									setResult(null);
								}}
								spellCheck={false}
								type="text"
								value={ranges}
							/>
							<p className={`${hintClassName} mt-2`}>Separate groups with a semicolon: 1-3; 4-6; 7-. Each group becomes its own PDF.</p>
						</div>
					) : null}
					{mode === "chunks" ? (
						<div>
							<label className={labelClassName} htmlFor="pdf-split-chunk">
								Pages per file
							</label>
							<input
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="pdf-split-chunk"
								max={pageCount}
								min={1}
								onChange={(event) => {
									setChunkSize(event.target.value);
									setResult(null);
								}}
								type="number"
								value={chunkSize}
							/>
							<p className={`${hintClassName} mt-2`}>The last file takes whatever pages are left.</p>
						</div>
					) : null}
					{typeof plan === "string" ? <ErrorNote message={plan} /> : null}
					{Array.isArray(plan) && plan.length > 0 ? (
						<div>
							<p className={labelClassName}>Will produce</p>
							<ul className="mt-2 mb-0 list-none space-y-1 p-0 text-xs text-muted">
								{plan.map((part, index) => (
									<li key={`${part.pages[0]}-${index}`}>
										{mode === "burst" ? `Page ${part.pages[0]}` : `Part ${index + 1}`} — {formatPageList(part.pages)} ({pageWord(part.pages.length)})
									</li>
								))}
							</ul>
							<p className={`${hintClassName} mt-2`}>{encoderLabel(plan.length)} to download.</p>
						</div>
					) : null}
					<button className={primaryButtonClassName} disabled={busy || typeof plan === "string" || !plan} onClick={split} type="button">
						{busy ? "Splitting…" : "Split PDF"}
					</button>
				</>
			) : null}
			{error ? <ErrorNote message={error} /> : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{result.note}</p>
				</div>
			) : null}
			{pageCount !== null && !result ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
