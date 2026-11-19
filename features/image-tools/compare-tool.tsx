"use client";

import { useState } from "react";
import { CheckboxField, ErrorNote, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { ACCEPTED_IMAGE_TYPES, canvasToBlob, describeBytes, FileDownloadLink, FileField, isSupportedImage, loadImage, MAX_IMAGE_BYTES, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";
import { clampPosition, compareCanvas, compareFileName, compareHalves, containRect, describeChange, ORIENTATIONS, pointerPercent, revealClip, type CompareOrientation } from "@/features/image-tools/compare-utils";

type Side = { file: File; size: Size };

type Result = { blob: Blob; fileName: string; width: number; height: number };

const EMPTY: Size = { width: 0, height: 0 };

export const CompareTool = () => {
	const [before, setBefore] = useState<Side | null>(null);
	const [after, setAfter] = useState<Side | null>(null);
	const [position, setPosition] = useState(50);
	const [orientation, setOrientation] = useState<CompareOrientation>("horizontal");
	const [labels, setLabels] = useState(true);
	const [format, setFormat] = useState("image/png");
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const beforeUrl = useObjectUrl(before?.file ?? null);
	const afterUrl = useObjectUrl(after?.file ?? null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const stage = after?.size ?? before?.size ?? EMPTY;

	const choose = async (side: "before" | "after", nextFile: File | null) => {
		setResult(null);
		setError("");
		if (side === "before") setBefore(null);
		else setAfter(null);
		if (!nextFile) return;
		if (!isSupportedImage(nextFile)) {
			setError("Choose a PNG, JPEG, WebP, GIF, AVIF, or BMP image.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_BYTES) {
			setError("Choose an image smaller than 25 MB.");
			return;
		}
		const objectUrl = URL.createObjectURL(nextFile);
		try {
			const image = await loadImage(objectUrl);
			const loaded = { file: nextFile, size: { width: image.naturalWidth, height: image.naturalHeight } };
			if (side === "before") setBefore(loaded);
			else setAfter(loaded);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	};

	const drag = (clientX: number, clientY: number, element: HTMLElement) => {
		const rect = element.getBoundingClientRect();
		setPosition(pointerPercent({ x: clientX, y: clientY }, rect, orientation));
	};

	const exportComparison = async () => {
		if (!before || !after) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const box = compareCanvas(before.size, after.size);
			const canvas = document.createElement("canvas");
			canvas.width = box.width;
			canvas.height = box.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			context.fillStyle = format === "image/jpeg" ? "#ffffff" : "#f3f1e9";
			context.fillRect(0, 0, canvas.width, canvas.height);
			const halves = compareHalves(box, position, orientation);
			const sides: { url: string; size: Size; rect: { x: number; y: number; width: number; height: number }; area: { x: number; y: number; width: number; height: number } }[] = [
				{ url: beforeUrl ?? "", size: before.size, rect: halves.before, area: containRect(before.size, box) },
				{ url: afterUrl ?? "", size: after.size, rect: halves.after, area: containRect(after.size, box) },
			];
			for (const side of sides) {
				if (!side.url) throw new Error("Both pictures are needed to export a comparison.");
				const image = await loadImage(side.url);
				context.save();
				context.beginPath();
				context.rect(side.rect.x, side.rect.y, Math.max(0, side.rect.width), Math.max(0, side.rect.height));
				context.clip();
				context.drawImage(image, side.area.x, side.area.y, side.area.width, side.area.height);
				context.restore();
				if (labels) {
					const text = side === sides[0] ? "Before" : "After";
					context.font = '600 13px "DM Sans", system-ui, -apple-system, sans-serif';
					const width = context.measureText(text).width + 20;
					const padding = Math.round(Math.min(box.width, box.height) * 0.03);
					const x = side === sides[0] ? padding : box.width - padding - width;
					const y = padding;
					context.fillStyle = "rgba(37, 40, 32, 0.82)";
					context.fillRect(x, y, width, 26);
					context.fillStyle = "#ffffff";
					context.textBaseline = "middle";
					context.fillText(text, x + 10, y + 14);
					context.textBaseline = "alphabetic";
				}
			}
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : 0.92);
			setResult({ blob, fileName: compareFileName(before.file.name, outputExtension(format)), width: box.width, height: box.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not export the comparison.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<FileField
					accept={ACCEPTED_IMAGE_TYPES}
					disabled={busy}
					hint="The original, or the heavier version."
					id="compare-before"
					label="Before image"
					onFile={(next) => void choose("before", next)}
				/>
				<FileField
					accept={ACCEPTED_IMAGE_TYPES}
					disabled={busy}
					hint="The edited, compressed, or retouched version."
					id="compare-after"
					label="After image"
					onFile={(next) => void choose("after", next)}
				/>
			</div>
			{beforeUrl || afterUrl ? (
				<div
					aria-label="Comparison preview — drag to move the divider"
					className="relative w-full touch-none select-none overflow-hidden border border-line bg-[#f3f1e9]"
					onPointerDown={(event) => {
						event.currentTarget.setPointerCapture(event.pointerId);
						drag(event.clientX, event.clientY, event.currentTarget);
					}}
					onPointerMove={(event) => {
						if (event.buttons === 1) drag(event.clientX, event.clientY, event.currentTarget);
					}}
					role="group"
					style={{ aspectRatio: stage.width > 0 && stage.height > 0 ? `${stage.width} / ${stage.height}` : "16 / 9", maxHeight: 520 }}
				>
					{beforeUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img alt="Before" className="absolute inset-0 size-full object-contain" src={beforeUrl} />
					) : null}
					{afterUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							alt="After"
							className="pointer-events-none absolute inset-0 size-full object-contain"
							src={afterUrl}
							style={{ clipPath: revealClip(position, orientation) }}
						/>
					) : null}
					{beforeUrl && afterUrl ? (
						<span
							aria-hidden="true"
							className={`pointer-events-none absolute bg-white shadow-[0_0_0_1px_#25282060] ${orientation === "vertical" ? "inset-x-0 h-0.5" : "inset-y-0 w-0.5"}`}
							style={orientation === "vertical" ? { top: `${position}%` } : { left: `${position}%` }}
						/>
					) : null}
					{beforeUrl && afterUrl ? (
						<>
							<span className="pointer-events-none absolute left-2 top-2 bg-[#252820d9] px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-white">
								{before ? "Before" : "—"}
							</span>
							<span className="pointer-events-none absolute bottom-2 right-2 bg-[#252820d9] px-2 py-1 font-mono text-[9px] uppercase tracking-[.08em] text-white">After</span>
						</>
					) : null}
				</div>
			) : null}
			<label className={labelClassName} htmlFor="compare-position">
				Divider position ({position}%)
				<input
					className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
					id="compare-position"
					max={100}
					min={0}
					onChange={(event) => setPosition(clampPosition(Number(event.target.value)))}
					type="range"
					value={position}
				/>
			</label>
			<SegmentedControl label="Comparison layout" onChange={setOrientation} options={ORIENTATIONS} value={orientation} />
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="compare-format">
					Export format
					<select className={selectClassName} id="compare-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (smaller)</option>
						<option value="image/webp">WebP (smallest)</option>
					</select>
				</label>
			</div>
			<CheckboxField checked={labels} hint="Stamps a Before and After chip on the exported picture." id="compare-labels" label="Label both halves in the export" onChange={setLabels} />
			{before && after ? (
				<StatGrid
					items={[
						{ label: "Before", value: `${before.size.width} × ${before.size.height}` },
						{ label: "After", value: `${after.size.width} × ${after.size.height}` },
						{ label: "Size change", value: describeChange(before.file.size, after.file.size) },
						{ label: "Divider", value: `${position}%` },
					]}
				/>
			) : null}
			<button className={`${primaryButtonClassName} self-start`} disabled={!before || !after || busy} onClick={() => void exportComparison()} type="button">
				{busy ? "Exporting…" : "Export comparison"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Comparison image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<p className="m-0 text-[11px] text-muted">
						{result.width} × {result.height} px · {describeBytes(result.blob.size)}
					</p>
				</section>
			) : null}
			<p className={hintClassName}>
				Drag the divider to see exactly what a compression setting, filter, or retouch changed. Both pictures are drawn at their own proportions, so
				different sizes line up in the middle rather than being stretched.
			</p>
		</ToolPanel>
	);
};
