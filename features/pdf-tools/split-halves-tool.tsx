"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";
import { firstPageSize, type HalfDirection, type HalfOrder, splitHalves } from "@/features/pdf-tools/split-halves";

const CUTS: { id: HalfDirection; label: string }[] = [
	{ id: "horizontal", label: "Across the middle (top and bottom)" },
	{ id: "vertical", label: "Down the middle (left and right)" },
];

const ORDERS: { id: HalfOrder; label: string }[] = [
	{ id: "interleaved", label: "Each page's two halves side by side" },
	{ id: "grouped", label: "All first halves, then all second halves" },
];

export const PdfSplitHalvesTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [size, setSize] = useState<{ width: number; height: number } | null>(null);
	const [direction, setDirection] = useState<HalfDirection>("horizontal");
	const [order, setOrder] = useState<HalfOrder>("interleaved");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const chooseFile = async (chosen: File | null) => {
		setFile(chosen);
		setPageCount(null);
		setSize(null);
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
			const [info, box] = await Promise.all([readPdfInfo(bytes), firstPageSize(bytes)]);
			setPageCount(info.pageCount);
			setSize(box);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const run = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await splitHalves(await readFileBytes(file), { direction, order });
			const note = `${pageWord(out.pages)}, each ${Math.round(out.width)} × ${Math.round(out.height)} pt${out.trimmed ? ` · ${out.trimmed} mark${out.trimmed === 1 ? "" : "s"} stayed on the half that was left out` : ""}`;
			setResult({ blob: new Blob([out.bytes.slice().buffer], { type: "application/pdf" }), name: pdfOutputName(file.name, "halves"), note });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be split.");
		} finally {
			setBusy(false);
		}
	};

	const half = size ? (direction === "horizontal" ? { height: size.height / 2, width: size.width } : { height: size.height, width: size.width / 2 }) : null;

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Every page is cut in two, which is what you want for a scanned spread, a poster printed on A4, or a sheet that will be folded. The pages are copied with a narrower crop box, never redrawn, so text stays selectable and the artwork keeps its own fonts."
				id="pdf-split-halves-file"
				label="PDF to split in half"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null && size ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClassName} htmlFor="pdf-split-halves-direction">
								Cut each page
							</label>
							<select
								className={`${selectClassName} mt-1`}
								id="pdf-split-halves-direction"
								onChange={(event) => {
									setDirection(event.target.value as HalfDirection);
									setResult(null);
								}}
								value={direction}
							>
								{CUTS.map((cut) => (
									<option key={cut.id} value={cut.id}>
										{cut.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClassName} htmlFor="pdf-split-halves-order">
								Page order
							</label>
							<select
								className={`${selectClassName} mt-1`}
								id="pdf-split-halves-order"
								onChange={(event) => {
									setOrder(event.target.value as HalfOrder);
									setResult(null);
								}}
								value={order}
							>
								{ORDERS.map((entry) => (
									<option key={entry.id} value={entry.id}>
										{entry.label}
									</option>
								))}
							</select>
						</div>
					</div>
					<StatGrid
						items={[
							{ label: "Pages in", value: String(pageCount) },
							{ label: "Pages out", value: String(pageCount * 2) },
							{ label: "Each half", value: half ? `${Math.round(half.width)} × ${Math.round(half.height)} pt` : "—" },
							{ label: "Size now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<p className={hintClassName}>
						The full page size is {Math.round(size.width)} × {Math.round(size.height)} pt. {order === "grouped" ? "The first run holds one half of every page, so it can go through the printer on its own." : "Each page hands over both of its halves before the next page starts."}
					</p>
					<button className={primaryButtonClassName} disabled={busy} onClick={run} type="button">
						{busy ? "Splitting…" : "Split into halves"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
						<p className="m-0 text-xs text-muted">{describeBytes(result.blob.size)}</p>
					</div>
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
