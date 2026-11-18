"use client";

import { useState } from "react";
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react";
import { ErrorNote, hintClassName, labelClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	canvasToBlob,
	describeBytes,
	FileDownloadLink,
	FileField,
	ImagePreview,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { drawTransformed, isUntouched, nextRotation, orientationLabel, rotatedSize, type Rotation } from "@/features/image-tools/rotate-utils";
import { outputExtension, stripExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

const actionClassName =
	"inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-surface px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export const RotateTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [rotation, setRotation] = useState<Rotation>(0);
	const [flipX, setFlipX] = useState(false);
	const [flipY, setFlipY] = useState(false);
	const [format, setFormat] = useState("image/png");
	const [quality, setQuality] = useState(90);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const output = size.width > 0 ? rotatedSize(size, rotation) : null;

	const chooseFile = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setFile(null);
		setSize({ width: 0, height: 0 });
		setRotation(0);
		setFlipX(false);
		setFlipY(false);
		if (!nextFile) return;
		if (!isSupportedImage(nextFile)) {
			setError("Choose a PNG, JPEG, WebP, GIF, AVIF, or BMP image.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_BYTES) {
			setError("Choose an image smaller than 25 MB.");
			return;
		}
		setBusy(true);
		const objectUrl = URL.createObjectURL(nextFile);
		try {
			const image = await loadImage(objectUrl);
			setSize({ width: image.naturalWidth, height: image.naturalHeight });
			setFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const exportImage = async () => {
		if (!file || !previewUrl || !output) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const image = await loadImage(previewUrl);
			const canvas = document.createElement("canvas");
			canvas.width = output.width;
			canvas.height = output.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (format === "image/jpeg") {
				context.fillStyle = "#ffffff";
				context.fillRect(0, 0, canvas.width, canvas.height);
			}
			drawTransformed(context, image, size, rotation, flipX, flipY);
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({
				blob,
				fileName: `${stripExtension(file.name)}-${rotation ? `${rotation}deg` : "flipped"}.${outputExtension(format)}`,
				width: output.width,
				height: output.height,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not rotate this image.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Rotate or flip a photo sideways or upside down, then download the result. Nothing is uploaded."
				id="rotate-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{busy && !file ? (
				<p className="m-0 text-xs text-muted" role="status">
					Reading image dimensions…
				</p>
			) : null}
			{file && previewUrl && output ? (
				<>
					<ImagePreview
						alt={`Source image: ${file.name}`}
						caption={`${file.name} · ${size.width} × ${size.height} px · ${describeBytes(file.size)}`}
						height={size.height}
						url={previewUrl}
						width={size.width}
					/>
					<div className="flex flex-col gap-2">
						<span className={labelClassName}>Transform</span>
						<div className="flex flex-wrap gap-2">
							<button className={actionClassName} onClick={() => setRotation(nextRotation(rotation, -90))} type="button">
								<RotateCcw aria-hidden="true" size={14} /> Rotate left
							</button>
							<button className={actionClassName} onClick={() => setRotation(nextRotation(rotation, 90))} type="button">
								<RotateCw aria-hidden="true" size={14} /> Rotate right
							</button>
							<button aria-pressed={flipX} className={actionClassName} onClick={() => setFlipX((value) => !value)} type="button">
								<FlipHorizontal2 aria-hidden="true" size={14} /> Flip horizontal
							</button>
							<button aria-pressed={flipY} className={actionClassName} onClick={() => setFlipY((value) => !value)} type="button">
								<FlipVertical2 aria-hidden="true" size={14} /> Flip vertical
							</button>
							<button
								className={actionClassName}
								disabled={isUntouched(rotation, flipX, flipY)}
								onClick={() => {
									setRotation(0);
									setFlipX(false);
									setFlipY(false);
								}}
								type="button"
							>
								Reset
							</button>
						</div>
						<p className="m-0 text-xs text-muted" role="status">
							{orientationLabel(rotation, flipX, flipY)} · {output.width} × {output.height} px
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className={labelClassName} htmlFor="rotate-format">
							Output format
							<select className={selectClassName} id="rotate-format" onChange={(event) => setFormat(event.target.value)} value={format}>
								<option value="image/png">PNG (lossless)</option>
								<option value="image/jpeg">JPEG (photos)</option>
								<option value="image/webp">WebP (small)</option>
							</select>
						</label>
						<label className={labelClassName} htmlFor="rotate-quality">
							Quality ({quality}%)
							<input
								className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34] disabled:cursor-not-allowed disabled:opacity-50"
								disabled={format === "image/png"}
								id="rotate-quality"
								max={100}
								min={40}
								onChange={(event) => setQuality(Number(event.target.value))}
								step={5}
								type="range"
								value={quality}
							/>
						</label>
					</div>
					<StatGrid
						items={[
							{ label: "Source", value: `${size.width} × ${size.height} px` },
							{ label: "Export", value: `${output.width} × ${output.height} px` },
							{ label: "Rotation", value: `${rotation}°` },
							{ label: "Flips", value: [flipX ? "horizontal" : "", flipY ? "vertical" : ""].filter(Boolean).join(" + ") || "none" },
						]}
					/>
					<button
						className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
						disabled={busy || isUntouched(rotation, flipX, flipY)}
						onClick={() => void exportImage()}
						type="button"
					>
						{busy ? "Processing…" : "Apply and download"}
					</button>
				</>
			) : null}
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Transformed image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview
						alt={`Transformed preview: ${result.fileName}`}
						caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				Quarter turns are lossless in geometry but the export re-encodes pixels, so pick PNG to avoid another round of JPEG compression.
			</p>
		</ToolPanel>
	);
};
