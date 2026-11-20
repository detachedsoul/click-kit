"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { countAnnotations, flattenPdf } from "@/features/pdf-tools/flatten";
import { readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

export const PdfFlattenTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [counts, setCounts] = useState<{ fields: number; markup: number } | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const fileName = result ? result.defaultName : "";
	const total = counts ? counts.fields + counts.markup : 0;

	const chooseFile = async (chosen: File | null) => {
		setFile(chosen);
		setCounts(null);
		setPageCount(null);
		setResult(null);
		setError("");
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const bytes = await readFileBytes(chosen);
			const [info, found] = await Promise.all([readPdfInfo(bytes), countAnnotations(bytes)]);
			setPageCount(info.pageCount);
			setCounts(found);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const flatten = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const { bytes, report } = await flattenPdf(await readFileBytes(file));
			const parts = [report.fields ? `${report.fields} form field${report.fields === 1 ? "" : "s"}` : "", report.baked ? `${report.baked} mark${report.baked === 1 ? "" : "s"}` : ""].filter(Boolean);
			const note = `${parts.join(" and ") || "nothing"} baked into the page${report.skipped ? ` · ${report.skipped} mark${report.skipped === 1 ? "" : "s"} had no appearance to bake, so ${report.skipped === 1 ? "it stayed an" : "they stayed"} annotation` : ""}`;
			setResult({ blob: new Blob([bytes.slice().buffer], { type: "application/pdf" }), defaultName: `${file.name.replace(/\.pdf$/iu, "")}-flat.pdf`, note });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be flattened.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Flattening turns comments, highlights, stamps, and filled-in fields into part of the page itself, so the marks show up everywhere and can no longer be moved or edited. The marks are already vector drawings, so they are copied in as vector — no page is redrawn or turned into an image."
				id="pdf-flatten-file"
				label="PDF with annotations to flatten"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{counts && pageCount !== null ? (
				<>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Form fields", value: String(counts.fields) },
							{ label: "Markup marks", value: String(counts.markup) },
							{ label: "Size now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<p className={hintClassName}>
						{total
							? `${total} thing${total === 1 ? "" : "s"} to bake into ${pageWord(pageCount)}. Links stay links, and a mark with no appearance stream is left alone rather than thrown away.`
							: "Nothing to flatten — this PDF has no form fields and no markup annotations. Filling in a form or adding notes first is what gives the tool something to bake."}
					</p>
					<button className={primaryButtonClassName} disabled={busy || total === 0} onClick={flatten} type="button">
						{busy ? "Flattening…" : "Flatten the PDF"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
						<p className="m-0 text-xs text-muted">{describeBytes(result.blob.size)}</p>
					</div>
					<p className="m-0 text-xs text-muted">{result.note}</p>
				</div>
			) : null}
			{counts ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
