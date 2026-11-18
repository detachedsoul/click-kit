"use client";

import { useMemo, useState } from "react";
import { commonRatios, coverBox, fitWithin, scaleByHeight, scaleByWidth, scaleTable, simplifyRatio } from "@/features/calculators/aspect-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

type Mode = "simplify" | "scale" | "fit";

const numberField = (id: string, label: string, value: number, onChange: (value: number) => void, min = 1) => (
	<label className={labelClassName} htmlFor={id}>
		{label}
		<input className={fieldClassName} id={id} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={Number.isFinite(value) ? value : ""} />
	</label>
);

export default function AspectCalculator() {
	const [mode, setMode] = useState<Mode>("simplify");
	const [width, setWidth] = useState(1920);
	const [height, setHeight] = useState(1080);
	const [ratioWidth, setRatioWidth] = useState(16);
	const [ratioHeight, setRatioHeight] = useState(9);
	const [scaleWidth, setScaleWidth] = useState(1280);
	const [scaleHeight, setScaleHeight] = useState(720);
	const [boxWidth, setBoxWidth] = useState(1200);
	const [boxHeight, setBoxHeight] = useState(630);
	const result = useMemo(() => {
		try {
			if (mode === "simplify") {
				const ratio = simplifyRatio(width, height);
				return {
					lines: [
						`Original      ${width} × ${height}`,
						`Ratio         ${ratio.label}${ratio.width === ratio.width ? "" : ""}`,
						`Decimal       ${ratio.decimal}`,
						`Closest preset ${ratio.closest.label}${ratio.exact ? " (exact match)" : ` (off by ${ratio.difference})`}`,
						`Landscape     ${width >= height ? "yes" : "no"}`,
						"",
						`At widths     ${scaleTable(ratio.width, ratio.height).join(" · ")}`,
					],
					stats: [
						{ label: "Ratio", value: ratio.label },
						{ label: "Decimal", value: String(ratio.decimal) },
						{ label: "Preset", value: ratio.closest.label },
						{ label: "Pixels", value: `${width} × ${height}` },
					],
				};
			}
			if (mode === "scale") {
				const fromWidth = scaleByWidth(scaleWidth, ratioWidth, ratioHeight);
				const fromHeight = scaleByHeight(scaleHeight, ratioWidth, ratioHeight);
				return {
					lines: [
						`Ratio          ${ratioWidth}:${ratioHeight}`,
						`Width ${scaleWidth}      → height ${fromWidth.height}`,
						`Height ${scaleHeight}     → width ${fromHeight.width}`,
						"",
						`Common sizes   ${scaleTable(ratioWidth, ratioHeight).join(" · ")}`,
					],
					stats: [
						{ label: "Ratio", value: `${ratioWidth}:${ratioHeight}` },
						{ label: `At width ${scaleWidth}`, value: `${fromWidth.width} × ${fromWidth.height}` },
						{ label: `At height ${scaleHeight}`, value: `${fromHeight.width} × ${fromHeight.height}` },
						{ label: "Decimal", value: String(Math.round((ratioWidth / ratioHeight) * 1000) / 1000) },
					],
				};
			}
			const fitted = fitWithin(boxWidth, boxHeight, ratioWidth, ratioHeight);
			const covering = coverBox(boxWidth, boxHeight, ratioWidth, ratioHeight);
			return {
				lines: [
					`Box            ${boxWidth} × ${boxHeight}`,
					`Ratio          ${ratioWidth}:${ratioHeight}`,
					`Contain (fit)  ${fitted.width} × ${fitted.height} — whole image is visible`,
					`Cover (crop)   ${covering.width} × ${covering.height} — fills the box, edges are cropped`,
				],
				stats: [
					{ label: "Fit", value: `${fitted.width} × ${fitted.height}` },
					{ label: "Cover", value: `${covering.width} × ${covering.height}` },
					{ label: "Box", value: `${boxWidth} × ${boxHeight}` },
					{ label: "Ratio", value: `${ratioWidth}:${ratioHeight}` },
				],
			};
		} catch (error) {
			return { lines: [], stats: [], error: error instanceof Error ? error.message : "Could not compute this ratio." };
		}
	}, [mode, width, height, ratioWidth, ratioHeight, scaleWidth, scaleHeight, boxWidth, boxHeight]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label className={labelClassName} htmlFor="aspect-mode">
					Mode
					<select className={selectClassName} id="aspect-mode" onChange={(event) => setMode(event.target.value as Mode)} value={mode}>
						<option value="simplify">Simplify a size</option>
						<option value="scale">Scale from a ratio</option>
						<option value="fit">Fit inside a box</option>
					</select>
				</label>
				{mode === "simplify" ? (
					<>
						{numberField("aspect-width", "Width (px)", width, setWidth)}
						{numberField("aspect-height", "Height (px)", height, setHeight)}
					</>
				) : (
					<>
						{numberField("aspect-ratio-width", "Ratio width", ratioWidth, setRatioWidth)}
						{numberField("aspect-ratio-height", "Ratio height", ratioHeight, setRatioHeight)}
					</>
				)}
				{mode === "scale" && (
					<>
						{numberField("aspect-scale-width", "Source width", scaleWidth, setScaleWidth)}
						{numberField("aspect-scale-height", "Source height", scaleHeight, setScaleHeight)}
					</>
				)}
				{mode === "fit" && (
					<>
						{numberField("aspect-box-width", "Box width", boxWidth, setBoxWidth)}
						{numberField("aspect-box-height", "Box height", boxHeight, setBoxHeight)}
					</>
				)}
				<label className={labelClassName} htmlFor="aspect-preset">
					Presets
					<select
						className={selectClassName}
						id="aspect-preset"
						onChange={(event) => {
							const preset = commonRatios.find((item) => item.label === event.target.value);
							if (!preset) return;
							setRatioWidth(preset.width);
							setRatioHeight(preset.height);
							if (mode === "simplify") {
								setWidth(preset.width * 120);
								setHeight(preset.height * 120);
							}
						}}
						value=""
					>
						<option value="">Choose a ratio…</option>
						{commonRatios.map((preset) => (
							<option key={preset.label} value={preset.label}>
								{preset.label}
							</option>
						))}
					</select>
				</label>
			</div>
			<ErrorNote message={"error" in result ? String(result.error) : ""} />
			{result.lines.length > 0 && (
				<>
					<StatGrid items={result.stats} />
					<ResultBlock title="Result" value={result.lines.join("\n")} rows={8} fileName="aspect-ratio.txt" />
				</>
			)}
			<p className={hintClassName}>
				Contain keeps the whole image visible inside the box; cover fills the box and crops the overflow. Sizes are rounded to whole pixels.
			</p>
		</ToolPanel>
	);
}
