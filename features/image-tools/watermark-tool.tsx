"use client";

import { useState } from "react";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
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
import { ANCHORS, anchorPosition, clampFontSize, clampLogoScaled, clampOpacity, logoBox, tilePositions, WATERMARK_SOURCES, watermarkFileName, watermarkSummary, type Anchor, type WatermarkSource } from "@/features/image-tools/watermark-utils";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const WatermarkTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [source, setSource] = useState<WatermarkSource>("text");
	const [logoFile, setLogoFile] = useState<File | null>(null);
	const [logoSize, setLogoSize] = useState<Size>({ width: 0, height: 0 });
	const [logoScale, setLogoScale] = useState(20);
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
	const logoUrl = useObjectUrl(logoFile);
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

	const chooseLogo = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setLogoFile(null);
		setLogoSize({ width: 0, height: 0 });
		if (!nextFile) return;
		if (!isSupportedImage(nextFile)) {
			setError("Choose a PNG, JPEG, WebP, GIF, AVIF, or BMP image to use as the watermark.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_BYTES) {
			setError("Choose a watermark image smaller than 25 MB.");
			return;
		}
		const objectUrl = URL.createObjectURL(nextFile);
		try {
			const image = await loadImage(objectUrl);
			setLogoSize({ width: image.naturalWidth, height: image.naturalHeight });
			setLogoFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This watermark image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	};

	const apply = async () => {
		if (!file || !previewUrl || size.width === 0) return;
		if (source === "text" && !text.trim()) {
			setError("Type the watermark text first.");
			return;
		}
		if (source === "image" && (!logoFile || logoSize.width < 1)) {
			setError("Choose the image you want to use as the watermark.");
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
			context.globalAlpha = clampOpacity(opacity / 100);
			const padding = Math.max(12, Math.round(Math.min(size.width, size.height) * 0.03));
			if (source === "text") {
				const pixels = clampFontSize(fontSize, size);
				context.font = `600 ${pixels}px "DM Sans", system-ui, -apple-system, sans-serif`;
				context.textBaseline = "top";
				context.fillStyle = color;
				const box = { width: Math.ceil(context.measureText(text).width), height: Math.ceil(pixels * 1.2) };
				if (tiled) {
					for (const point of tilePositions(size, box, padding, Math.round(pixels * 0.8))) {
						context.fillText(text, point.x, point.y);
					}
				} else {
					const point = anchorPosition(size, box, anchor, padding);
					context.fillText(text, point.x, point.y);
				}
			} else {
				if (!logoUrl) throw new Error("Choose the image you want to use as the watermark.");
				const logo = await loadImage(logoUrl);
				const box = logoBox(size, logoSize, logoScale);
				if (tiled) {
					for (const point of tilePositions(size, box, padding, Math.round(box.height * 0.6))) {
						context.drawImage(logo, point.x, point.y, box.width, box.height);
					}
				} else {
					const point = anchorPosition(size, box, anchor, padding);
					context.drawImage(logo, point.x, point.y, box.width, box.height);
				}
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
				hint="Marks your picture with text or your own logo — a signature, a note, or a repeated stamp. Everything stays on this device."
				id="watermark-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			<SegmentedControl
				label="Watermark type"
				onChange={(value) => {
					setSource(value);
					setResult(null);
					setError("");
				}}
				options={WATERMARK_SOURCES}
				value={source}
			/>
			{source === "image" ? (
				<div className="flex flex-col gap-3">
					<FileField
						accept={ACCEPTED_IMAGE_TYPES}
						disabled={busy}
						hint="A logo, signature, or stamp image. Transparent PNGs work best, and the logo always keeps its own proportions."
						id="watermark-logo"
						label="Watermark image"
						onFile={(next) => void chooseLogo(next)}
					/>
					{logoFile && logoUrl ? (
						<div className="flex flex-wrap items-center gap-3 border border-line bg-[#fbfaf7] p-2.5">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img alt={`Watermark image: ${logoFile.name}`} className="h-14 w-auto max-w-[180px] object-contain" src={logoUrl} />
							<span className="text-[11px] text-muted">
								{logoFile.name} · {logoSize.width} × {logoSize.height} px
								{size.width > 0 ? ` · stamped at ${logoBox(size, logoSize, logoScale).width} × ${logoBox(size, logoSize, logoScale).height} px` : ""}
							</span>
						</div>
					) : null}
					<label className={labelClassName} htmlFor="watermark-logo-scale">
						Logo width ({clampLogoScaled(logoScale)}% of the picture)
						<input
							className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
							id="watermark-logo-scale"
							max={90}
							min={2}
							onChange={(event) => setLogoScale(Number(event.target.value))}
							type="range"
							value={logoScale}
						/>
					</label>
				</div>
			) : null}
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
				{source === "text" ? (
					<label className={labelClassName} htmlFor="watermark-text">
						Watermark text
						<input className={fieldClassName} id="watermark-text" onChange={(event) => setText(event.target.value)} value={text} />
					</label>
				) : null}
				{source === "text" ? (
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
				) : null}
				{source === "text" ? (
					<label className={labelClassName} htmlFor="watermark-colour">
						Text colour
						<input className={`${fieldClassName} h-11 cursor-pointer p-1`} id="watermark-colour" onChange={(event) => setColor(event.target.value)} type="color" value={color} />
					</label>
				) : null}
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
			<CheckboxField checked={tiled} hint={`Repeats the ${source === "image" ? "logo" : "text"} across the whole picture so it cannot simply be cropped out.`} id="watermark-tile" label="Repeat across the whole image" onChange={setTiled} />
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
						{
							label: "Watermark",
							value: watermarkSummary(source, {
								text,
								logoName: logoFile?.name ?? null,
								tiled,
								anchorLabel: ANCHORS.find((option) => option.id === anchor)?.label ?? anchor,
							}),
						},
						{ label: source === "image" ? "Logo size" : "Text size", value: source === "image" ? (logoSize.width > 0 ? `${logoBox(size, logoSize, logoScale).width} px wide` : "—") : `${clampFontSize(fontSize, size)} px` },
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
				{busy ? "Stamping…" : source === "image" ? "Stamp the logo" : "Add watermark"}
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
				Text uses your system sans-serif font, so it looks the same everywhere it is opened. Logos keep their transparency and proportions, and are
				stamped at the width you choose. A watermark deters casual reuse; it is not a security measure.
			</p>
		</ToolPanel>
	);
};
