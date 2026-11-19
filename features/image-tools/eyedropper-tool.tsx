"use client";

import { useCallback, useRef, useState } from "react";
import { ErrorNote, hintClassName, labelClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import {
	ACCEPTED_IMAGE_TYPES,
	describeBytes,
	FileField,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
} from "@/features/image-tools/image-file-shared";
import { type Size } from "@/features/image-tools/crop-utils";
import { pointerToImage } from "@/features/image-tools/redact-utils";
import {
	addSwatch,
	formatHsl,
	formatRgb,
	hexToRgb,
	MAX_SWATCHES,
	samplePixel,
	swatchesToCss,
	swatchesToHexList,
	textOn,
	toHex,
	type Rgb,
	type Swatch,
} from "@/features/image-tools/eyedropper-utils";

type CopyFormat = "hex" | "rgb" | "hsl" | "css";

export const EyedropperTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [size, setSize] = useState<Size>({ width: 0, height: 0 });
	const [current, setCurrent] = useState<(Swatch & { rgb: Rgb }) | null>(null);
	const [swatches, setSwatches] = useState<Swatch[]>([]);
	const [format, setFormat] = useState<CopyFormat>("hex");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [imageData, setImageData] = useState<ImageData | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const chooseFile = async (nextFile: File | null) => {
		setCurrent(null);
		setSwatches([]);
		setImageData(null);
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
			const canvas = canvasRef.current;
			if (!canvas) throw new Error("The preview canvas is not ready yet — choose the image again.");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d", { willReadFrequently: true });
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
			const data = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
			setImageData(data);
			setSize({ width: image.naturalWidth, height: image.naturalHeight });
			setFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This image could not be read.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const pick = useCallback(
		(clientX: number, clientY: number) => {
			const canvas = canvasRef.current;
			if (!canvas || !imageData || size.width < 1) return;
			const rect = canvas.getBoundingClientRect();
			const point = pointerToImage({ x: clientX, y: clientY }, rect, size);
			const pixel = samplePixel(imageData.data, size.width, point.x, point.y);
			const rgb = { r: pixel.r, g: pixel.g, b: pixel.b };
			const swatch = { hex: toHex(rgb), x: Math.round(point.x), y: Math.round(point.y) };
			setCurrent({ ...swatch, rgb });
		},
		[imageData, size],
	);

	const record = () => {
		if (!current) return;
		setSwatches((list) => addSwatch(list, { hex: current.hex, x: current.x, y: current.y }));
	};

	const copyValue = current ? (format === "hex" ? current.hex : format === "rgb" ? `rgb(${formatRgb(current.rgb)})` : format === "hsl" ? formatHsl(current.rgb) : `--${current.hex.replace("#", "")}: ${current.hex};`) : "";
	const output = format === "css" ? swatchesToCss(swatches) : format === "hex" ? swatchesToHexList(swatches) : swatches.map((swatch) => (format === "rgb" ? `rgb(${formatRgb(hexToRgb(swatch.hex))})` : formatHsl(hexToRgb(swatch.hex)))).join("\n");

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				disabled={busy}
				hint="Click anywhere on the image to read the exact pixel colour. Drag to keep sampling as you move. Nothing is uploaded."
				id="eyedropper-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			<canvas
				aria-label="Image to sample colours from"
				className={`h-auto w-full touch-none border border-line bg-[#f8f7f3] ${file ? "cursor-crosshair" : "hidden"}`}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					pick(event.clientX, event.clientY);
				}}
				onPointerMove={(event) => {
					if (event.buttons === 1) pick(event.clientX, event.clientY);
				}}
				ref={canvasRef}
				role="img"
			/>
			{busy ? (
				<p className="m-0 text-xs text-muted" role="status">
					Reading pixels…
				</p>
			) : null}
			{file ? (
				<p className="m-0 text-xs text-muted">
					{file.name} · {size.width} × {size.height} px · {describeBytes(file.size)}
				</p>
			) : null}
			{current ? (
				<div className="flex flex-wrap items-center gap-4 border border-line bg-[#fbfaf7] p-3">
					<span aria-hidden="true" className="size-16 shrink-0 border border-line" style={{ backgroundColor: current.hex }} />
					<div className="flex min-w-0 flex-col gap-1">
						<strong className="font-mono text-sm uppercase text-ink">{current.hex}</strong>
						<span className="text-[11px] text-muted">
							rgb({formatRgb(current.rgb)}) · {formatHsl(current.rgb)} · at {current.x}, {current.y}
						</span>
					</div>
					<div className="ml-auto flex flex-wrap items-center gap-2">
						<CopyTextButton text={copyValue} />
						<button
							className="min-h-9 cursor-pointer border border-forest bg-forest px-3 text-[11px] text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={record}
							type="button"
						>
							Save swatch
						</button>
					</div>
				</div>
			) : file ? (
				<p className={labelClassName}>Click the image to pick a colour.</p>
			) : null}
			<SegmentedControl
				label="Copy colours as"
				onChange={setFormat}
				options={[
					{ id: "hex", label: "Hex" },
					{ id: "rgb", label: "RGB" },
					{ id: "hsl", label: "HSL" },
					{ id: "css", label: "CSS variables" },
				]}
				value={format}
			/>
			{swatches.length > 0 ? (
				<>
					<StatGrid
						items={[
							{ label: "Saved swatches", value: `${swatches.length} of ${MAX_SWATCHES}` },
							{ label: "Newest", value: swatches[0].hex },
							{ label: "Image", value: `${size.width} × ${size.height} px` },
							{ label: "Copy format", value: format.toUpperCase() },
						]}
					/>
					<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
						{swatches.map((swatch) => (
							<li className="flex items-center gap-2 border border-line bg-surface p-1.5" key={`${swatch.hex}-${swatch.x}-${swatch.y}`}>
								<span aria-hidden="true" className="grid size-8 place-items-center font-mono text-[9px]" style={{ backgroundColor: swatch.hex, color: textOn(hexToRgb(swatch.hex)) }}>
									{swatch.hex.slice(1, 3)}
								</span>
								<span className="font-mono text-[11px] uppercase text-ink">{swatch.hex}</span>
								<CopyTextButton text={swatch.hex} />
								<button
									aria-label={`Remove ${swatch.hex}`}
									className="cursor-pointer px-1 text-[11px] text-[#873b28] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									onClick={() => setSwatches((list) => list.filter((item) => item !== swatch))}
									type="button"
								>
									Remove
								</button>
							</li>
						))}
					</ul>
					<ResultBlock fileName={format === "css" ? "picked-colours.css" : "picked-colours.txt"} rows={7} title="Picked colours" value={output} />
				</>
			) : null}
			<ErrorNote message={error} />
			<p className={hintClassName}>
				Colours are read from the decoded pixels, so what you copy is exactly what the file contains — useful when a screenshot looks flat but is full of
				slightly different shades. Saving the same colour twice keeps just one swatch.
			</p>
		</ToolPanel>
	);
};
