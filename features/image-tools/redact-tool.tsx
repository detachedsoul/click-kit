"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	canvasToBlob,
	FileDownloadLink,
	FileField,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { outputExtension, type Size } from "@/features/image-tools/crop-utils";
import {
	clampStrength,
	coveragePercent,
	describeRegions,
	isUsableRegion,
	normaliseRegion,
	DEFAULT_STRENGTH,
	MAX_STRENGTH,
	MIN_STRENGTH,
	pointerToImage,
	redactedFileName,
	regionPercentStyle,
	regionStrength,
	REGION_MODES,
	type Point,
	type Region,
	type RegionMode,
} from "@/features/image-tools/redact-utils";
import { drawRedactions } from "@/features/image-tools/redact-draw";

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const RedactTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [regions, setRegions] = useState<Region[]>([]);
	const [mode, setMode] = useState<RegionMode>("solid");
	const [strength, setStrength] = useState(DEFAULT_STRENGTH);
	const [draft, setDraft] = useState<{ from: Point; to: Point } | null>(null);
	const [format, setFormat] = useState("image/png");
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const nextId = useRef(1);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const previewUrl = useObjectUrl(file);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const preview = draft && size.width > 0 ? normaliseRegion(draft.from, draft.to, size) : null;

	// Repaint the preview whenever an area or its strength changes, so the slider has a visible effect.
	useEffect(() => {
		if (!previewUrl || size.width < 1) return;
		let cancelled = false;
		const paint = async () => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			let image: HTMLImageElement;
			try {
				image = await loadImage(previewUrl);
			} catch {
				// A picture the browser will not decode leaves the preview blank rather than broken.
				return;
			}
			if (cancelled) return;
			canvas.width = size.width;
			canvas.height = size.height;
			const context = canvas.getContext("2d");
			if (!context) return;
			try {
				context.drawImage(image, 0, 0, size.width, size.height);
				drawRedactions({ context, image, regions });
			} catch {
				// Some canvases refuse to paint an image that has not fully decoded; try again on the next change.
			}
		};
		void paint();
		return () => {
			cancelled = true;
		};
	}, [previewUrl, regions, size]);

	const chooseFile = async (nextFile: File | null) => {
		setResult(null);
		setError("");
		setFile(null);
		setRegions([]);
		setDraft(null);
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

	const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): Point => {
		const rect = wrapperRef.current?.getBoundingClientRect();
		if (!rect) return { x: 0, y: 0 };
		return pointerToImage({ x: event.clientX, y: event.clientY }, rect, size);
	};

	const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!file) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const start = pointFromEvent(event);
		setDraft({ from: start, to: start });
	};

	const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!draft) return;
		setDraft({ from: draft.from, to: pointFromEvent(event) });
	};

	const endDrag = () => {
		if (!draft) return;
		const region = normaliseRegion(draft.from, draft.to, size);
		setDraft(null);
		if (!isUsableRegion(region)) return;
		setRegions((current) => [...current, { ...region, id: `region-${nextId.current++}`, mode, strength }]);
		setResult(null);
	};

	const apply = async () => {
		if (!file || !previewUrl || regions.length === 0) return;
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
			context.drawImage(image, 0, 0, size.width, size.height);
			drawRedactions({ context, image, regions });
			const blob = await canvasToBlob(canvas, format, 0.92);
			setResult({ blob, fileName: redactedFileName(file.name, outputExtension(format)), width: size.width, height: size.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not redact this image.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Drag over anything private — an address, a name, an account number — then export a copy with it covered. Everything stays on this device."
				id="redact-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{file && previewUrl ? (
				<>
					<div className="flex flex-wrap items-end gap-4">
						<label className={labelClassName} htmlFor="redact-mode">
							Mark areas as
							<select className={selectClassName} id="redact-mode" onChange={(event) => setMode(event.target.value as RegionMode)} value={mode}>
								{REGION_MODES.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<label className={labelClassName} htmlFor="redact-strength">
							Strength for new areas ({strength}%)
							<input
								className="mt-2 block h-11 w-32 cursor-pointer accent-[#263b34]"
								id="redact-strength"
								max={MAX_STRENGTH}
								min={MIN_STRENGTH}
								onChange={(event) => setStrength(clampStrength(Number(event.target.value)))}
								step={5}
								type="range"
								value={strength}
							/>
						</label>
					</div>
					<p className={hintClassName}>
						{REGION_MODES.find((option) => option.id === mode)?.hint} Higher strength hides more — each area keeps its own setting, and the preview
						updates as you drag.
					</p>
					<div
						className="relative touch-none select-none border border-line bg-[#f8f7f3] p-1"
						onPointerCancel={endDrag}
						onPointerDown={startDrag}
						onPointerMove={moveDrag}
						onPointerUp={endDrag}
						ref={wrapperRef}
						role="application"
						aria-label="Drawing area: drag across the image to mark areas to hide"
					>
						<canvas
							aria-label={`Redaction preview: ${file.name}`}
							className="pointer-events-none block h-auto w-full"
							ref={canvasRef}
							role="img"
						/>
						{regions.map((region, index) => (
							<span
								className={`pointer-events-none absolute border-2 ${region.mode === "solid" ? "border-[#b64b31] bg-black/70" : region.mode === "pixelate" ? "border-[#873b28] bg-[#873b28]/25" : "border-[#263b34] bg-[#263b34]/20"}`}
								key={region.id}
								style={regionPercentStyle(region, size)}
							>
								<span className="absolute -top-5 left-0 bg-forest px-1 font-mono text-[9px] text-white">{index + 1}</span>
							</span>
						))}
						{preview && isUsableRegion(preview) ? (
							<span
								className="pointer-events-none absolute border-2 border-dashed border-white bg-black/25"
								style={regionPercentStyle({ ...preview, id: "draft", mode }, size)}
							/>
						) : null}
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<span className="text-xs text-ink">{describeRegions(regions, size)}</span>
						{regions.length > 0 ? (
							<button
								className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-line bg-surface px-3 text-[11px] text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								onClick={() => {
									setRegions([]);
									setResult(null);
								}}
								type="button"
							>
								<Trash2 aria-hidden="true" size={13} /> Clear all
							</button>
						) : null}
					</div>
					{regions.length > 0 ? (
						<ol className="m-0 flex list-none flex-col gap-1.5 p-0">
							{regions.map((region, index) => (
								<li className="flex flex-wrap items-center gap-2 border border-line bg-[#fbfaf7] px-3 py-1.5 text-[11px]" key={region.id}>
									<span className="font-mono text-[#5f6259]">#{index + 1}</span>
									<span className="text-ink">
										{Math.round(region.x)}, {Math.round(region.y)} · {Math.round(region.width)} × {Math.round(region.height)} px
									</span>
									{region.mode !== "solid" ? (
										<label className="ml-auto flex items-center gap-1.5 text-[#5f6259]" htmlFor={`redact-strength-${region.id}`}>
											<span className="sr-only">{`Strength for area ${index + 1}`}</span>
											<input
												aria-label={`Strength for area ${index + 1}`}
												className="h-8 w-24 cursor-pointer accent-[#263b34]"
												id={`redact-strength-${region.id}`}
												max={MAX_STRENGTH}
												min={MIN_STRENGTH}
												onChange={(event) =>
													setRegions((current) => current.map((item) => (item.id === region.id ? { ...item, strength: clampStrength(Number(event.target.value)) } : item)))
												}
												step={5}
												type="range"
												value={regionStrength(region)}
											/>
											<span className="font-mono text-[10px] text-[#5f6259]">{regionStrength(region)}%</span>
										</label>
									) : null}
									<label className={`${region.mode !== "solid" ? "" : "ml-auto "}flex items-center gap-1.5 text-[#5f6259]`} htmlFor={`redact-mode-${region.id}`}>
										<span className="sr-only">Mode for area {index + 1}</span>
										<select
											className="select-input mt-0 h-8 text-[11px]"
											id={`redact-mode-${region.id}`}
											onChange={(event) =>
												setRegions((current) => current.map((item) => (item.id === region.id ? { ...item, mode: event.target.value as RegionMode } : item)))
											}
											value={region.mode}
										>
											{REGION_MODES.map((option) => (
												<option key={option.id} value={option.id}>
													{option.label}
												</option>
											))}
										</select>
									</label>
									<button
										aria-label={`Remove area ${index + 1}`}
										className="cursor-pointer border border-line bg-surface px-2 py-1 text-[#873b28] hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
										onClick={() => {
											setRegions((current) => current.filter((item) => item.id !== region.id));
											setResult(null);
										}}
										type="button"
									>
										Remove
									</button>
								</li>
							))}
						</ol>
					) : null}
					<div className="grid gap-4 sm:grid-cols-2">
						<label className={labelClassName} htmlFor="redact-format">
							Output format
							<select className={selectClassName} id="redact-format" onChange={(event) => setFormat(event.target.value)} value={format}>
								<option value="image/png">PNG (lossless)</option>
								<option value="image/jpeg">JPEG (smaller)</option>
								<option value="image/webp">WebP (smallest)</option>
							</select>
						</label>
						<span className="flex flex-col justify-end">
							<StatGrid items={[{ label: "Covered", value: `${coveragePercent(regions, size)}%` }, { label: "Areas", value: String(regions.length) }]} />
						</span>
					</div>
					<button className={primaryButtonClassName} disabled={busy || regions.length === 0} onClick={() => void apply()} type="button">
						{busy ? "Redacting…" : "Redact and download"}
					</button>
				</>
			) : null}
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<>
					<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 className="m-0 text-sm font-semibold">Redacted image</h2>
							<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
						</div>
						<Image
							alt={`Redacted preview: ${result.fileName}`}
							className="max-h-72 w-auto max-w-full border border-line object-contain"
							height={result.height}
							src={resultUrl}
							unoptimized
							width={result.width}
						/>
					</section>
					<ResultBlock
						fileName="redaction-list.txt"
						rows={5}
						title="Redacted areas"
						value={regions.map((region, index) => `#${index + 1} ${region.mode}${region.mode === "solid" ? "" : ` (${regionStrength(region)}%)`} at ${region.x},${region.y} — ${region.width}×${region.height} px`).join("\n")}
					/>
				</>
			) : null}
			<p className={hintClassName}>
				Export re-encodes the pixels, so the hidden content is gone from the new file — not just covered in the preview. Check the downloaded copy before
				you share it, especially when you used blur.
			</p>
		</ToolPanel>
	);
};
