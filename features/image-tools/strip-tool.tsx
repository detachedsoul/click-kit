"use client";

import { useState } from "react";
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
import { parseExif, type ExifSummary } from "@/features/image-tools/exif-utils";
import { fileToBytes } from "@/features/image-tools/image-file-shared";
import { outputExtension, stripExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const StripTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [exif, setExif] = useState<ExifSummary | null>(null);
	const [format, setFormat] = useState("image/png");
	const [quality, setQuality] = useState(92);
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const saved = result && file ? file.size - result.blob.size : 0;

	const chooseFile = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setFile(null);
		setExif(null);
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
			setExif(parseExif(await fileToBytes(nextFile, 256 * 1024)));
			setFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const strip = async () => {
		if (!file || !previewUrl || size.width === 0) return;
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
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({
				blob,
				fileName: `${stripExtension(file.name)}-clean.${outputExtension(format)}`,
				width: size.width,
				height: size.height,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not rebuild this image.");
		} finally {
			setBusy(false);
		}
	};

	const findings = exif?.fields.map((field) => field.label).join(", ") ?? "";

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Rebuilds the picture from its pixels, which drops EXIF, GPS, XMP, and thumbnails before you share it."
				id="strip-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{file && previewUrl ? (
				<>
					<ImagePreview
						alt={`Source image: ${file.name}`}
						caption={`${file.name} · ${size.width} × ${size.height} px · ${describeBytes(file.size)}`}
						height={size.height}
						url={previewUrl}
						width={size.width}
					/>
					<p className={exif ? "m-0 border-l-2 border-[#b78b42] bg-[#f8f2e2] px-3 py-2 text-xs leading-relaxed text-[#61502b]" : hintClassName}>
						{exif
							? `Hidden metadata found: ${findings}. ${exif.gps ? "GPS coordinates are included — anyone with the file can see where it was taken." : "Rebuilding the file removes all of it."}`
							: "No EXIF block was found, but apps can still attach other metadata. Rebuilding the image guarantees a clean file."}
					</p>
				</>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="strip-format">
					Output format
					<select className={selectClassName} id="strip-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (smaller photos)</option>
						<option value="image/webp">WebP (smallest)</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="strip-quality">
					Quality ({quality}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={format === "image/png"}
						id="strip-quality"
						max={100}
						min={40}
						onChange={(event) => setQuality(Number(event.target.value))}
						step={5}
						type="range"
						value={quality}
					/>
				</label>
			</div>
			<button
				className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={!file || busy}
				onClick={() => void strip()}
				type="button"
			>
				{busy ? "Rebuilding…" : "Remove metadata"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl && file ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Clean image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<StatGrid
						items={[
							{ label: "Before", value: describeBytes(file.size) },
							{ label: "After", value: describeBytes(result.blob.size) },
							{ label: "Difference", value: `${saved >= 0 ? "−" : "+"}${describeBytes(Math.abs(saved))}` },
							{ label: "Dimensions", value: `${result.width} × ${result.height} px` },
						]}
					/>
					<ImagePreview
						alt={`Clean preview: ${result.fileName}`}
						caption={`${result.fileName} · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				Rebuilding keeps the pixels but not the extras: animation frames, colour profiles, and the original EXIF are lost. PNG keeps transparency; JPEG
				and WebP make photos much smaller.
			</p>
		</ToolPanel>
	);
};
