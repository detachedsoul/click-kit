"use client";

import { useMemo, useState } from "react";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { ACCEPTED_IMAGE_TYPES, canvasToBlob, describeBytes, FileDownloadLink, ImagePreview, isSupportedImage, loadImage, MAX_IMAGE_BYTES, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { outputExtension } from "@/features/image-tools/crop-utils";
import { captionFor, clampCell, clampColumns, clampGap, coverRect, MAX_SHEET_CELLS, sheetFileName, sheetLayout, SHEET_BACKGROUNDS } from "@/features/image-tools/sheet-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const SheetTool = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [columns, setColumns] = useState(3);
	const [cell, setCell] = useState(240);
	const [gap, setGap] = useState(12);
	const [background, setBackground] = useState(SHEET_BACKGROUNDS[0].id);
	const [captions, setCaptions] = useState(true);
	const [format, setFormat] = useState("image/png");
	const [quality, setQuality] = useState(90);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const layout = useMemo(() => {
		if (!files.length) return null;
		try {
			return sheetLayout({ count: files.length, columns: clampColumns(columns, files.length), cell, gap, padding: 24, captionHeight: captions ? 22 : 0 });
		} catch {
			return null;
		}
	}, [captions, cell, columns, files.length, gap]);

	const chooseFiles = (next: File[]) => {
		setResult(null);
		setError("");
		const images = next.filter(isSupportedImage);
		if (images.length !== next.length) setError("Skipped files that are not PNG, JPEG, WebP, GIF, AVIF, or BMP images.");
		if (images.length > MAX_SHEET_CELLS) {
			setError(`A sheet fits ${MAX_SHEET_CELLS} images — the first ${MAX_SHEET_CELLS} were kept.`);
			setFiles(images.slice(0, MAX_SHEET_CELLS));
			return;
		}
		const tooBig = images.find((file) => file.size > MAX_IMAGE_BYTES);
		if (tooBig) {
			setError(`${tooBig.name} is larger than 25 MB, so nothing was added.`);
			setFiles([]);
			return;
		}
		setFiles(images);
	};

	const build = async () => {
		if (!files.length) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const plan = sheetLayout({
				count: files.length,
				columns: clampColumns(columns, files.length),
				cell: clampCell(cell),
				gap: clampGap(gap),
				padding: 24,
				captionHeight: captions ? 22 : 0,
			});
			const canvas = document.createElement("canvas");
			canvas.width = plan.width;
			canvas.height = plan.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			context.fillStyle = background;
			context.fillRect(0, 0, canvas.width, canvas.height);
			const dark = background === "#252820";
			context.textBaseline = "top";
			for (const [index, file] of files.entries()) {
				const slot = plan.cells[index];
				if (!slot) break;
				const objectUrl = URL.createObjectURL(file);
				try {
					const image = await loadImage(objectUrl);
					const rect = coverRect({ width: image.naturalWidth, height: image.naturalHeight }, slot.size.width);
					context.save();
					context.beginPath();
					context.rect(slot.x, slot.y, slot.size.width, slot.size.height);
					context.clip();
					context.drawImage(image, slot.x + rect.x, slot.y + rect.y, rect.width, rect.height);
					context.restore();
					if (captions) {
						context.fillStyle = dark ? "#e7e4d8" : "#3c3d37";
						context.font = '11px "DM Sans", system-ui, -apple-system, sans-serif';
						context.fillText(captionFor(file.name, Math.max(8, Math.floor(slot.size.width / 6.4))), slot.x, slot.captionY + 6);
					}
				} finally {
					URL.revokeObjectURL(objectUrl);
				}
			}
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({ blob, fileName: sheetFileName(plan.columns, plan.rows, outputExtension(format)), width: plan.width, height: plan.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the contact sheet.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<MultiFileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint={`Pick up to ${MAX_SHEET_CELLS} images. They are tiled into one review sheet — every picture is cropped to a square, never stretched.`}
				id="sheet-files"
				label="Images for the sheet"
				onFiles={chooseFiles}
			/>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="sheet-columns">
					Columns
					<select className={selectClassName} id="sheet-columns" onChange={(event) => setColumns(clampColumns(Number(event.target.value), files.length || 8))} value={columns}>
						{[1, 2, 3, 4, 5, 6, 8].map((count) => (
							<option key={count} value={count}>
								{count}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="sheet-cell">
					Cell size (px)
					<input className={fieldClassName} id="sheet-cell" max={1200} min={16} onChange={(event) => setCell(clampCell(Number(event.target.value)))} type="number" value={cell} />
				</label>
				<label className={labelClassName} htmlFor="sheet-gap">
					Gap (px)
					<input className={fieldClassName} id="sheet-gap" max={80} min={0} onChange={(event) => setGap(clampGap(Number(event.target.value)))} type="number" value={gap} />
				</label>
				<label className={labelClassName} htmlFor="sheet-background">
					Background
					<select className={selectClassName} id="sheet-background" onChange={(event) => setBackground(event.target.value)} value={background}>
						{SHEET_BACKGROUNDS.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="sheet-format">
					Output format
					<select className={selectClassName} id="sheet-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (smaller)</option>
						<option value="image/webp">WebP (smallest)</option>
					</select>
				</label>
				{format !== "image/png" ? (
					<label className={labelClassName} htmlFor="sheet-quality">
						Quality ({quality}%)
						<input className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]" id="sheet-quality" max={100} min={40} onChange={(event) => setQuality(Number(event.target.value))} step={5} type="range" value={quality} />
					</label>
				) : null}
			</div>
			<CheckboxField checked={captions} hint="Prints each file name under its picture, shortened to fit." id="sheet-captions" label="Caption every picture with its file name" onChange={setCaptions} />
			{files.length > 0 && layout ? (
				<StatGrid
					items={[
						{ label: "Pictures", value: String(files.length) },
						{ label: "Grid", value: `${layout.columns} × ${layout.rows}` },
						{ label: "Sheet size", value: `${layout.width} × ${layout.height} px` },
						{ label: "Queued size", value: describeBytes(files.reduce((sum, file) => sum + file.size, 0)) },
					]}
				/>
			) : null}
			<button className={`${primaryButtonClassName} self-start`} disabled={!files.length || busy} onClick={() => void build()} type="button">
				{busy ? "Building sheet…" : "Build contact sheet"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Contact sheet</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview
						alt={`Contact sheet preview: ${result.fileName}`}
						caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				A contact sheet is the fast way to review a shoot or send a client a single proof page. Pictures are cropped to squares, so nothing is squashed —
				lower the cell size if the sheet is too large to send.
			</p>
		</ToolPanel>
	);
};
