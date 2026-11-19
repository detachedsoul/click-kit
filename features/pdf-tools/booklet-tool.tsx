"use client";

import { useState } from "react";
import { buttonClassName, checkboxInputClassName, choiceButtonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { bookletOrder, bookletPages, type PaperSize, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfFileName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const PAPERS: { id: PaperSize; label: string }[] = [
	{ id: "a4", label: "A4" },
	{ id: "letter", label: "Letter" },
	{ id: "a5", label: "A5" },
	{ id: "legal", label: "Legal" },
];

export const PdfBookletTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [paper, setPaper] = useState<PaperSize>("a4");
	const [margin, setMargin] = useState("18");
	const [fold, setFold] = useState(true);
	const [customName, setCustomName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	const sheets = pageCount === null ? 0 : bookletOrder(pageCount).length;
	const blanks = pageCount === null ? 0 : sheets * 4 - pageCount;

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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const make = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await bookletPages(await readFileBytes(file), { paper, margin: Math.max(0, Number.parseFloat(margin) || 0), fold });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				defaultName: `${file.name.replace(/\.pdf$/iu, "")}-booklet`,
				note: `${sheets * 2} sides on ${sheets} sheet${sheets === 1 ? "" : "s"}${blanks ? `, with ${blanks} blank page${blanks === 1 ? "" : "s"} added` : ""}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This booklet could not be built.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Two pages per landscape sheet in booklet order: print double-sided, fold the stack down the middle, and the pages read in sequence. Pages are embedded, never redrawn, so type stays sharp."
				id="pdf-booklet-file"
				label="PDF to fold into a booklet"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<span className={labelClassName}>Paper</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{PAPERS.map((option) => (
								<button aria-pressed={paper === option.id} className={choiceButtonClassName(paper === option.id)} key={option.id} onClick={() => setPaper(option.id)} type="button">
									{option.label}
								</button>
							))}
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClassName} htmlFor="pdf-booklet-margin">
								Margin (pt)
							</label>
							<input
								className={fieldClassName}
								id="pdf-booklet-margin"
								inputMode="numeric"
								min={0}
								onChange={(event) => {
									setMargin(event.target.value);
									setResult(null);
								}}
								type="number"
								value={margin}
							/>
						</div>
						<label className="mt-7 flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="pdf-booklet-fold">
							<input checked={fold} className={checkboxInputClassName} id="pdf-booklet-fold" onChange={(event) => setFold(event.target.checked)} type="checkbox" />
							Draw a faint fold line down the spine
						</label>
					</div>
					<StatGrid
						items={[
							{ label: "Pages in", value: String(pageCount) },
							{ label: "Sheets", value: String(sheets) },
							{ label: "Blanks added", value: String(blanks) },
							{ label: "Size now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<p className={hintClassName}>
						{blanks
							? `${pageWord(pageCount)} does not divide by four, so ${blanks} blank page${blanks === 1 ? "" : "s"} fill the last sheet. They come out as blank paper at the back of the folded booklet.`
							: "This page count divides neatly by four, so no pages are added."}
					</p>
					<button className={primaryButtonClassName} disabled={busy} onClick={make} type="button">
						{busy ? "Imposing the booklet…" : "Build the booklet"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
						<p className="m-0 text-xs text-muted">{result.note}</p>
					</div>
					<div>
						<label className={labelClassName} htmlFor="pdf-booklet-name">
							Name for the file
						</label>
						<input className={fieldClassName} id="pdf-booklet-name" maxLength={100} onChange={(event) => setCustomName(event.target.value)} placeholder={result.defaultName} type="text" value={customName} />
					</div>
				</div>
			) : null}
			{pageCount !== null ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
