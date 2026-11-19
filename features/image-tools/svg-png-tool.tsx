"use client";

import { useMemo, useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { describeBytes, FileDownloadLink, ImagePreview, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { parseSvgBox, rasterPlan, svgDataUrl, svgRasterWarnings } from "@/features/image-tools/svg-raster-utils";

const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="26" fill="#263b34"/>
  <circle cx="86" cy="34" r="14" fill="#e08a63"/>
  <path d="M38 92 L38 34 L50 34 L50 62 L74 62 L74 34 L86 34 L86 92 L74 92 L74 74 L50 74 L50 92 Z" fill="#fffdf8"/>
</svg>`;

type Result = { blob: Blob; fileName: string; width: number; height: number };

export const SvgPngTool = () => {
	const [markup, setMarkup] = useState(sample);
	const [targetWidth, setTargetWidth] = useState("512");
	const [background, setBackground] = useState("transparent");
	const [customColor, setCustomColor] = useState("#ffffff");
	const [result, setResult] = useState<Result | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const box = useMemo(() => parseSvgBox(markup), [markup]);
	const plan = useMemo(() => rasterPlan(box, Number(targetWidth) || 0), [box, targetWidth]);
	const warnings = useMemo(() => svgRasterWarnings(markup), [markup]);

	const convert = async () => {
		setError("");
		setResult(null);
		if (!/<svg[\s>]/iu.test(markup)) {
			setError("Paste an SVG document that contains an <svg> element.");
			return;
		}
		setBusy(true);
		try {
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const element = new window.Image();
				element.onload = () => resolve(element);
				element.onerror = () => reject(new Error("The browser could not render this SVG. Check that the markup is valid."));
				element.src = svgDataUrl(markup);
			});
			const canvas = document.createElement("canvas");
			canvas.width = plan.width;
			canvas.height = plan.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas image processing is not available in this browser.");
			if (background !== "transparent") {
				context.fillStyle = background === "custom" ? customColor : "#ffffff";
				context.fillRect(0, 0, plan.width, plan.height);
			}
			context.drawImage(image, 0, 0, plan.width, plan.height);
			const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("The browser could not encode this PNG."))), "image/png"));
			setResult({ blob, fileName: "vector.png", width: plan.width, height: plan.height });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not rasterise this SVG.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<TextAreaField
				hint="Paste SVG markup. External images and fonts will not load; inline paths and shapes export perfectly."
				id="svg-png-input"
				label="SVG markup"
				onChange={(value) => {
					setMarkup(value);
					setResult(null);
					setError("");
				}}
				placeholder="<svg …</svg>"
				rows={10}
				value={markup}
			/>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="svg-png-width">
					Output width (px)
					<input
						className={fieldClassName}
						id="svg-png-width"
						max={8192}
						min={1}
						onChange={(event) => setTargetWidth(event.target.value)}
						type="number"
						value={targetWidth}
					/>
				</label>
				<label className={labelClassName} htmlFor="svg-png-background">
					Background
					<select className={selectClassName} id="svg-png-background" onChange={(event) => setBackground(event.target.value)} value={background}>
						<option value="transparent">Transparent</option>
						<option value="white">White</option>
						<option value="custom">Custom colour</option>
					</select>
				</label>
				{background === "custom" ? (
					<label className={labelClassName} htmlFor="svg-png-colour">
						Background colour
						<input className={`${fieldClassName} h-11 cursor-pointer p-1`} id="svg-png-colour" onChange={(event) => setCustomColor(event.target.value)} type="color" value={customColor} />
					</label>
				) : null}
			</div>
			<StatGrid
				items={[
					{ label: "Export size", value: `${plan.width} × ${plan.height} px` },
					{ label: "Scale", value: `${plan.scale.toFixed(2)}×` },
					{ label: "Source size", value: box.width && box.height ? `${box.width} × ${box.height}` : box.viewBox ? `${box.viewBox.width} × ${box.viewBox.height} (viewBox)` : "300 × 150 (default)" },
					{ label: "Background", value: background === "custom" ? customColor : background === "white" ? "White" : "Transparent" },
				]}
			/>
			{warnings.length > 0 ? (
				<ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[11px] leading-relaxed text-[#6f5416]">
					{warnings.map((warning) => (
						<li key={warning}>{warning}</li>
					))}
				</ul>
			) : null}
			<button
				className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={busy}
				onClick={() => void convert()}
				type="button"
			>
				{busy ? "Rendering…" : "Convert to PNG"}
			</button>
			<ErrorNote message={error} />
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">PNG preview</h2>
						<FileDownloadLink fileName={result.fileName} label={`Download ${result.fileName}`} url={resultUrl} />
					</div>
					<ImagePreview alt="Rendered PNG preview" caption={`${result.width} × ${result.height} px · ${describeBytes(result.blob.size)}`} height={result.height} url={resultUrl} width={result.width} />
				</section>
			) : null}
			<ResultBlock fileName="vector.svg" title="SVG file" value={markup} rows={6} />
			<p className={hintClassName}>
				SVGs scale without loss, so pick the largest width you need and let CSS do the rest. The export keeps transparency unless you choose a
				background.
			</p>
		</ToolPanel>
	);
};
