"use client";

import { SelectField } from "@/components/select-field";

import { useMemo, useState } from "react";
import { calculateGeometry, type GeometryShape } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const shapeOptions: { id: GeometryShape; label: string }[] = [
	{ id: "circle", label: "Circle" },
	{ id: "rectangle", label: "Rectangle" },
	{ id: "triangle", label: "Triangle (three sides)" },
];

const GeometryCalculator = () => {
	const [shape, setShape] = useState<GeometryShape>("circle");
	const [first, setFirst] = useState("5");
	const [second, setSecond] = useState("4");
	const [third, setThird] = useState("3");
	const labels = shape === "circle" ? ["Radius"] : shape === "rectangle" ? ["Length", "Width"] : ["Side a", "Side b", "Side c"];
	const result = useMemo(() => {
		const values = shape === "circle" ? [first] : shape === "rectangle" ? [first, second] : [first, second, third];
		if (!values.every(isCalculatorNumberComplete)) return null;
		try {
			return { ...calculateGeometry(shape, Number(first), Number(second), Number(third)), error: "" };
		} catch (error) {
			return { area: 0, perimeter: 0, error: error instanceof Error ? error.message : "Could not calculate this shape." };
		}
	}, [shape, first, second, third]);

	return <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		<label className="block max-w-[420px] text-xs font-semibold text-[#3c3d37]" htmlFor="geometry-shape">Shape
			<SelectField containerClassName="relative block w-full" className="cursor-pointer" id="geometry-shape" value={shape} onChange={(event) => setShape(event.target.value as GeometryShape)}>
				{shapeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
			</SelectField>
		</label>
		<div className="grid grid-cols-3 gap-4 max-[620px]:grid-cols-1">
			<CalculatorNumberField id="geometry-first" label={labels[0]} value={first} onChange={setFirst} />
			{shape !== "circle" && <CalculatorNumberField id="geometry-second" label={labels[1]} value={second} onChange={setSecond} />}
			{shape === "triangle" && <CalculatorNumberField id="geometry-third" label={labels[2]} value={third} onChange={setThird} />}
		</div>
		{result?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p>}
		<section className="grid grid-cols-2 gap-4 border-l-2 border-accent bg-[#f5f3eb] p-5 max-[520px]:grid-cols-1" aria-label="Geometry result" aria-live="polite">
			<div><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Area</p><p className="mb-0 mt-2 break-words font-serif text-[clamp(28px,5vw,42px)] leading-none tracking-[-.03em] text-forest">{result && !result.error ? formatCalculatorDisplay(result.area) : "—"}</p></div>
			<div><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Perimeter / circumference</p><p className="mb-0 mt-2 break-words font-serif text-[clamp(28px,5vw,42px)] leading-none tracking-[-.03em] text-forest">{result && !result.error ? formatCalculatorDisplay(result.perimeter) : "—"}</p></div>
		</section>
		<p className="m-0 text-[11px] leading-relaxed text-muted">Enter dimensions in the same unit. Area is in squared units; perimeter is in the original unit. Triangle area uses Heron’s formula and requires valid side lengths.</p>
	</div>;
};

export default GeometryCalculator;
