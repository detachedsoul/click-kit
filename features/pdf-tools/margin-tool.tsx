"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { addMargins, type CropInsets, MM, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfFileName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const SIDES = [
	{ key: "top", label: "Top" },
	{ key: "right", label: "Right" },
	{ key: "bottom", label: "Bottom" },
	{ key: "left", label: "Left" },
] as const;

type Side = (typeof SIDES)[number]["key"];

const PRESETS = [
	{ label: "None", value: 0 },
	{ label: "5 mm", value: 5 },
	{ label: "10 mm", value: 10 },
	{ label: "20 mm", value: 20 },
];

const EMPTY: Record<Side, string> = { top: "0", right: "0", bottom: "0", left: "0" };

const toPoints = (millimetres: string) => Math.max(0, Number.parseFloat(millimetres) || 0) * MM;

export const PdfMarginTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [margins, setMargins] = useState<Record<Side, string>>({ ...EMPTY, left: "10" });
	const [customName, setCustomName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	const insets: CropInsets = { top: toPoints(margins.top), right: toPoints(margins.right), bottom: toPoints(margins.bottom), left: toPoints(margins.left) };
	const totalWidth = insets.left + insets.right;
	const totalHeight = insets.top + insets.bottom;

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

	const add = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await addMargins(await readFileBytes(file), insets);
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				defaultName: `${file.name.replace(/\.pdf$/iu, "")}-margins`,
				note: `${pageWord(pageCount ?? 0)} given ${Math.round(totalWidth / MM)} × ${Math.round(totalHeight / MM)} mm of margin`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Those margins could not be added.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="The page grows and its content moves inwards, so a tight print gains room for a binding edge. Nothing is scaled or redrawn, so text stays sharp and fonts stay embedded."
				id="pdf-margins-file"
				label="PDF to give margins"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<span className={labelClassName}>All sides</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{PRESETS.map((preset) => (
								<button
									className={`${primaryButtonClassName} ${Object.values(margins).every((value) => value === String(preset.value)) ? "" : "border-line bg-surface text-ink hover:border-[#5f6259]"}`}
									key={preset.label}
									onClick={() => {
										setMargins({ top: String(preset.value), right: String(preset.value), bottom: String(preset.value), left: String(preset.value) });
										setResult(null);
									}}
									type="button"
								>
									{preset.label}
								</button>
							))}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						{SIDES.map((side) => (
							<div key={side.key}>
								<label className={labelClassName} htmlFor={`pdf-margins-${side.key}`}>
									{side.label} (mm)
								</label>
								<input
									className={fieldClassName}
									id={`pdf-margins-${side.key}`}
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
					<p className={hintClassName}>
						A blank margin, not a scaled page: the document keeps its own size, so nothing gets smaller. Margins follow each page&apos;s own orientation, which matters for scans that were turned.
					</p>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Added across", value: `${Math.round(totalWidth)} pt` },
							{ label: "Added down", value: `${Math.round(totalHeight)} pt` },
							{ label: "Now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy || (totalWidth === 0 && totalHeight === 0)} onClick={add} type="button">
						{busy ? "Adding margins…" : "Add the margins"}
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
						<label className={labelClassName} htmlFor="pdf-margins-name">
							Name for the file
						</label>
						<input className={fieldClassName} id="pdf-margins-name" maxLength={100} onChange={(event) => setCustomName(event.target.value)} placeholder={result.defaultName} type="text" value={customName} />
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
