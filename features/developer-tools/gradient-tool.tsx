"use client";

import { useMemo, useState } from "react";
import { buildGradient, presetGradients, toPreviewStyle, type GradientOptions, type GradientStop, type GradientType } from "@/features/developer-tools/gradient-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, ToolPanel } from "@/features/developer-tools/tool-ui";

const defaultOptions: GradientOptions = presetGradients[0].options;

export const GradientTool = () => {
	const [options, setOptions] = useState<GradientOptions>(defaultOptions);
	const [swatches, setSwatches] = useState(6);
	const result = useMemo(() => {
		try {
			return { css: buildGradient(options), error: "" };
		} catch (error) {
			return { css: "", error: error instanceof Error ? error.message : "Could not build this gradient." };
		}
	}, [options]);
	const palette = useMemo(() => {
		const stops = [...options.stops].sort((left, right) => left.position - right.position);
		return Array.from({ length: swatches }, (_, index) => stops[Math.min(stops.length - 1, Math.round((index / Math.max(1, swatches - 1)) * (stops.length - 1)))].color);
	}, [options.stops, swatches]);
	const updateStop = (index: number, patch: Partial<GradientStop>) =>
		setOptions((current) => ({ ...current, stops: current.stops.map((stop, position) => (position === index ? { ...stop, ...patch } : stop)) }));
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="gradient-type">
					Gradient type
					<select className={selectClassName} id="gradient-type" value={options.type} onChange={(event) => setOptions((current) => ({ ...current, type: event.target.value as GradientType }))}>
						<option value="linear">Linear</option>
						<option value="radial">Radial</option>
						<option value="conic">Conic</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="gradient-angle">
					{options.type === "conic" ? "Start angle" : "Angle"} ({options.angle}°)
					<input
						className={fieldClassName}
						id="gradient-angle"
						max={360}
						min={0}
						onChange={(event) => setOptions((current) => ({ ...current, angle: Number(event.target.value) }))}
						type="range"
						value={options.angle}
					/>
				</label>
				<div className="flex flex-col justify-end gap-2">
					<CheckboxField
						checked={options.repeating}
						id="gradient-repeating"
						label="Repeating"
						onChange={(repeating) => setOptions((current) => ({ ...current, repeating }))}
					/>
					{options.type === "radial" && (
						<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="gradient-shape">
							<span className="sr-only">Radial shape</span>
							<select className={selectClassName} id="gradient-shape" value={options.shape} onChange={(event) => setOptions((current) => ({ ...current, shape: event.target.value as "circle" | "ellipse" }))}>
								<option value="circle">Circle</option>
								<option value="ellipse">Ellipse</option>
							</select>
						</label>
					)}
				</div>
			</div>
			<div className="h-40 w-full border border-line" style={{ backgroundImage: result.css ? toPreviewStyle(result.css) : "none" }} />
			<section className="flex flex-col gap-3">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="m-0 text-sm font-semibold">Colour stops</h2>
					<button
						className="cursor-pointer border border-line bg-[#fbfaf7] px-2 py-1 text-[11px] hover:border-accent"
						onClick={() => setOptions((current) => ({ ...current, stops: [...current.stops, { color: "#ffffff", position: 100 }] }))}
						type="button"
					>
						Add stop
					</button>
				</div>
				{options.stops.map((stop, index) => (
					<div className="flex flex-wrap items-center gap-3" key={index}>
						<input aria-label={`Stop ${index + 1} colour`} onChange={(event) => updateStop(index, { color: event.target.value })} type="color" value={/^#[0-9a-f]{6}$/iu.test(stop.color) ? stop.color : "#ffffff"} />
						<input
							aria-label={`Stop ${index + 1} colour value`}
							className={`${fieldClassName} w-32 font-mono`}
							onChange={(event) => updateStop(index, { color: event.target.value })}
							value={stop.color}
						/>
						<input
							aria-label={`Stop ${index + 1} position`}
							className={`${fieldClassName} w-20`}
							max={100}
							min={0}
							onChange={(event) => updateStop(index, { position: Number(event.target.value) })}
							type="number"
							value={stop.position}
						/>
						<span className="text-xs text-[#7a7c72]">%</span>
						<button
							className="cursor-pointer border border-line bg-surface px-2 py-1 text-[11px] text-[#8a3028] hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
							disabled={options.stops.length <= 2}
							onClick={() => setOptions((current) => ({ ...current, stops: current.stops.filter((_, position) => position !== index) }))}
							type="button"
						>
							Remove
						</button>
					</div>
				))}
			</section>
			<div className="flex flex-wrap items-center gap-2">
				{presetGradients.map((preset) => (
					<button className="cursor-pointer border border-line bg-[#fbfaf7] px-3 py-1 text-[11px] hover:border-accent" key={preset.label} onClick={() => setOptions(preset.options)} type="button">
						{preset.label}
					</button>
				))}
			</div>
			<ErrorNote message={result.error} />
			{result.css && <ResultBlock title="CSS" value={result.css} rows={4} fileName="gradient.css" />}
			{result.css && (
				<section className="flex flex-col gap-2">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="m-0 text-sm font-semibold">Palette sample</h2>
						<label className="flex items-center gap-2 text-xs text-[#3c3d37]" htmlFor="gradient-swatches">
							Swatches
							<input
								className={`${fieldClassName} w-16`}
								id="gradient-swatches"
								max={12}
								min={2}
								onChange={(event) => setSwatches(Number(event.target.value))}
								type="number"
								value={swatches}
							/>
						</label>
					</div>
					<div className="flex h-10 w-full overflow-hidden border border-line">
						{palette.map((color, index) => (
							<span className="flex-1" key={index} style={{ backgroundColor: color }} title={color} />
						))}
					</div>
					<p className="m-0 font-mono text-[11px] text-[#5b5e55]">{palette.join("  ")}</p>
				</section>
			)}
			<p className={hintClassName}>Copy the CSS into any stylesheet. The palette row samples the stops evenly and is handy for picking accent colours.</p>
		</ToolPanel>
	);
};
