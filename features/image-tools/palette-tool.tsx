"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	describeBytes,
	FileField,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { extractPalette, paletteToCssVariables, paletteToTailwind, rgbToHsl, type PaletteColor } from "@/features/image-tools/palette-utils";

const SAMPLE_EDGE = 240;

const samplePixels = (image: HTMLImageElement) => {
	const scale = Math.min(1, SAMPLE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) throw new Error("Canvas image processing is not available in this browser.");
	context.drawImage(image, 0, 0, canvas.width, canvas.height);
	return context.getImageData(0, 0, canvas.width, canvas.height).data;
};

export const PaletteTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null);
	const [count, setCount] = useState("6");
	const [palette, setPalette] = useState<PaletteColor[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);

	const chooseFile = async (nextFile: File | null) => {
		setError("");
		setPalette([]);
		setPixels(null);
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
		const objectUrl = URL.createObjectURL(nextFile);
		setBusy(true);
		try {
			const image = await loadImage(objectUrl);
			const data = samplePixels(image);
			setFile(nextFile);
			setPixels(data);
			setPalette(extractPalette(data, Number(count)));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not read the colours in this image.");
		} finally {
			URL.revokeObjectURL(objectUrl);
			setBusy(false);
		}
	};

	const changeCount = (value: string) => {
		setCount(value);
		if (pixels) setPalette(extractPalette(pixels, Number(value)));
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				hint="The image is sampled on this device at a reduced size, which is plenty for colour work."
				id="palette-file"
				label="Image file"
				onFile={(next) => void chooseFile(next)}
			/>
			{file && previewUrl ? (
				<div className="flex flex-wrap items-center gap-4 border border-line bg-[#f8f7f3] p-3">
					<Image alt={`Source image: ${file.name}`} className="max-h-32 max-w-40 object-contain" height={128} src={previewUrl} unoptimized width={160} />
					<p className="m-0 text-xs leading-relaxed text-muted">
						{file.name}
						<br />
						{describeBytes(file.size)} · sampled at {SAMPLE_EDGE}px
					</p>
				</div>
			) : null}
			<div className="max-w-[240px]">
				<label className={labelClassName} htmlFor="palette-count">
					Colours to extract
				</label>
				<select className={selectClassName} id="palette-count" onChange={(event) => changeCount(event.target.value)} value={count}>
					{[3, 4, 5, 6, 8, 10, 12].map((value) => (
						<option key={value} value={String(value)}>
							{value} colours
						</option>
					))}
				</select>
			</div>
			{busy ? (
				<p className="m-0 text-xs text-muted" role="status">
					Sampling colours…
				</p>
			) : null}
			<ErrorNote message={error} />
			{palette.length > 0 ? (
				<>
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
						{palette.map((color) => {
							const hsl = rgbToHsl(color.rgb);
							return (
								<div className="flex min-w-0 flex-col gap-1 border border-line bg-[#fbfaf7]" key={color.hex}>
									<span aria-hidden="true" className="block h-16 w-full" style={{ backgroundColor: color.hex }} />
									<div className="flex items-center justify-between gap-2 px-2 pb-2">
										<div className="flex min-w-0 flex-col">
											<span className="font-mono text-[11px] uppercase text-ink">{color.hex}</span>
											<span className="text-[10px] text-muted">
												{Math.round(color.share * 100)}% · hsl({hsl.h} {hsl.s}% {hsl.l}%)
											</span>
										</div>
										<CopyTextButton text={color.hex} />
									</div>
								</div>
							);
						})}
					</div>
					<StatGrid
						items={[
							{ label: "Colours", value: String(palette.length) },
							{ label: "Dominant", value: palette[0]?.hex ?? "—" },
							{ label: "Coverage", value: `${Math.round((palette[0]?.share ?? 0) * 100)}%` },
							{ label: "Sample", value: `${SAMPLE_EDGE}px edge` },
						]}
					/>
					<ResultBlock fileName="palette.css" title="CSS variables" value={paletteToCssVariables(palette)} rows={8} />
					<ResultBlock fileName="tailwind.palette.json" title="Tailwind theme" value={paletteToTailwind(palette)} rows={10} />
				</>
			) : null}
			<p className={hintClassName}>
				Colours are grouped with median-cut quantisation, the same idea behind classic image palettes: split the pixels along their widest colour
				range, then average each group. Percentages are the share of visible pixels.
			</p>
		</ToolPanel>
	);
};
