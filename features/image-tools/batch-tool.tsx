"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { ACCEPTED_IMAGE_TYPES, canvasToBlob, describeBytes, FileDownloadLink, isSupportedImage, loadImage, MAX_IMAGE_BYTES, MultiFileField } from "@/features/image-tools/image-file-shared";
import { BATCH_TARGETS, batchZipName, describeBatch, fitWithin, MAX_BATCH_BYTES, MAX_BATCH_FILES, planBatch, targetFor } from "@/features/image-tools/batch-utils";
import { createZip } from "@/features/image-tools/zip-utils";

type Converted = { fileName: string; blob: Blob; width: number; height: number; source: string };

const useConvertedUrls = (results: Converted[]) => {
	const urls = useMemo(() => results.map((result) => URL.createObjectURL(result.blob)), [results]);
	useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
	return urls;
};

export const BatchTool = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [formatId, setFormatId] = useState(BATCH_TARGETS[0].id);
	const [maxWidth, setMaxWidth] = useState(1600);
	const [quality, setQuality] = useState(80);
	const [results, setResults] = useState<Converted[]>([]);
	const [archive, setArchive] = useState<{ blob: Blob; fileName: string } | null>(null);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const urls = useConvertedUrls(results);
	const zipUrl = useMemo(() => (archive ? URL.createObjectURL(archive.blob) : ""), [archive]);
	useEffect(() => () => {
		if (zipUrl) URL.revokeObjectURL(zipUrl);
	}, [zipUrl]);

	const target = targetFor(formatId);
	const queue = describeBatch(files);
	const convertedBytes = results.reduce((sum, result) => sum + result.blob.size, 0);

	const chooseFiles = (next: File[]) => {
		setResults([]);
		setArchive(null);
		setError("");
		const images = next.filter(isSupportedImage);
		if (images.length !== next.length) setError("Some files were skipped because they are not PNG, JPEG, WebP, GIF, AVIF, or BMP images.");
		if (images.length > MAX_BATCH_FILES) {
			setError(`Convert up to ${MAX_BATCH_FILES} images at a time — the rest were skipped.`);
			setFiles(images.slice(0, MAX_BATCH_FILES));
			return;
		}
		const tooBig = images.find((file) => file.size > MAX_IMAGE_BYTES);
		if (tooBig) {
			setError(`${tooBig.name} is larger than 25 MB, so nothing was queued.`);
			setFiles([]);
			return;
		}
		if (images.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES) {
			setError("That batch is over 120 MB in total. Convert it in smaller groups.");
			setFiles([]);
			return;
		}
		setFiles(images);
	};

	const convert = async () => {
		if (files.length === 0) return;
		setBusy(true);
		setError("");
		setResults([]);
		setArchive(null);
		try {
			const plan = planBatch(files, target);
			const produced: Converted[] = [];
			for (const [index, item] of plan.entries()) {
				setProgress(`Converting ${index + 1} of ${plan.length}…`);
				const objectUrl = URL.createObjectURL(item.file);
				try {
					const image = await loadImage(objectUrl);
					const size = fitWithin({ width: image.naturalWidth, height: image.naturalHeight }, maxWidth);
					const canvas = document.createElement("canvas");
					canvas.width = size.width;
					canvas.height = size.height;
					const context = canvas.getContext("2d");
					if (!context) throw new Error("Canvas image processing is not available in this browser.");
					if (item.target.lossy) {
						context.fillStyle = "#ffffff";
						context.fillRect(0, 0, canvas.width, canvas.height);
					}
					context.drawImage(image, 0, 0, size.width, size.height);
					const blob = await canvasToBlob(canvas, item.target.id, item.target.lossy ? quality / 100 : undefined);
					produced.push({ fileName: item.outputName, blob, width: size.width, height: size.height, source: item.file.name });
				} finally {
					URL.revokeObjectURL(objectUrl);
				}
			}
			setResults(produced);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not convert this batch.");
		} finally {
			setProgress("");
			setBusy(false);
		}
	};

	const zipAll = async () => {
		if (results.length === 0) return;
		setBusy(true);
		setError("");
		try {
			const entries = await Promise.all(results.map(async (result) => ({ name: result.fileName, data: new Uint8Array(await result.blob.arrayBuffer()) })));
			const zip = await createZip(entries, { compress: false });
			setArchive({ blob: new Blob([zip.slice().buffer], { type: "application/zip" }), fileName: batchZipName(target) });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the archive.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<MultiFileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint={`Pick up to ${MAX_BATCH_FILES} images. Each one is converted here, in this tab — nothing is uploaded.`}
				id="batch-files"
				label="Images to convert"
				onFiles={chooseFiles}
			/>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="batch-format">
					Convert to
					<select className={selectClassName} id="batch-format" onChange={(event) => setFormatId(event.target.value)} value={formatId}>
						{BATCH_TARGETS.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="batch-width">
					Maximum width (px)
					<input
						className={fieldClassName}
						id="batch-width"
						max={8192}
						min={16}
						onChange={(event) => setMaxWidth(Math.max(16, Number(event.target.value) || 16))}
						type="number"
						value={maxWidth}
					/>
				</label>
				<label className={labelClassName} htmlFor="batch-quality">
					Quality ({quality}%)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!target.lossy}
						id="batch-quality"
						max={100}
						min={40}
						onChange={(event) => setQuality(Number(event.target.value))}
						step={5}
						type="range"
						value={quality}
					/>
				</label>
			</div>
			{files.length > 0 ? (
				<>
					<StatGrid
						items={[
							{ label: "Queued", value: `${queue.count} image${queue.count === 1 ? "" : "s"}` },
							{ label: "Total size", value: describeBytes(queue.bytes) },
							{ label: "Target", value: target.label },
							{ label: "Max width", value: `${maxWidth} px` },
						]}
					/>
					<ul className="m-0 flex list-none flex-col gap-1 border border-line bg-[#f8f7f3] p-3 text-[11px]">
						{files.map((file, index) => (
							<li className="flex flex-wrap items-baseline justify-between gap-2" key={`${file.name}-${index}`}>
								<span className="break-all font-medium text-ink">{file.name}</span>
								<span className="font-mono text-[#5f6259]">{describeBytes(file.size)}</span>
							</li>
						))}
					</ul>
				</>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				<button className={primaryButtonClassName} disabled={files.length === 0 || busy} onClick={() => void convert()} type="button">
					{busy ? progress || "Working…" : `Convert ${files.length > 0 ? files.length : ""} image${files.length === 1 ? "" : "s"}`.replace("  ", " ").trim()}
				</button>
				{results.length > 0 ? (
					<button
						className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
						disabled={busy}
						onClick={() => void zipAll()}
						type="button"
					>
						Download all as ZIP
					</button>
				) : null}
				{busy && progress ? (
					<span className="text-[11px] text-muted" role="status">
						{progress}
					</span>
				) : null}
			</div>
			<ErrorNote message={error} />
			{results.length > 0 ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">
							Converted <span className="font-normal text-muted">({results.length})</span>
						</h2>
						<span className="text-[11px] text-muted">{describeBytes(convertedBytes)} in total</span>
					</div>
					{archive && zipUrl ? <FileDownloadLink fileName={archive.fileName} label={`Download ${archive.fileName}`} url={zipUrl} /> : null}
					<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
						{results.map((result, index) => (
							<li className="flex flex-wrap items-center justify-between gap-2 border border-line bg-[#fbfaf7] px-3 py-2 text-[11px]" key={result.fileName}>
								<span className="break-all font-medium text-ink">{result.fileName}</span>
								<span className="font-mono text-[#5f6259]">
									{result.width} × {result.height} px · {describeBytes(result.blob.size)}
								</span>
								<FileDownloadLink fileName={result.fileName} label="Download" url={urls[index]} />
							</li>
						))}
					</ul>
				</section>
			) : null}
			<p className={hintClassName}>
				Images are only ever scaled down, so nothing is stretched. JPEG and WebP re-encode at the quality you choose; PNG keeps transparency but is much
				larger for photos.
			</p>
		</ToolPanel>
	);
};
