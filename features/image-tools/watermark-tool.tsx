"use client";

import { useState } from "react";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
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
import { ANCHORS, anchorPosition, clampFontSize, clampOpacity, tilePositions, watermarkFileName, type Anchor } from "@/features/image-tools/watermark-utils";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const WatermarkTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [text, setText] = useState("© Your name");
	const [fontSize, setFontSize] = useState(48);
	const [color, setColor] = useState("#ffffff");
	const [opacity, setOpacity] = useState(70);
	const [anchor, setAnchor] = useState<Anchor>("bottom-right");
	const [tiled, setTiled] = useState(false);
	const [format, setFormat] = useState("image/png");
	const [quality, setQuality] = useState(90);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const chooseFile = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setFile(null);
		setSize({ width: 0, height: 0 });
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
			setFontSize(Math.max(14, Math.round(Math.min(image.naturalWidth, image.naturalHeight) / 12)));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const apply = async () => {
		if (!file || !previewUrl || size.width === 0) return;
		if (!text.trim()) {
			setError("Type the watermark text first.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const image = await loadImage(previewUrl);
			const canvas = document.createElement("canvas");
			canvas.width = size.width;
			canvas.height = size.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (format === "image/jpeg") {
				context.fillStyle = "#ffffff";
				context.fillRect(0, 0, canvas.width, canvas.height);
			}
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			const pixels = clampFontSize(fontSize, size);
			context.font = `600 ${pixels}px "DM Sans", system-ui, -apple-system, sans-serif`;
			context.textBaseline = "top";
			context.fillStyle = color;
			context.globalAlpha = clampOpacity(opacity / 100);
			const box = { width: Math.ceil(context.measureText(text).width), height: Math.ceil(pixels * 1.2) };
			const padding = Math.max(12, Math.round(Math.min(size.width, size.height) * 0.03));
			if (tiled) {
				for (const point of tilePositions(size, box, padding, Math.round(pixels * 0.8))) {
					context.fillText(text, point.x, point.y);
				}
			} else {
				const point = anchorPosition(size, box, anchor, padding);
				context.fillText(text, point.x, point.y);
			}
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({ blob, fileName: watermarkFileName(file.name, outputExtension(format)), width: size.width, height: size.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not add the watermark.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Marks your picture with text — a signature, a note, or a repeated pattern. Everything stays on this device."
				id="watermark-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{file && previewUrl ? (
				<ImagePreview
					alt={`Source image: ${file.name}`}
					caption={`${file.name} · ${size.width} × ${size.height} px · ${describeBytes(file.size)}`}
					height={size.height}
					url={previewUrl}
					width={size.width}
				/>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="watermark-text">
					Watermark text
					<input className={fieldClassName} id="watermark-text" onChange={(event) => setText(event.target.value)} value={text} />
				</label>
				<label className={labelClassName} htmlFor="watermark-size">
					Size ({fontSize}px)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
						id="watermark-size"
						max={400}
						min={8}
						onChange={(event) => setFontSize(Number(event.target.value))}
						type="range"
						value={fontSize}
					/>
				</label>
				<label className={labelClassName} htmlFor="watermark-colour">
					Text colour
					<input className={`${fieldClassName} h-11 cursor-pointer p-1`} id="watermark-colour" onChange={(event) => setColor(event.target.value)} type="color" value={color} />
				</label>
				<label className={labelClassName} htmlFor="watermark-opacity">
					Opacity ({opacity}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
						id="watermark-opacity"
						max={100}
						min={5}
						onChange={(event) => setOpacity(Number(event.target.value))}
						step={5}
						type="range"
						value={opacity}
					/>
				</label>
				<label className={labelClassName} htmlFor="watermark-anchor">
					Position
					<select
						className={selectClassName}
						disabled={tiled}
						id="watermark-anchor"
						onChange={(event) => setAnchor(event.target.value as Anchor)}
						value={anchor}
					>
						{ANCHORS.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="watermark-format">
					Output format
					<select className={selectClassName} id="watermark-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (photos)</option>
						<option value="image/webp">WebP (small)</option>
					</select>
				</label>
			</div>
			<CheckboxField checked={tiled} hint="Repeats the text diagonally so it cannot simply be cropped out." id="watermark-tile" label="Repeat across the whole image" onChange={setTiled} />
			{format !== "image/png" ? (
				<label className={labelClassName} htmlFor="watermark-quality">
					Quality ({quality}%)
					<input
						className="block h-11 w-full cursor-pointer accent-[#263b34]"
						id="watermark-quality"
						max={100}
						min={40}
						onChange={(event) => setQuality(Number(event.target.value))}
						step={5}
						type="range"
						value={quality}
					/>
				</label>
			) : null}
			{size.width > 0 ? (
				<StatGrid
					items={[
						{ label: "Image", value: `${size.width} × ${size.height} px` },
						{ label: "Watermark", value: tiled ? "Tiled" : (ANCHORS.find((option) => option.id === anchor)?.label ?? anchor) },
						{ label: "Text size", value: `${clampFontSize(fontSize, size)} px` },
						{ label: "Opacity", value: `${clampOpacity(opacity / 100) * 100}%` },
					]}
				/>
			) : null}
			<button
				className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={!file || busy}
				onClick={() => void apply()}
				type="button"
			>
				{busy ? "Stamping…" : "Add watermark"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Watermarked image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview
						alt={`Watermarked preview: ${result.fileName}`}
						caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				Text uses your system sans-serif font, so it looks the same everywhere it is opened. A watermark deters casual reuse; it is not a security
				measure.
			</p>
		</ToolPanel>
	);
};
