"use client";

import { useMemo, useState } from "react";
import { calculateBmi } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const BmiCalculator = () => {
	const [units, setUnits] = useState<"metric" | "imperial">("metric");
	const [weight, setWeight] = useState("");
	const [height, setHeight] = useState("");
	const calculation = useMemo(() => {
		if (!isCalculatorNumberComplete(weight) || !isCalculatorNumberComplete(height)) return null;
		try {
			return { ...calculateBmi(Number(weight), Number(height), units), error: "" };
		} catch (error) {
			return { bmi: 0, category: "" as const, error: error instanceof Error ? error.message : "Could not calculate BMI." };
		}
	}, [weight, height, units]);

	const changeUnits = (nextUnits: "metric" | "imperial") => {
		setUnits(nextUnits);
		setHeight("");
		setWeight("");
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<label className="block max-w-[360px] text-xs font-semibold text-[#3c3d37]" htmlFor="bmi-units">Units
				<select className="mt-2 block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="bmi-units" value={units} onChange={(event) => changeUnits(event.target.value as "metric" | "imperial")}>
					<option value="metric">Metric (cm, kg)</option>
					<option value="imperial">Imperial (in, lb)</option>
				</select>
			</label>
			<div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
				<CalculatorNumberField id="bmi-height" label={units === "metric" ? "Height (cm)" : "Height (inches)"} value={height} onChange={setHeight} placeholder={units === "metric" ? "170" : "67"} />
				<CalculatorNumberField id="bmi-weight" label={units === "metric" ? "Weight (kg)" : "Weight (lb)"} value={weight} onChange={setWeight} placeholder={units === "metric" ? "65" : "145"} />
			</div>
			{calculation?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{calculation.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="BMI result" aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Body mass index</p>
				<p className="mb-1 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.bmi) : "—"}</p>
				<p className="m-0 text-sm text-[#60635b]">{calculation && !calculation.error ? calculation.category : "Enter height and weight to see a result."}</p>
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">BMI is a general screening measure for adults, not a diagnosis. It may not be appropriate for children, pregnancy, athletes, or every body type. Speak with a qualified health professional for personal advice.</p>
		</div>
	);
};

export default BmiCalculator;
