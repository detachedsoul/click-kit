"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Crop } from "lucide-react";
import { ErrorNote, hintClassName, labelClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	describeBytes,
	FileDownloadLink,
	FileField,
	ImagePreview,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	canvasToBlob,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { ASPECT_PRESETS, outputExtension, placeCrop, ratioLabel, stripExtension, type Size } from "@/features/image-tools/crop-utils";

type CropResult = { blob: Blob; fileName: string; width: number; height: number };

export const CropTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [aspectId, setAspectId] = useState("square");
	const [zoom, setZoom] = useState(1);
	const [offsetX, setOffsetX] = useState(0.5);
	const [offsetY, setOffsetY] = useState(0.5);
	const [format, setFormat] = useState("image/png");
	const [quality, setQuality] = useState(90);
	const [result, setResult] = useState<CropResult | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const aspect = ASPECT_PRESETS.find((preset) => preset.id === aspectId)?.value ?? null;
	const rect = useMemo(() => (size.width > 0 ? placeCrop(size, aspect, zoom, offsetX, offsetY) : null), [size, aspect, zoom, offsetX, offsetY]);

	const chooseFile = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setSize({ width: 0, height: 0 });
		setFile(null);
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

	const crop = async () => {
		if (!file || !previewUrl || !rect) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const image = await loadImage(previewUrl);
			const canvas = document.createElement("canvas");
			canvas.width = rect.width;
			canvas.height = rect.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (format === "image/jpeg") {
				context.fillStyle = "#ffffff";
				context.fillRect(0, 0, rect.width, rect.height);
			}
			context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({
				blob,
				fileName: `${stripExtension(file.name)}-cropped.${outputExtension(format)}`,
				width: rect.width,
				height: rect.height,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not crop this image.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Nothing is uploaded. Animated frames are exported as a single still image."
				id="crop-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{busy && !file ? (
				<p className="m-0 text-xs text-muted" role="status">
					Reading image dimensions on this device…
				</p>
			) : null}
			{file && rect ? (
				<div className="flex flex-col gap-4">
					<div className="relative inline-block max-w-full self-start overflow-hidden border border-line bg-[#f4f2ec]">
						{/* The overlay is drawn with percentages so it lines up at any display size. */}
						<Image
							alt={`Crop preview of ${file.name}`}
							className="block h-auto max-h-[420px] w-auto max-w-full"
							height={size.height}
							src={previewUrl}
							unoptimized
							width={size.width}
						/>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(24,24,20,.55)]"
							style={{
								left: `${(rect.x / size.width) * 100}%`,
								top: `${(rect.y / size.height) * 100}%`,
								width: `${(rect.width / size.width) * 100}%`,
								height: `${(rect.height / size.height) * 100}%`,
							}}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className={labelClassName} htmlFor="crop-aspect">
							Aspect ratio
							<select className={selectClassName} id="crop-aspect" value={aspectId} onChange={(event) => setAspectId(event.target.value)}>
								{ASPECT_PRESETS.map((preset) => (
									<option key={preset.id} value={preset.id}>
										{preset.label}
									</option>
								))}
							</select>
						</label>
						<label className={labelClassName} htmlFor="crop-zoom">
							Zoom ({zoom.toFixed(1)}×)
							<input
								className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
								id="crop-zoom"
								max={4}
								min={1}
								onChange={(event) => setZoom(Number(event.target.value))}
								step={0.1}
								type="range"
								value={zoom}
							/>
						</label>
						<label className={labelClassName} htmlFor="crop-x">
							Horizontal position ({Math.round(offsetX * 100)}%)
							<input
								className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
								id="crop-x"
								max={1}
								min={0}
								onChange={(event) => setOffsetX(Number(event.target.value))}
								step={0.01}
								type="range"
								value={offsetX}
							/>
						</label>
						<label className={labelClassName} htmlFor="crop-y">
							Vertical position ({Math.round(offsetY * 100)}%)
							<input
								className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
								id="crop-y"
								max={1}
								min={0}
								onChange={(event) => setOffsetY(Number(event.target.value))}
								step={0.01}
								type="range"
								value={offsetY}
							/>
						</label>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className={labelClassName} htmlFor="crop-format">
							Output format
							<select className={selectClassName} id="crop-format" value={format} onChange={(event) => setFormat(event.target.value)}>
								<option value="image/png">PNG (lossless, keeps transparency)</option>
								<option value="image/jpeg">JPEG (smallest for photos)</option>
								<option value="image/webp">WebP (small, keeps transparency)</option>
							</select>
						</label>
						<label className={labelClassName} htmlFor="crop-quality">
							Quality ({quality}%)
							<input
								className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34] disabled:cursor-not-allowed disabled:opacity-50"
								disabled={format === "image/png"}
								id="crop-quality"
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
							{ label: "Source ratio", value: ratioLabel(size) },
							{ label: "Crop", value: `${rect.width} × ${rect.height} px` },
							{ label: "Crop ratio", value: ratioLabel(rect) },
						]}
					/>
					<button
						className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
						disabled={busy}
						onClick={() => void crop()}
						type="button"
					>
						<Crop aria-hidden="true" className="mr-2 inline" size={14} />
						{busy ? "Cropping…" : "Crop image"}
					</button>
				</div>
			) : null}
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Cropped image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview alt={`Cropped preview: ${result.fileName}`} caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`} height={result.height} url={resultUrl} width={result.width} />
				</section>
			) : null}
			<p className={hintClassName}>
				The crop box is the largest rectangle of the chosen ratio that fits the image, then zoom and position move it. Cropping always happens in
				this browser tab, so originals stay where they are.
			</p>
		</ToolPanel>
	);
};
