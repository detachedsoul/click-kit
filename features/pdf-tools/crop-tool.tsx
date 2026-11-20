"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { cropPages, MM, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const SIDES = [
	{ key: "top", label: "Top" },
	{ key: "right", label: "Right" },
	{ key: "bottom", label: "Bottom" },
	{ key: "left", label: "Left" },
] as const;

type Side = (typeof SIDES)[number]["key"];

const PRESETS = [
	{ label: "Nothing", value: 0 },
	{ label: "5 mm", value: 5 },
	{ label: "1 cm", value: 10 },
	{ label: "2 cm", value: 20 },
];

const toPoints = (millimetres: string) => Math.max(0, Number.parseFloat(millimetres) || 0) * MM;

export const PdfCropTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [margins, setMargins] = useState<Record<Side, string>>({ top: "10", right: "10", bottom: "10", left: "10" });
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

	const crop = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const insets = {
				top: toPoints(margins.top),
				right: toPoints(margins.right),
				bottom: toPoints(margins.bottom),
				left: toPoints(margins.left),
			};
			if (insets.top + insets.right + insets.bottom + insets.left === 0) throw new Error("Set at least one margin to trim.");
			const out = await cropPages(await readFileBytes(file), insets);
			const trimmed = SIDES.filter((side) => Number.parseFloat(margins[side.key]) > 0).length;
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "trimmed"),
				note: `${trimmed} side${trimmed === 1 ? "" : "s"} trimmed on ${pageWord(pageCount ?? 0)}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be trimmed.");
		} finally {
			setBusy(false);
		}
	};

	const setPreset = (millimetres: number) => {
		setResult(null);
		setMargins({ top: String(millimetres), right: String(millimetres), bottom: String(millimetres), left: String(millimetres) });
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Trimming hides the outer strip of every page. The page content itself is left alone — text stays selectable and nothing is redrawn."
				id="pdf-crop-file"
				label="PDF to trim"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<span className={labelClassName}>Quick margins</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{PRESETS.map((preset) => (
								<button className={buttonClassName} key={preset.label} onClick={() => setPreset(preset.value)} type="button">
									{preset.label}
								</button>
							))}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						{SIDES.map((side) => (
							<div key={side.key}>
								<label className={labelClassName} htmlFor={`pdf-crop-${side.key}`}>
									{side.label} (mm)
								</label>
								<input
									className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									id={`pdf-crop-${side.key}`}
									inputMode="decimal"
									min={0}
									onChange={(event) => {
										setMargins((current) => ({ ...current, [side.key]: event.target.value }));
										setResult(null);
									}}
									step={1}
									type="number"
									value={margins[side.key]}
								/>
							</div>
						))}
					</div>
					<p className={hintClassName}>1 cm is about the width of a finger; 10 mm trims a typical printed border.</p>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Top", value: `${Number.parseFloat(margins.top) || 0} mm` },
							{ label: "Left", value: `${Number.parseFloat(margins.left) || 0} mm` },
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy} onClick={crop} type="button">
						{busy ? "Trimming…" : "Trim the margins"}
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
