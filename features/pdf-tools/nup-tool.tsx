"use client";

import { useState } from "react";
import { buttonClassName, choiceButtonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { NUP_GRIDS, PAPER_SIZES, type PaperSize, nupLayout, nupPages, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const COUNTS = [1, 2, 4, 6, 9];
const PAPERS = Object.entries(PAPER_SIZES) as [PaperSize, { width: number; height: number; label: string }][];

export const PdfNupTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [perSheet, setPerSheet] = useState(4);
	const [paper, setPaper] = useState<PaperSize>("a4");
	const [border, setBorder] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const sheets = pageCount === null ? 0 : Math.ceil(pageCount / perSheet);
	const layout = nupLayout(perSheet, paper);

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

	const lay = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await nupPages(await readFileBytes(file), { perSheet, paper, border });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, `${perSheet}-up`),
				note: `${pageWord(pageCount ?? 0)} on ${sheets} sheet${sheets === 1 ? "" : "s"}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be laid out.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Each page is scaled down as it stands — the content is moved, not redrawn — so small text stays sharp and fonts stay embedded."
				id="pdf-nup-file"
				label="PDF to lay out"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<span className={labelClassName}>Pages per sheet</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{COUNTS.map((count) => (
								<button
									aria-pressed={perSheet === count}
									className={choiceButtonClassName(perSheet === count)}
									key={count}
									onClick={() => {
										setPerSheet(count);
										setResult(null);
									}}
									type="button"
								>
									{count === 1 ? "1" : `${count} up`}
								</button>
							))}
						</div>
					</div>
					<div>
						<label className={labelClassName} htmlFor="pdf-nup-paper">
							Paper
						</label>
						<select
							className={`${selectClassName} mt-2`}
							id="pdf-nup-paper"
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
						<p className={`${hintClassName} mt-2`}>
							Two-up turns the paper sideways, so two pages sit side by side at full height. {NUP_GRIDS[perSheet].columns} × {NUP_GRIDS[perSheet].rows} grid on this setting.
						</p>
					</div>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]">
						<input checked={border} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setBorder(event.target.checked)} type="checkbox" />
						Draw a thin line round each page
					</label>
					<StatGrid
						items={[
							{ label: "Pages in", value: String(pageCount) },
							{ label: "Sheets out", value: String(sheets) },
							{ label: "Sheet size", value: `${Math.round(layout.width)} × ${Math.round(layout.height)} pt` },
							{ label: "Now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy} onClick={lay} type="button">
						{busy ? "Laying out…" : `Put ${perSheet} on a sheet`}
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
