"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import {
	clampOpacity,
	clampShadow,
	describeShadow,
	isHex,
	layerToCss,
	presetLayers,
	shadowCss,
	shadowRule,
	shadowTailwind,
	SHADOW_PRESETS,
	type ShadowLayer,
} from "@/features/developer-tools/shadow-utils";

let nextLayer = 2;

const SLIDERS: { key: "x" | "y" | "blur" | "spread"; label: string; min: number; max: number }[] = [
	{ key: "x", label: "Horizontal offset", min: -100, max: 100 },
	{ key: "y", label: "Vertical offset", min: -100, max: 100 },
	{ key: "blur", label: "Blur radius", min: 0, max: 160 },
	{ key: "spread", label: "Spread", min: -60, max: 60 },
];

export const ShadowTool = () => {
	const [layers, setLayers] = useState<ShadowLayer[]>(() => presetLayers(SHADOW_PRESETS[0]));
	const [selector, setSelector] = useState(".card");
	const error = layers.some((layer) => !isHex(layer.color)) ? "Shadow colour must be a hex value such as #252820." : "";

	const update = (id: string, patch: Partial<ShadowLayer>) => setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
	const addLayer = () => {
		setLayers((current) => [
			...current,
			{ id: `layer-${nextLayer++}`, x: 0, y: 4, blur: 12, spread: 0, color: "#252820", opacity: 20, inset: false },
		]);
	};

	let css = "";
	let tailwind = "";
	try {
		css = shadowCss(layers);
		tailwind = shadowTailwind(layers);
	} catch {
		css = "";
	}
	const rule = css ? shadowRule(layers, selector.trim() || ".card") : "";

	return (
		<ToolPanel>
			<div className="flex flex-wrap gap-2">
				{SHADOW_PRESETS.map((preset) => (
					<button
						className="cursor-pointer border border-line bg-[#fbfaf7] px-2.5 py-1.5 text-[11px] hover:border-accent hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						key={preset.id}
						onClick={() => setLayers(presetLayers(preset))}
						type="button"
					>
						{preset.label}
					</button>
				))}
			</div>

			<div className="grid place-items-center border border-line bg-[#f8f7f3] p-8">
				<div className="grid h-24 w-40 place-items-center border border-line bg-surface text-[11px] text-muted" style={{ boxShadow: css || undefined }}>
					Preview
				</div>
			</div>

			<div className="flex flex-col gap-4">
				{layers.map((layer, index) => (
					<fieldset className="border border-line p-3" key={layer.id}>
						<legend className="px-1 font-mono text-[10px] uppercase tracking-[.08em] text-[#5f6259]">Layer {index + 1}</legend>
						<div className="grid gap-3 sm:grid-cols-2">
							{SLIDERS.map((slider) => (
								<label className={labelClassName} htmlFor={`${layer.id}-${slider.key}`} key={slider.key}>
									{slider.label} ({layer[slider.key]}px)
									<input
										className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
										id={`${layer.id}-${slider.key}`}
										max={slider.max}
										min={slider.min}
										onChange={(event) => update(layer.id, { [slider.key]: clampShadow(Number(event.target.value), slider.min, slider.max) })}
										type="range"
										value={layer[slider.key]}
									/>
								</label>
							))}
							<label className={labelClassName} htmlFor={`${layer.id}-color`}>
								Colour
								<input
									className={`${fieldClassName} h-11 cursor-pointer p-1`}
									id={`${layer.id}-color`}
									onChange={(event) => update(layer.id, { color: event.target.value })}
									type="color"
									value={isHex(layer.color) ? layer.color : "#252820"}
								/>
							</label>
							<label className={labelClassName} htmlFor={`${layer.id}-opacity`}>
								Opacity ({layer.opacity}%)
								<input
									className="mt-2 block h-11 w-full cursor-pointer accent-[#263b34]"
									id={`${layer.id}-opacity`}
									max={100}
									min={0}
									onChange={(event) => update(layer.id, { opacity: clampOpacity(Number(event.target.value)) })}
									step={2}
									type="range"
									value={layer.opacity}
								/>
							</label>
						</div>
						<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
							<CheckboxField
								checked={layer.inset}
								hint="Draws the shadow inside the box, like a pressed button."
								id={`${layer.id}-inset`}
								label="Inset"
								onChange={(inset) => update(layer.id, { inset })}
							/>
							{layers.length > 1 ? (
								<button
									aria-label={`Remove layer ${index + 1}`}
									className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-line bg-surface px-3 text-[11px] text-[#873b28] hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}
									type="button"
								>
									<Trash2 aria-hidden="true" size={12} /> Remove
								</button>
							) : null}
						</div>
						<p className="m-0 mt-2 break-all font-mono text-[10px] text-[#5f6259]">{layerToCss(layer)}</p>
					</fieldset>
				))}
				<button
					className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 border border-line bg-surface px-4 text-xs text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					onClick={addLayer}
					type="button"
				>
					<Plus aria-hidden="true" size={13} /> Add another layer
				</button>
			</div>

			<ErrorNote message={error} />
			<StatGrid
				items={[
					{ label: "Layers", value: describeShadow(layers) },
					{ label: "CSS length", value: `${css.length} chars` },
					{ label: "Inset", value: layers.some((layer) => layer.inset) ? "yes" : "no" },
				]}
			/>
			{css ? (
				<>
					<div className="flex flex-wrap items-end gap-3">
						<label className={`${labelClassName} min-w-[180px] flex-1`} htmlFor="shadow-selector">
							CSS selector
							<input className={fieldClassName} id="shadow-selector" onChange={(event) => setSelector(event.target.value)} value={selector} />
						</label>
						<CopyTextButton text={rule} />
					</div>
					<ResultBlock fileName="shadow.css" rows={6} title="box-shadow" value={`${rule}\n\n/* Tailwind */\n${tailwind}`} />
					<div className="flex flex-wrap items-center gap-2">
						<span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
							<Copy aria-hidden="true" size={12} /> {tailwind}
						</span>
					</div>
				</>
			) : null}
			<p className={hintClassName}>
				Negative spread shrinks a shadow and negative offsets push it up or left. Stacking two or three soft layers reads more natural than one heavy
				shadow, which is why the presets start there.
			</p>
		</ToolPanel>
	);
};

export default ShadowTool;
