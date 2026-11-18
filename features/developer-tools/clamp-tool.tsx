"use client";

import { useMemo, useState } from "react";
import { buildClamp, clampPresets, sizeAtViewport, type ClampOptions } from "@/features/developer-tools/clamp-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const numberInput = (id: string, label: string, value: number, onChange: (value: number) => void, step = 1) => (
	<label className={labelClassName} htmlFor={id}>
		{label}
		<input className={fieldClassName} id={id} min={0} onChange={(event) => onChange(Number(event.target.value))} step={step} type="number" value={value} />
	</label>
);

export const ClampTool = () => {
	const [options, setOptions] = useState<ClampOptions>(clampPresets[1].options);
	const [preview, setPreview] = useState("Fluid type scales with the viewport");
	const result = useMemo(() => {
		try {
			return { clamp: buildClamp(options), error: "" };
		} catch (error) {
			return { clamp: null, error: error instanceof Error ? error.message : "Could not build this clamp()." };
		}
	}, [options]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{numberInput("clamp-min", "Min font size (px)", options.minSize, (minSize) => setOptions((current) => ({ ...current, minSize })), 0.5)}
				{numberInput("clamp-max", "Max font size (px)", options.maxSize, (maxSize) => setOptions((current) => ({ ...current, maxSize })), 0.5)}
				{numberInput("clamp-root", "Root font size (px)", options.rootFontSize, (rootFontSize) => setOptions((current) => ({ ...current, rootFontSize })), 0.5)}
				{numberInput("clamp-min-vw", "Min viewport (px)", options.minViewport, (minViewport) => setOptions((current) => ({ ...current, minViewport })), 10)}
				{numberInput("clamp-max-vw", "Max viewport (px)", options.maxViewport, (maxViewport) => setOptions((current) => ({ ...current, maxViewport })), 10)}
				<span className="flex flex-col justify-end gap-2">
					<CheckboxField
						checked={options.useRem}
						id="clamp-rem"
						label="Express values in rem"
						onChange={(useRem) => setOptions((current) => ({ ...current, useRem }))}
					/>
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{clampPresets.map((preset) => (
					<button
						className="cursor-pointer border border-line bg-[#fbfaf7] px-3 py-1 text-[11px] hover:border-accent"
						key={preset.label}
						onClick={() => setOptions(preset.options)}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>
			<label className={labelClassName} htmlFor="clamp-preview-text">
				Preview text
				<input className={fieldClassName} id="clamp-preview-text" onChange={(event) => setPreview(event.target.value)} value={preview} />
			</label>
			<ErrorNote message={result.error} />
			{result.clamp && (
				<>
					<div className="border border-line bg-[#fbfaf7] px-5 py-6">
						<p className="m-0 text-ink" style={{ fontSize: result.clamp.css }}>
							{preview || "Fluid type"}
						</p>
					</div>
					<StatGrid
						items={[
							{ label: "Slope", value: String(result.clamp.slope) },
							{ label: "Intercept", value: `${result.clamp.intercept}px` },
							{ label: "Size at 768px", value: `${Math.round(sizeAtViewport(options, 768) * 100) / 100}px` },
							{ label: "Size at 1440px", value: `${Math.round(sizeAtViewport(options, 1440) * 100) / 100}px` },
						]}
					/>
					<ResultBlock
						title="CSS"
						value={[
							result.clamp.customProperty,
							`font-size: ${result.clamp.css};`,
							`/* ${options.minSize}px at ${options.minViewport}px → ${options.maxSize}px at ${options.maxViewport}px */`,
							`/* ${result.clamp.minRem}rem → ${result.clamp.maxRem}rem (root ${options.rootFontSize}px) */`,
						].join("\n")}
						rows={6}
						fileName="fluid-type.css"
					/>
				</>
			)}
			<p className={hintClassName}>
				The preferred value is a straight line through the two size/viewport points, clamped at both ends, so text never gets smaller than the
				minimum or larger than the maximum.
			</p>
		</ToolPanel>
	);
};
