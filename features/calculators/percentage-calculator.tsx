"use client";

import { SelectField } from "@/components/select-field";

import { useMemo, useState } from "react";
import { calculatePercentage, type PercentageMode } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const modeOptions: { id: PercentageMode; label: string }[] = [
	{ id: "of", label: "What is a percentage of a number?" },
	{ id: "change", label: "Percentage change between two numbers" },
	{ id: "increase", label: "Increase a number by a percentage" },
	{ id: "decrease", label: "Decrease a number by a percentage" },
];

const PercentageCalculator = () => {
	const [mode, setMode] = useState<PercentageMode>("of");
	const [firstValue, setFirstValue] = useState("");
	const [secondValue, setSecondValue] = useState("");
	const calculation = useMemo(() => {
		if (!isCalculatorNumberComplete(firstValue) || !isCalculatorNumberComplete(secondValue)) return null;
		try {
			return { ...calculatePercentage(mode, Number(firstValue), Number(secondValue)), error: "" };
		} catch (error) {
			return { result: 0, change: 0, error: error instanceof Error ? error.message : "Could not calculate this percentage." };
		}
	}, [mode, firstValue, secondValue]);
	const firstLabel = mode === "of" ? "Percentage" : mode === "change" ? "Starting value" : "Original value";
	const secondLabel = mode === "of" ? "Number" : mode === "change" ? "Ending value" : "Percentage";
	const resultLabel = mode === "change" ? "Percentage change" : mode === "of" ? "Answer" : "New value";
	const detail = calculation && !calculation.error
		? mode === "of"
			? `${formatCalculatorDisplay(Number(firstValue))}% of ${formatCalculatorDisplay(Number(secondValue))} is ${formatCalculatorDisplay(calculation.result)}.`
			: mode === "change"
				? `The difference is ${formatCalculatorDisplay(calculation.change)}.`
				: `${mode === "increase" ? "Increase" : "Decrease"} amount: ${formatCalculatorDisplay(calculation.change)}.`
		: "Enter two values to see the result.";

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<label className="block max-w-[520px] text-xs font-semibold text-[#3c3d37]" htmlFor="percentage-mode">Calculate
				<SelectField containerClassName="relative mt-2 block w-full" className="block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface pl-3 pr-10 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="percentage-mode" value={mode} onChange={(event) => setMode(event.target.value as PercentageMode)}>
					{modeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
				</SelectField>
			</label>
			<div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
				<CalculatorNumberField id="percentage-first" label={firstLabel} value={firstValue} onChange={setFirstValue} placeholder={mode === "of" ? "15" : "100"} />
				<CalculatorNumberField id="percentage-second" label={secondLabel} value={secondValue} onChange={setSecondValue} placeholder={mode === "of" ? "200" : mode === "change" ? "125" : "10"} />
			</div>
			<section className="border-l-2 border-accent bg-[#f5f3eb] px-5 py-5" aria-live="polite" aria-label="Percentage result">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">{resultLabel}</p>
				<p className="mb-1 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">
					{calculation && !calculation.error ? `${formatCalculatorDisplay(calculation.result)}${mode === "change" ? "%" : ""}` : "—"}
				</p>
				<p className="m-0 text-xs leading-relaxed text-[#60635b]">{detail}</p>
			</section>
			{calculation?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{calculation.error}</p>}
			<p className="m-0 text-[11px] leading-relaxed text-muted">Results update as you type. Percentage change uses the absolute starting value as its baseline.</p>
		</div>
	);
};

export default PercentageCalculator;
