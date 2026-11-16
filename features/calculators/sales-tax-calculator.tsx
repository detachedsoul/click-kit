"use client";

import { useMemo, useState } from "react";
import { calculateTaxAndDiscount } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const SalesTaxCalculator = () => {
	const [amount, setAmount] = useState("100");
	const [discount, setDiscount] = useState("0");
	const [taxRate, setTaxRate] = useState("0");
	const result = useMemo(() => {
		const values = [amount, discount, taxRate];
		if (!values.every(isCalculatorNumberComplete)) return null;
		try {
			return { ...calculateTaxAndDiscount(...values.map(Number) as [number, number, number]), error: "" };
		} catch (error) {
			return { discount: 0, discountedAmount: 0, tax: 0, total: 0, error: error instanceof Error ? error.message : "Could not calculate this total." };
		}
	}, [amount, discount, taxRate]);

	return <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		<div className="grid grid-cols-3 gap-4 max-[620px]:grid-cols-1">
			<CalculatorNumberField id="sales-amount" label="Original price" value={amount} onChange={setAmount} placeholder="100" />
			<CalculatorNumberField id="sales-discount" label="Discount (%)" value={discount} onChange={setDiscount} placeholder="0" />
			<CalculatorNumberField id="sales-tax" label="Tax rate (%)" value={taxRate} onChange={setTaxRate} placeholder="0" />
		</div>
		{result?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p>}
		<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Price calculation" aria-live="polite">
			<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Final price</p>
			<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{result && !result.error ? formatCalculatorDisplay(result.total) : "—"}</p>
			<div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 max-[520px]:grid-cols-1">
				<p className="m-0 text-xs text-[#60635b]">Discount: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.discount) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">After discount: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.discountedAmount) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">Tax: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.tax) : "—"}</strong></p>
			</div>
		</section>
		<p className="m-0 text-[11px] leading-relaxed text-muted">Discount is applied first, then tax is calculated on the discounted amount. Enter the tax rate that applies to your purchase; this tool does not determine local tax rules.</p>
	</div>;
};

export default SalesTaxCalculator;
