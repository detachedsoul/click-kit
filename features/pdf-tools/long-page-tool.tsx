"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { longPage, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const MAX_HEIGHT = 14_400;

export const PdfLongPageTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [gap, setGap] = useState("12");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const fileName = result ? result.defaultName : "";

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

	const stack = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await longPage(await readFileBytes(file), { gap: Math.max(0, Number.parseFloat(gap) || 0) });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				defaultName: `${file.name.replace(/\.pdf$/iu, "")}-long-page.pdf`,
				note: `${pageWord(pageCount ?? 0)} stacked into one page`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This document could not be stacked.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Every page is stacked top to bottom into one very tall page, which is how a receipt, a webtoon, or a long thread reads best on a phone. Nothing is rasterised: the pages are embedded as they are."
				id="pdf-long-page-file"
				label="PDF to stack into one page"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<label className={labelClassName} htmlFor="pdf-long-page-gap">
							Gap between pages (pt)
						</label>
						<input
							className={fieldClassName}
							id="pdf-long-page-gap"
							inputMode="numeric"
							min={0}
							onChange={(event) => {
								setGap(event.target.value);
								setResult(null);
							}}
							type="number"
							value={gap}
						/>
					</div>
					<StatGrid
						items={[
							{ label: "Pages in", value: String(pageCount) },
							{ label: "Pages out", value: "1" },
							{ label: "Longest a page may be", value: `${MAX_HEIGHT} pt` },
							{ label: "Size now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<p className={hintClassName}>
						{pageCount < 2
							? "A single-page PDF has nothing to stack. Choose a document with at least two pages."
							: `The result is one page ${pageCount} pages long. Readers scroll; printers will shrink it, so print from the original instead.`}
					</p>
					<button className={primaryButtonClassName} disabled={busy || pageCount < 2} onClick={stack} type="button">
						{busy ? "Stacking…" : "Make one long page"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
						<p className="m-0 text-xs text-muted">{result.note}</p>
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
