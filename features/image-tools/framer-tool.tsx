"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckboxField, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
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
import { backgroundCss, backgroundStops, FRAME_ASPECTS, FRAME_BACKGROUNDS, frameFileName, frameLayout, type FrameAspect } from "@/features/image-tools/framer-utils";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

const roundRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
	const r = Math.min(radius, width / 2, height / 2);
	context.beginPath();
	context.moveTo(x + r, y);
	context.arcTo(x + width, y, x + width, y + height, r);
	context.arcTo(x + width, y + height, x, y + height, r);
	context.arcTo(x, y + height, x, y, r);
	context.arcTo(x, y, x + width, y, r);
	context.closePath();
};

export const FramerTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [padding, setPadding] = useState(8);
	const [aspect, setAspect] = useState<FrameAspect>("auto");
	const [radius, setRadius] = useState(12);
	const [shadow, setShadow] = useState(true);
	const [backgroundId, setBackgroundId] = useState(FRAME_BACKGROUNDS[0].id);
	const [format, setFormat] = useState("image/png");
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const background = FRAME_BACKGROUNDS.find((option) => option.id === backgroundId) ?? FRAME_BACKGROUNDS[0];
	const layout = (() => {
		try {
			return size.width > 0 ? frameLayout({ image: size, padding, aspect, radius, shadow }) : null;
		} catch {
			return null;
		}
	})();

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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const render = async () => {
		if (!file || !previewUrl || !layout) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const image = await loadImage(previewUrl);
			const canvas = document.createElement("canvas");
			canvas.width = layout.canvas.width;
			canvas.height = layout.canvas.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (background.to) {
				const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
				backgroundStops(background).forEach((stop, index) => gradient.addColorStop(index, stop));
				context.fillStyle = gradient;
			} else {
				context.fillStyle = background.from;
			}
			context.fillRect(0, 0, canvas.width, canvas.height);
			if (shadow) {
				context.save();
				context.shadowColor = "rgba(24, 22, 16, 0.28)";
				context.shadowBlur = Math.round(Math.min(layout.image.width, layout.image.height) * 0.05);
				context.shadowOffsetY = Math.round(Math.min(layout.image.width, layout.image.height) * 0.022);
				roundRect(context, layout.image.x, layout.image.y, layout.image.width, layout.image.height, layout.radius);
				context.fillStyle = "#ffffff";
				context.fill();
				context.restore();
			}
			context.save();
			roundRect(context, layout.image.x, layout.image.y, layout.image.width, layout.image.height, layout.radius);
			context.clip();
			context.drawImage(image, layout.image.x, layout.image.y, layout.image.width, layout.image.height);
			context.restore();
			const blob = await canvasToBlob(canvas, format, 0.92);
			setResult({ blob, fileName: frameFileName(file.name, outputExtension(format)), width: canvas.width, height: canvas.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not frame this image.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Give a screenshot a padded, rounded frame with a background, ready for a post or a slide. Nothing is uploaded."
				id="framer-file"
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
				<label className={labelClassName} htmlFor="framer-padding">
					Padding ({padding}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
						id="framer-padding"
						max={30}
						min={0}
						onChange={(event) => setPadding(Number(event.target.value))}
						type="range"
						value={padding}
					/>
				</label>
				<label className={labelClassName} htmlFor="framer-radius">
					Corner radius ({radius}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
						id="framer-radius"
						max={50}
						min={0}
						onChange={(event) => setRadius(Number(event.target.value))}
						type="range"
						value={radius}
					/>
				</label>
				<label className={labelClassName} htmlFor="framer-aspect">
					Frame shape
					<select className={selectClassName} id="framer-aspect" onChange={(event) => setAspect(event.target.value as FrameAspect)} value={aspect}>
						{FRAME_ASPECTS.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="framer-format">
					Output format
					<select className={selectClassName} id="framer-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (smaller)</option>
						<option value="image/webp">WebP (smallest)</option>
					</select>
				</label>
			</div>
			<fieldset className="m-0 min-w-0 border-0 p-0">
				<legend className={`${labelClassName} mb-2`}>Background</legend>
				<div className="flex flex-wrap gap-2">
					{FRAME_BACKGROUNDS.map((option) => (
						<button
							aria-label={option.label}
							aria-pressed={option.id === backgroundId}
							className={`h-11 w-16 cursor-pointer border transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${option.id === backgroundId ? "border-forest ring-2 ring-forest ring-offset-1" : "border-line"}`}
							key={option.id}
							onClick={() => setBackgroundId(option.id)}
							style={{ background: backgroundCss(option) }}
							type="button"
						/>
					))}
				</div>
			</fieldset>
			<CheckboxField checked={shadow} hint="A soft drop shadow lifts the picture off the background." id="framer-shadow" label="Add a drop shadow" onChange={setShadow} />
			{layout ? (
				<div className="border border-line bg-[#f8f7f3] p-3">
					<div className="mx-auto flex items-center justify-center" style={{ background: backgroundCss(background), width: "100%", maxWidth: layout.canvas.width, aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}`, padding: `${(layout.image.y / layout.canvas.height) * 100}% 0` }}>
						<Image
							alt="Framed preview"
							className="max-h-full w-auto object-contain"
							style={{ borderRadius: `${(layout.radius / layout.canvas.width) * 100}%`, boxShadow: shadow ? "0 10px 24px #18161044" : undefined, height: `${(layout.image.height / layout.canvas.height) * 100}%` }}
							height={layout.image.height}
							src={previewUrl ?? ""}
							unoptimized
							width={layout.image.width}
						/>
					</div>
				</div>
			) : null}
			{layout ? (
				<StatGrid
					items={[
						{ label: "Frame size", value: `${layout.canvas.width} × ${layout.canvas.height} px` },
						{ label: "Picture", value: `${layout.image.width} × ${layout.image.height} px` },
						{ label: "Corner radius", value: `${layout.radius} px` },
						{ label: "Shadow", value: shadow ? "On" : "Off" },
					]}
				/>
			) : null}
			<button className={primaryButtonClassName} disabled={!file || busy} onClick={() => void render()} type="button">
				{busy ? "Framing…" : "Frame and download"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Framed image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview
						alt={`Framed preview: ${result.fileName}`}
						caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				Framing keeps the screenshot at its original pixel size and grows the canvas around it, so text stays crisp. Gradients run corner to corner,
				matching the preview above.
			</p>
		</ToolPanel>
	);
};
