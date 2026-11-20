"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { imagesToPdf, optimisePdf, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { renderPageImages } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Mode = "safe" | "scan";

const DPI_CHOICES = [
	{ value: "96", label: "Small — 96 dpi" },
	{ value: "144", label: "Balanced — 144 dpi" },
	{ value: "200", label: "Sharp — 200 dpi" },
];

const savedPercent = (before: number, after: number) => Math.round(((before - after) / before) * 100);

export const PdfCompressTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [mode, setMode] = useState<Mode>("safe");
	const [dpi, setDpi] = useState("144");
	const [quality, setQuality] = useState("0.7");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
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

	const compress = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const bytes = await readFileBytes(file);
			if (mode === "safe") {
				const out = await optimisePdf(bytes);
				setResult({
					blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
					name: pdfOutputName(file.name, "smaller"),
					note: `${describeBytes(file.size)} → ${describeBytes(out.byteLength)}`,
				});
				return;
			}
			const total = pageCount ?? 0;
			setProgress({ done: 0, total });
			const pages = Array.from({ length: total }, (_, index) => index + 1);
			const drawn = await renderPageImages(bytes, pages, {
				scale: Number(dpi) / 72,
				type: "image/jpeg",
				quality: Number(quality),
			});
			setProgress({ done: drawn.length, total });
			const pictures = await Promise.all(
				drawn.map(async ({ blob }) => ({ bytes: new Uint8Array(await blob.arrayBuffer()), type: "image/jpeg" as const })),
			);
			const out = await imagesToPdf(pictures, "fit", 0, { dpi: Number(dpi) });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "scanned"),
				note: `${describeBytes(file.size)} → ${describeBytes(out.byteLength)}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be made smaller.");
		} finally {
			setBusy(false);
		}
	};

	const shrunk = result && file ? savedPercent(file.size, result.blob.size) : 0;

	return (
		<ToolPanel>
			<FileField accept={ACCEPTED_PDF_TYPES} hint="Nothing is uploaded. The smaller file is built on your device." id="pdf-compress-file" label="PDF to make smaller" onFile={chooseFile} />
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<SegmentedControl
						label="How much to change"
						onChange={(value) => {
							setMode(value);
							setResult(null);
						}}
						options={[
							{ id: "safe", label: "Keep text sharp" },
							{ id: "scan", label: "Shrink scanned pages" },
						]}
						value={mode}
					/>
					{mode === "safe" ? (
						<p className={hintClassName}>
							Every page is copied as it is — text stays selectable, fonts stay embedded, links still work. Files built by older software shrink the most this way; a modern file may barely move.
						</p>
					) : (
						<>
							<p className={hintClassName}>Each page is redrawn as a picture. Scans and slide decks get much smaller; text stops being selectable and the file no longer carries its fonts.</p>
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<label className={labelClassName} htmlFor="pdf-compress-dpi">
										Resolution
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-compress-dpi" onChange={(event) => setDpi(event.target.value)} value={dpi}>
										{DPI_CHOICES.map((choice) => (
											<option key={choice.value} value={choice.value}>
												{choice.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-compress-quality">
										Picture quality
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-compress-quality" onChange={(event) => setQuality(event.target.value)} value={quality}>
										<option value="0.85">High</option>
										<option value="0.7">Balanced</option>
										<option value="0.5">Smallest</option>
									</select>
								</div>
							</div>
						</>
					)}
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Now", value: file ? describeBytes(file.size) : "—" },
							{ label: "Smaller", value: result ? describeBytes(result.blob.size) : "—" },
							{ label: "Saved", value: result ? `${shrunk}%` : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy} onClick={compress} type="button">
						{busy ? (mode === "scan" ? `Redrawing ${progress.done} of ${progress.total}…` : "Shrinking…") : "Make it smaller"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">
						{result.note}
						{shrunk <= 0 ? " — this file was already tight, so the copy is not smaller. Keep the original." : ` — ${pageWord(pageCount ?? 0)} kept.`}
					</p>
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
