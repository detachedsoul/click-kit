"use client";

import { useMemo, useState } from "react";
import { calculateTipSplit } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const TipSplitCalculator = () => {
	const [billAmount, setBillAmount] = useState("");
	const [tipPercent, setTipPercent] = useState("15");
	const [people, setPeople] = useState("2");
	const calculation = useMemo(() => {
		if (![billAmount, tipPercent, people].every(isCalculatorNumberComplete)) return null;
		try {
			return { ...calculateTipSplit(Number(billAmount), Number(tipPercent), Number(people)), error: "" };
		} catch (error) {
			return { tipAmount: 0, total: 0, tipPerPerson: 0, totalPerPerson: 0, error: error instanceof Error ? error.message : "Could not split this bill." };
		}
	}, [billAmount, tipPercent, people]);

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="grid grid-cols-3 gap-4 max-[620px]:grid-cols-1">
				<CalculatorNumberField id="bill-amount" label="Bill amount" value={billAmount} onChange={setBillAmount} placeholder="80" />
				<CalculatorNumberField id="bill-tip" label="Tip (%)" value={tipPercent} onChange={setTipPercent} placeholder="15" />
				<CalculatorNumberField id="bill-people" label="Number of people" value={people} onChange={setPeople} placeholder="2" />
			</div>
			{calculation?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{calculation.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Bill split result" aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Each person pays</p>
				<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.totalPerPerson) : "—"}</p>
				<div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 max-[520px]:grid-cols-1">
					<p className="m-0 text-xs text-[#60635b]">Tip total: <strong className="font-semibold text-ink">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.tipAmount) : "—"}</strong></p>
					<p className="m-0 text-xs text-[#60635b]">Tip per person: <strong className="font-semibold text-ink">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.tipPerPerson) : "—"}</strong></p>
					<p className="m-0 text-xs text-[#60635b]">Bill plus tip: <strong className="font-semibold text-ink">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.total) : "—"}</strong></p>
				</div>
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">The total is divided evenly among the group. Amounts are shown without a currency symbol; use the same currency as the bill.</p>
		</div>
	);
};

export default TipSplitCalculator;
