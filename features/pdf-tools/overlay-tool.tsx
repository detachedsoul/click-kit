"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { overlayPdf, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, parsePageRange, pdfFileName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Scale = "fit" | "stretch";

export const PdfOverlayTool = () => {
	const [base, setBase] = useState<File | null>(null);
	const [layer, setLayer] = useState<File | null>(null);
	const [basePages, setBasePages] = useState<number | null>(null);
	const [layerPages, setLayerPages] = useState<number | null>(null);
	const [range, setRange] = useState("");
	const [scale, setScale] = useState<Scale>("fit");
	const [opacity, setOpacity] = useState("100");
	const [customName, setCustomName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	const choose = async (chosen: File | null, which: "base" | "layer") => {
		setResult(null);
		setError("");
		if (which === "base") {
			setBase(chosen);
			setBasePages(null);
		} else {
			setLayer(chosen);
			setLayerPages(null);
		}
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const info = await readPdfInfo(await readFileBytes(chosen));
			if (which === "base") setBasePages(info.pageCount);
			else setLayerPages(info.pageCount);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const apply = async () => {
		if (!base || !layer) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			let pages: number[] | null = null;
			if (range.trim()) {
				try {
					pages = parsePageRange(range, basePages ?? 1);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "That page range could not be read.");
					setBusy(false);
					return;
				}
			}
			const out = await overlayPdf(await readFileBytes(base), await readFileBytes(layer), {
				pages,
				scale,
				opacity: Math.min(Math.max((Number.parseFloat(opacity) || 100) / 100, 0.05), 1),
			});
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				defaultName: `${base.name.replace(/\.pdf$/iu, "")}-overlaid`,
				note: `${pageWord(pages ? pages.length : basePages ?? 0)} of ${pageWord(basePages ?? 0)} carry the overlay`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The overlay could not be applied.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<FileField accept={ACCEPTED_PDF_TYPES} hint="The document that stays." id="pdf-overlay-base" label="Base PDF (the words)" onFile={(chosen) => void choose(chosen, "base")} />
				<FileField accept={ACCEPTED_PDF_TYPES} hint="Only its first page is used — a letterhead, a stamp, a grid." id="pdf-overlay-layer" label="Overlay PDF (the sheet on top)" onFile={(chosen) => void choose(chosen, "layer")} />
			</div>
			{error ? <ErrorNote message={error} /> : null}
			{base && layer ? (
				<>
					{basePages !== null && layerPages !== null ? (
						<StatGrid
							items={[
								{ label: "Base pages", value: String(basePages) },
								{ label: "Layer pages", value: `${layerPages} (first used)` },
								{ label: "Base size", value: describeBytes(base.size) },
								{ label: "Layer size", value: describeBytes(layer.size) },
							]}
						/>
					) : null}
					<div>
						<label className={labelClassName} htmlFor="pdf-overlay-range">
							Pages to stamp (blank for every page)
						</label>
						<input className={fieldClassName} id="pdf-overlay-range" onChange={(event) => setRange(event.target.value)} placeholder="1-3, 8" type="text" value={range} />
					</div>
					<SegmentedControl<Scale>
						label="How the overlay is sized"
						onChange={(next) => {
							setScale(next);
							setResult(null);
						}}
						options={[
							{ id: "fit", label: "Fit inside the page" },
							{ id: "stretch", label: "Stretch to fill it" },
						]}
						value={scale}
					/>
					<div>
						<label className={labelClassName} htmlFor="pdf-overlay-opacity">
							Strength (%)
						</label>
						<input className={fieldClassName} id="pdf-overlay-opacity" inputMode="numeric" max={100} min={5} onChange={(event) => setOpacity(event.target.value)} type="number" value={opacity} />
					</div>
					<p className={hintClassName}>
						Both documents are embedded as they are, so the base keeps its fonts and the overlay keeps its own artwork. A letterhead made in Word will land at the top of the page, not under the print margin, so test on one page first.
					</p>
					<button className={primaryButtonClassName} disabled={busy} onClick={() => void apply()} type="button">
						{busy ? "Laying one over the other…" : "Apply the overlay"}
					</button>
				</>
			) : (
				<p className={hintClassName}>Choose both documents. Nothing is uploaded — both are read in this tab.</p>
			)}
			{result ? (
				<div className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
						<p className="m-0 text-xs text-muted">{result.note}</p>
					</div>
					<label className={labelClassName} htmlFor="pdf-overlay-name">
						Name for the file
					</label>
					<input className={fieldClassName} id="pdf-overlay-name" maxLength={100} onChange={(event) => setCustomName(event.target.value)} placeholder={result.defaultName} type="text" value={customName} />
				</div>
			) : null}
			{base || layer ? (
				<button
					className={buttonClassName}
					onClick={() => {
						setBase(null);
						setLayer(null);
						setBasePages(null);
						setLayerPages(null);
						setResult(null);
						setError("");
					}}
					type="button"
				>
					Start again
				</button>
			) : null}
		</ToolPanel>
	);
};
