"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { PAPER_SIZES, type PaperSize, readFileBytes, readPdfInfo, resizePages } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const PAPERS = Object.entries(PAPER_SIZES) as [PaperSize, { width: number; height: number; label: string }][];

export const PdfResizeTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [paper, setPaper] = useState<PaperSize>("a4");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

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

	const resize = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await resizePages(await readFileBytes(file), paper);
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, PAPER_SIZES[paper].label.toLowerCase().replace(/\s+/gu, "-")),
				note: `${pageWord(pageCount ?? 0)} on ${PAPER_SIZES[paper].label}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be resized.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Each page is scaled to fit the paper you pick and centred with a small margin. Text stays text, so it is still selectable and sharp when printed."
				id="pdf-resize-file"
				label="PDF to resize"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<label className={labelClassName} htmlFor="pdf-resize-paper">
							Paper size
						</label>
						<select
							className={`${selectClassName} mt-2`}
							id="pdf-resize-paper"
							onChange={(event) => {
								setPaper(event.target.value as PaperSize);
								setResult(null);
							}}
							value={paper}
						>
							{PAPERS.map(([id, size]) => (
								<option key={id} value={id}>
									{size.label}
								</option>
							))}
						</select>
						<p className={`${hintClassName} mt-2`}>Wide pages keep their shape: the paper turns sideways for them.</p>
					</div>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Paper", value: PAPER_SIZES[paper].label },
							{ label: "Points", value: `${Math.round(PAPER_SIZES[paper].width)} × ${Math.round(PAPER_SIZES[paper].height)}` },
							{ label: "Now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy} onClick={resize} type="button">
						{busy ? "Resizing…" : `Fit every page to ${PAPER_SIZES[paper].label}`}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{result.note}</p>
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
