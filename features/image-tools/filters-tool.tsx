"use client";

import { useState } from "react";
import Image from "next/image";
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
import { cssFilter, DEFAULT_FILTERS, describeFilters, FILTER_CONTROLS, filterFileName, isIdentity, type FilterValues } from "@/features/image-tools/filters-utils";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const FiltersTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [values, setValues] = useState<FilterValues>(DEFAULT_FILTERS);
	const [format, setFormat] = useState("image/webp");
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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const apply = async () => {
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
			if (typeof context.filter !== "string") throw new Error("This browser cannot apply filters while exporting. Try a recent Chrome, Firefox, or Safari.");
			context.filter = cssFilter(values);
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			context.filter = "none";
			const blob = await canvasToBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
			setResult({ blob, fileName: filterFileName(file.name, outputExtension(format)), width: size.width, height: size.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not export this image.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Grayscale, sepia, blur, and exposure-style adjustments, previewed live and exported without uploading anything."
				id="filters-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{file && previewUrl ? (
				<div className="flex flex-col gap-3 border border-line bg-[#f8f7f3] p-3">
					<Image
						alt={`Filter preview of ${file.name}`}
						className="max-h-64 w-auto max-w-full self-start object-contain"
						height={size.height}
						src={previewUrl}
						style={{ filter: cssFilter(values) }}
						unoptimized
						width={size.width}
					/>
					<p className="m-0 text-xs leading-relaxed text-muted">
						{file.name} · {size.width} × {size.height} px · {describeBytes(file.size)}
						<br />
						Live preview: {describeFilters(values)}
					</p>
				</div>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				{FILTER_CONTROLS.map((control) => (
					<label className={labelClassName} htmlFor={`filters-${control.key}`} key={control.key}>
						{control.label} ({values[control.key]}
						{control.unit})
						<input
							className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
							id={`filters-${control.key}`}
							max={control.max}
							min={control.min}
							onChange={(event) => setValues((current) => ({ ...current, [control.key]: Number(event.target.value) }))}
							step={control.step}
							type="range"
							value={values[control.key]}
						/>
					</label>
				))}
				<label className={labelClassName} htmlFor="filters-format">
					Output format
					<select className={selectClassName} id="filters-format" onChange={(event) => setFormat(event.target.value)} value={format}>
						<option value="image/webp">WebP (small)</option>
						<option value="image/png">PNG (lossless)</option>
						<option value="image/jpeg">JPEG (photos)</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="filters-quality">
					Quality ({quality}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={format === "image/png"}
						id="filters-quality"
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
					{ label: "Filters", value: describeFilters(values) },
					{ label: "Output", value: format.replace("image/", "").toUpperCase() },
					{ label: "Quality", value: format === "image/png" ? "Lossless" : `${quality}%` },
					{ label: "Source", value: size.width > 0 ? `${size.width} × ${size.height} px` : "No image yet" },
				]}
			/>
			<div className="flex flex-wrap gap-2">
				<button
					className="min-h-10 cursor-pointer border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
					disabled={!file || busy || isIdentity(values)}
					onClick={() => void apply()}
					type="button"
				>
					{busy ? "Exporting…" : "Export filtered image"}
				</button>
				<button
					className="min-h-10 cursor-pointer border border-line bg-surface px-4 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isIdentity(values)}
					onClick={() => setValues(DEFAULT_FILTERS)}
					type="button"
				>
					Reset filters
				</button>
			</div>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Filtered image</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview
						alt={`Filtered preview: ${result.fileName}`}
						caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`}
						height={result.height}
						url={resultUrl}
						width={result.width}
					/>
				</section>
			) : null}
			<p className={hintClassName}>
				Filters use the browser&apos;s own canvas filter pipeline, so the preview and the exported file match. Blur costs time on very large images;
				keep those under a few megapixels.
			</p>
		</ToolPanel>
	);
};
