"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	canvasToBlob,
	describeBytes,
	FileDownloadLink,
	FileField,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { GRID_PRESETS, gridSummary, splitGrid, tileFileName, type Tile } from "@/features/image-tools/split-utils";
import { createZip } from "@/features/image-tools/zip-utils";
import { stripExtension, type Size } from "@/features/image-tools/crop-utils";

type TileResult = { fileName: string; blob: Blob; tile: Tile };

/** Object URLs for a list of blobs, revoked when the list changes. */
const useTileUrls = (results: TileResult[]) => {
	const urls = useMemo(() => results.map((result) => URL.createObjectURL(result.blob)), [results]);
	useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
	return urls;
};

export const SplitTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [columns, setColumns] = useState(3);
	const [rows, setRows] = useState(3);
	const [gap, setGap] = useState(0);
	const [results, setResults] = useState<TileResult[]>([]);
	const [archive, setArchive] = useState<{ blob: Blob; fileName: string } | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const zipUrl = useObjectUrl(archive?.blob ?? null);
	const tileUrls = useTileUrls(results);

	const tiles = (() => {
		try {
			return size.width > 0 ? splitGrid(size, { columns, rows, gap }) : [];
		} catch {
			return [];
		}
	})();
	const summary = gridSummary(tiles);

	const chooseFile = async (nextFile: File | null) => {
		setResults([]);
		setArchive(null);
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

	const split = async () => {
		if (!file || !previewUrl || tiles.length === 0) return;
		setBusy(true);
		setError("");
		setResults([]);
		setArchive(null);
		try {
			const image = await loadImage(previewUrl);
			const produced: TileResult[] = [];
			for (const tile of tiles) {
				const canvas = document.createElement("canvas");
				canvas.width = tile.width;
				canvas.height = tile.height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Canvas image processing is not available in this browser.");
				context.drawImage(image, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
				const blob = await canvasToBlob(canvas, "image/png");
				produced.push({ fileName: tileFileName(file.name, tile, "png"), blob, tile });
			}
			setResults(produced);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not split this image.");
		} finally {
			setBusy(false);
		}
	};

	const zipTiles = async () => {
		if (!file || results.length === 0) return;
		setBusy(true);
		setError("");
		try {
			const entries = await Promise.all(
				results.map(async (result) => ({ name: result.fileName, data: new Uint8Array(await result.blob.arrayBuffer()) })),
			);
			const zip = await createZip(entries, { compress: false });
			setArchive({ blob: new Blob([zip.slice().buffer], { type: "application/zip" }), fileName: `${stripExtension(file.name)}-tiles.zip` });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the archive.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Cut one image into a grid of tiles — a carousel, a puzzle, or a wall of squares — and download them together."
				id="split-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="split-preset">
					Grid preset
					<select
						className={selectClassName}
						id="split-preset"
						onChange={(event) => {
							const preset = GRID_PRESETS.find((option) => option.id === event.target.value);
							if (!preset) return;
							setColumns(preset.columns);
							setRows(preset.rows);
							setResults([]);
						}}
						value={GRID_PRESETS.find((preset) => preset.columns === columns && preset.rows === rows)?.id ?? "custom"}
					>
						{GRID_PRESETS.map((preset) => (
							<option key={preset.id} value={preset.id}>
								{preset.label}
							</option>
						))}
						<option value="custom">Custom grid</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="split-gap">
					Gap between tiles ({gap} px)
					<input
						className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
						id="split-gap"
						max={80}
						min={0}
						onChange={(event) => {
							setGap(Number(event.target.value));
							setResults([]);
						}}
						type="range"
						value={gap}
					/>
				</label>
				<label className={labelClassName} htmlFor="split-columns">
					Columns
					<input
						className={fieldClassName}
						id="split-columns"
						max={12}
						min={1}
						onChange={(event) => {
							setColumns(Math.max(1, Math.min(12, Number(event.target.value) || 1)));
							setResults([]);
						}}
						type="number"
						value={columns}
					/>
				</label>
				<label className={labelClassName} htmlFor="split-rows">
					Rows
					<input
						className={fieldClassName}
						id="split-rows"
						max={12}
						min={1}
						onChange={(event) => {
							setRows(Math.max(1, Math.min(12, Number(event.target.value) || 1)));
							setResults([]);
						}}
						type="number"
						value={rows}
					/>
				</label>
			</div>
			{file && previewUrl ? (
				<div className="relative border border-line bg-[#f8f7f3] p-1">
					<Image alt={`Grid preview: ${file.name}`} className="block h-auto w-full" height={size.height} src={previewUrl} unoptimized width={size.width} />
					{tiles.map((tile) => (
						<span
							className="pointer-events-none absolute border border-[#b64b31]/70"
							key={tile.index}
							style={{
								left: `calc(${(tile.x / size.width) * 100}% + 4px)`,
								top: `calc(${(tile.y / size.height) * 100}% + 4px)`,
								width: `calc(${(tile.width / size.width) * 100}% - 8px)`,
								height: `calc(${(tile.height / size.height) * 100}% - 8px)`,
							}}
						>
							<span className="absolute left-1 top-1 bg-forest px-1 font-mono text-[9px] text-white">{tile.index}</span>
						</span>
					))}
				</div>
			) : null}
			{tiles.length > 0 ? (
				<StatGrid
					items={[
						{ label: "Tiles", value: `${summary.count} (${columns} × ${rows})` },
						{ label: "Largest tile", value: `${summary.widest} × ${summary.tallest} px` },
						{ label: "Source", value: `${size.width} × ${size.height} px` },
						{ label: "Gap", value: gap === 0 ? "None" : `${gap} px` },
					]}
				/>
			) : null}
			<button className={primaryButtonClassName} disabled={!file || busy || tiles.length === 0} onClick={() => void split()} type="button">
				{busy ? "Splitting…" : "Split image"}
			</button>
			<ErrorNote message={error} />
			{results.length > 0 ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">
							Tiles <span className="font-normal text-muted">({results.length})</span>
						</h2>
						<button
							className="inline-flex min-h-9 cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							disabled={busy}
							onClick={() => void zipTiles()}
							type="button"
						>
							Download all as ZIP
						</button>
					</div>
					{archive && zipUrl ? (
						<div className="flex flex-wrap items-center gap-3">
							<FileDownloadLink fileName={archive.fileName} label={`Download ${archive.fileName}`} url={zipUrl} />
							<span className="text-[11px] text-muted">{describeBytes(archive.blob.size)}</span>
						</div>
					) : null}
					<div className="grid grid-cols-3 gap-2 max-[620px]:grid-cols-2">
						{results.map((result, index) => (
							<figure className="m-0 flex flex-col gap-1.5 border border-line bg-[#fbfaf7] p-2" key={result.fileName}>
								<Image alt={`Tile ${result.tile.index}`} className="block h-auto w-full border border-line" height={result.tile.height} src={tileUrls[index]} unoptimized width={result.tile.width} />
								<figcaption className="flex flex-col gap-1 text-[10px] text-muted">
									<span className="font-mono text-[#5f6259]">
										{result.tile.width} × {result.tile.height} px
									</span>
									<FileDownloadLink fileName={result.fileName} label="Download" url={tileUrls[index]} />
								</figcaption>
							</figure>
						))}
					</div>
				</section>
			) : null}
			<p className={hintClassName}>
				Tiles are cut at their exact pixel boundaries and exported as lossless PNG, so a 3 × 1 carousel can be posted left to right without seams. Leftover
				pixels from uneven divisions go to the first tiles rather than being dropped.
			</p>
		</ToolPanel>
	);
};
