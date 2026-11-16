"use client";

import { useMemo, useState } from "react";
import { calculateCompoundGrowth } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const CompoundInterestCalculator = () => {
	const [principal, setPrincipal] = useState("10000");
	const [annualRate, setAnnualRate] = useState("5");
	const [years, setYears] = useState("10");
	const [monthlyContribution, setMonthlyContribution] = useState("0");
	const result = useMemo(() => {
		const values = [principal, annualRate, years, monthlyContribution];
		if (!values.every(isCalculatorNumberComplete)) return null;
		try {
			return { ...calculateCompoundGrowth(...values.map(Number) as [number, number, number, number]), error: "" };
		} catch (error) {
			return { finalBalance: 0, totalContributions: 0, interestEarned: 0, error: error instanceof Error ? error.message : "Could not estimate growth." };
		}
	}, [principal, annualRate, years, monthlyContribution]);

	return <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
			<CalculatorNumberField id="compound-principal" label="Starting amount" value={principal} onChange={setPrincipal} placeholder="10,000" />
			<CalculatorNumberField id="compound-rate" label="Annual interest rate (%)" value={annualRate} onChange={setAnnualRate} placeholder="5" />
			<CalculatorNumberField id="compound-years" label="Investment term (years)" value={years} onChange={setYears} placeholder="10" />
			<CalculatorNumberField id="compound-contribution" label="Monthly contribution" value={monthlyContribution} onChange={setMonthlyContribution} placeholder="0" />
		</div>
		{result?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p>}
		<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Compound growth estimate" aria-live="polite">
			<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Estimated ending balance</p>
			<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{result && !result.error ? formatCalculatorDisplay(result.finalBalance) : "—"}</p>
			<div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 max-[520px]:grid-cols-1">
				<p className="m-0 text-xs text-[#60635b]">Total added: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.totalContributions) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">Interest earned: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.interestEarned) : "—"}</strong></p>
			</div>
		</section>
		<p className="m-0 text-[11px] leading-relaxed text-muted">Estimate assumes a fixed annual rate divided into monthly compounding periods, with each monthly contribution added at month-end. It excludes taxes, fees, and changing rates; it is not financial advice.</p>
	</div>;
};

export default CompoundInterestCalculator;
