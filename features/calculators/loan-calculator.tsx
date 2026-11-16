"use client";

import { useMemo, useState } from "react";
import { calculateLoanPayment } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay } from "@/features/calculators/calculator-shared";

const LoanCalculator = () => {
	const [principal, setPrincipal] = useState("");
	const [annualRate, setAnnualRate] = useState("");
	const [termMonths, setTermMonths] = useState("");
	const calculation = useMemo(() => {
		if ([principal, annualRate, termMonths].some((value) => value.trim() === "")) return null;
		try {
			return { ...calculateLoanPayment(Number(principal), Number(annualRate), Number(termMonths)), error: "" };
		} catch (error) {
			return { monthlyPayment: 0, totalPaid: 0, totalInterest: 0, error: error instanceof Error ? error.message : "Could not estimate these payments." };
		}
	}, [principal, annualRate, termMonths]);

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="grid grid-cols-3 gap-4 max-[620px]:grid-cols-1">
				<CalculatorNumberField id="loan-principal" label="Loan amount" value={principal} onChange={setPrincipal} placeholder="25,000" />
				<CalculatorNumberField id="loan-rate" label="Annual interest rate (%)" value={annualRate} onChange={setAnnualRate} placeholder="6.5" />
				<CalculatorNumberField id="loan-term" label="Loan term (months)" value={termMonths} onChange={setTermMonths} placeholder="60" />
			</div>
			{calculation?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{calculation.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Loan payment estimate" aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Estimated monthly payment</p>
				<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.monthlyPayment) : "—"}</p>
				<div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 max-[520px]:grid-cols-1">
					<p className="m-0 text-xs text-[#60635b]">Total paid: <strong className="font-semibold text-ink">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.totalPaid) : "—"}</strong></p>
					<p className="m-0 text-xs text-[#60635b]">Total interest: <strong className="font-semibold text-ink">{calculation && !calculation.error ? formatCalculatorDisplay(calculation.totalInterest) : "—"}</strong></p>
				</div>
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">Estimate only: assumes a fixed annual rate and equal monthly payments. Figures use the same currency as the loan amount and exclude fees, taxes, and lender-specific terms.</p>
		</div>
	);
};

export default LoanCalculator;
