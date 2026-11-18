"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { canvasToBlob, describeBytes, FileDownloadLink, loadImage, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { clampDimension, placeholderFileName, placeholderSvg, PRESET_SIZES } from "@/features/image-tools/placeholder-utils";
import { svgDataUrl } from "@/features/image-tools/svg-raster-utils";

type PngResult = { blob: Blob; fileName: string };

export const PlaceholderTool = () => {
	const [presetId, setPresetId] = useState("social");
	const [width, setWidth] = useState("1200");
	const [height, setHeight] = useState("630");
	const [background, setBackground] = useState("#f3f1e9");
	const [color, setColor] = useState("#263b34");
	const [label, setLabel] = useState("Image coming soon");
	const [png, setPng] = useState<PngResult | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const pngUrl = useObjectUrl(png?.blob ?? null);

	const options = useMemo(
		() => ({ width: Number(width) || 1, height: Number(height) || 1, background, color, label }),
		[width, height, background, color, label],
	);
	const svg = useMemo(() => placeholderSvg(options), [options]);
	const svgBlob = useMemo(() => new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), [svg]);
	const svgUrl = useObjectUrl(svgBlob);

	const applyPreset = (id: string) => {
		setPresetId(id);
		const preset = PRESET_SIZES.find((entry) => entry.id === id);
		if (preset) {
			setWidth(String(preset.width));
			setHeight(String(preset.height));
		}
	};

	const makePng = async () => {
		setBusy(true);
		setError("");
		setPng(null);
		try {
			const target = { width: clampDimension(options.width), height: clampDimension(options.height) };
			const image = await loadImage(svgDataUrl(svg));
			const canvas = document.createElement("canvas");
			canvas.width = target.width;
			canvas.height = target.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			context.drawImage(image, 0, 0, target.width, target.height);
			const blob = await canvasToBlob(canvas, "image/png");
			setPng({ blob, fileName: placeholderFileName({ ...options, ...target }, "png") });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not render this placeholder.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="placeholder-preset">
					Size preset
					<select className={selectClassName} id="placeholder-preset" onChange={(event) => applyPreset(event.target.value)} value={presetId}>
						{PRESET_SIZES.map((preset) => (
							<option key={preset.id} value={preset.id}>
								{preset.label}
							</option>
						))}
						<option value="custom">Custom</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="placeholder-label">
					Caption
					<input className={fieldClassName} id="placeholder-label" onChange={(event) => setLabel(event.target.value)} value={label} />
				</label>
				<label className={labelClassName} htmlFor="placeholder-width">
					Width (px)
					<input
						className={fieldClassName}
						id="placeholder-width"
						max={8192}
						min={1}
						onChange={(event) => {
							setWidth(event.target.value);
							setPresetId("custom");
						}}
						type="number"
						value={width}
					/>
				</label>
				<label className={labelClassName} htmlFor="placeholder-height">
					Height (px)
					<input
						className={fieldClassName}
						id="placeholder-height"
						max={8192}
						min={1}
						onChange={(event) => {
							setHeight(event.target.value);
							setPresetId("custom");
						}}
						type="number"
						value={height}
					/>
				</label>
				<label className={labelClassName} htmlFor="placeholder-background">
					Background
					<input
						className={`${fieldClassName} h-11 cursor-pointer p-1`}
						id="placeholder-background"
						onChange={(event) => setBackground(event.target.value)}
						type="color"
						value={background}
					/>
				</label>
				<label className={labelClassName} htmlFor="placeholder-colour">
					Text colour
					<input
						className={`${fieldClassName} h-11 cursor-pointer p-1`}
						id="placeholder-colour"
						onChange={(event) => setColor(event.target.value)}
						type="color"
						value={color}
					/>
				</label>
			</div>
			<div className="border border-line bg-[#f8f7f3] p-3">
				<Image
					alt={`Placeholder preview: ${label || `${options.width} by ${options.height}`}`}
					className="max-h-64 w-auto max-w-full object-contain"
					height={clampDimension(options.height)}
					src={svgDataUrl(svg)}
					unoptimized
					width={clampDimension(options.width)}
				/>
			</div>
			<StatGrid
				items={[
					{ label: "Dimensions", value: `${clampDimension(options.width)} × ${clampDimension(options.height)} px` },
					{ label: "Caption", value: label.trim() || `${clampDimension(options.width)} × ${clampDimension(options.height)}` },
					{ label: "SVG size", value: `${(svg.length / 1024).toFixed(1)} kB` },
					{ label: "PNG", value: png ? describeBytes(png.blob.size) : "Not generated" },
				]}
			/>
			<div className="flex flex-wrap gap-2">
				{svgUrl ? <FileDownloadLink fileName={placeholderFileName(options, "svg")} label="Download SVG" url={svgUrl} /> : null}
				<button
					className="min-h-10 cursor-pointer border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
					disabled={busy}
					onClick={() => void makePng()}
					type="button"
				>
					{busy ? "Rendering…" : "Generate PNG"}
				</button>
				{png && pngUrl ? <FileDownloadLink fileName={png.fileName} label="Download PNG" url={pngUrl} /> : null}
			</div>
			<ErrorNote message={error} />
			<ResultBlock fileName={placeholderFileName(options, "svg")} title="Placeholder SVG" value={svg} rows={8} />
			<p className={hintClassName}>
				SVG placeholders stay sharp at any size and weigh almost nothing; PNG is there for tools that cannot read vectors. Both are generated here, with no
				request to a placeholder service.
			</p>
		</ToolPanel>
	);
};
