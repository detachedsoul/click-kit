"use client";

import { useMemo, useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { buildShades, readableTextOn, shadeFileName, shadeVariables, tailwindShades } from "@/features/developer-tools/shades-utils";

type Syntax = "css" | "tailwind";

const PRESET_COLOURS = ["#3f6b4a", "#b4552d", "#2f5d8a", "#7a4b8f", "#c08b2c", "#33403a"];

export const ShadesTool = () => {
	const [colour, setColour] = useState("#3f6b4a");
	const [strength, setStrength] = useState(90);
	const [syntax, setSyntax] = useState<Syntax>("css");

	const result = useMemo(() => {
		try {
			const shades = buildShades(colour, strength / 100);
			return { shades, error: "", output: syntax === "css" ? shadeVariables(shades) : tailwindShades(shades) };
		} catch (caught) {
			return { shades: [], error: caught instanceof Error ? caught.message : "Could not build this ramp.", output: "" };
		}
	}, [colour, strength, syntax]);

	const base = result.shades.find((shade) => shade.label === "500");

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="shades-hex">
					Base colour (hex)
					<input className={fieldClassName} id="shades-hex" onChange={(event) => setColour(event.target.value)} value={colour} />
				</label>
				<label className={labelClassName} htmlFor="shades-picker">
					Pick a colour
					<input
						className={`${fieldClassName} h-11 cursor-pointer p-1`}
						id="shades-picker"
						onChange={(event) => setColour(event.target.value)}
						type="color"
						value={/^#[0-9a-f]{6}$/iu.test(colour) ? colour : "#3f6b4a"}
					/>
				</label>
			</div>
			<div className="flex flex-wrap gap-2">
				{PRESET_COLOURS.map((preset) => (
					<button
						aria-label={`Use ${preset}`}
						className={`size-8 cursor-pointer rounded-[2px] border transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${colour.toLowerCase() === preset ? "border-forest" : "border-line"}`}
						key={preset}
						onClick={() => setColour(preset)}
						style={{ backgroundColor: preset }}
						type="button"
					/>
				))}
			</div>
			<label className={labelClassName} htmlFor="shades-strength">
				Ramp strength ({strength}%)
				<input
					className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
					id="shades-strength"
					max={100}
					min={20}
					onChange={(event) => setStrength(Number(event.target.value))}
					step={5}
					type="range"
					value={strength}
				/>
			</label>
			{result.shades.length > 0 ? (
				<>
					<div className="grid grid-cols-5 border-l border-t border-line max-[520px]:grid-cols-2">
						{result.shades.map((shade) => (
							<div className="flex flex-col justify-end border-b border-r border-line p-2.5 pt-10" key={shade.label} style={{ backgroundColor: shade.hex }}>
								<span className="font-mono text-[10px] font-semibold uppercase" style={{ color: readableTextOn(shade.hex) }}>
									{shade.label}
								</span>
								<span className="font-mono text-[11px]" style={{ color: readableTextOn(shade.hex) }}>
									{shade.hex}
								</span>
							</div>
						))}
					</div>
					<StatGrid
						items={[
							{ label: "Base (500)", value: base ? base.hex : colour },
							{ label: "Lightest (50)", value: result.shades[0].hex },
							{ label: "Darkest (900)", value: result.shades[result.shades.length - 1].hex },
							{ label: "Steps", value: String(result.shades.length) },
						]}
					/>
					<SegmentedControl
						label="Output syntax"
						onChange={setSyntax}
						options={[
							{ id: "css", label: "CSS variables" },
							{ id: "tailwind", label: "Tailwind theme" },
						]}
						value={syntax}
					/>
				</>
			) : null}
			<ErrorNote message={result.error} />
			<ResultBlock
				fileName={syntax === "css" ? shadeFileName(colour, "css") : shadeFileName(colour, "js")}
				rows={12}
				title={syntax === "css" ? "CSS variables" : "Tailwind colour scale"}
				value={result.output}
			/>
			<p className={hintClassName}>
				A ten-step ramp from 50 to 900, with your colour exactly at 500 — the same shape Tailwind uses, so it drops into utility classes or plain CSS
				variables. Keep the 500 value as the source when you regenerate.
				{base ? ` The base swatch reads best with ${readableTextOn(base.hex) === "#ffffff" ? "white" : "dark"} text (${readableTextOn(base.hex)}).` : ""}
			</p>
		</ToolPanel>
	);
};
