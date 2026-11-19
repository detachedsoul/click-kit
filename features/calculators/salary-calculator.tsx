"use client";

import { useMemo, useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { convertPay, CURRENCIES, DEFAULT_SETTINGS, formatMoney, PAY_PERIODS, payReport, type PayPeriod, type PaySettings } from "@/features/calculators/salary-utils";

export default function SalaryCalculator() {
	const [amountInput, setAmountInput] = useState("250000");
	const [period, setPeriod] = useState<PayPeriod>("month");
	const [currency, setCurrency] = useState("NGN");
	const [settings, setSettings] = useState<PaySettings>(DEFAULT_SETTINGS);

	const result = useMemo(() => {
		try {
			const amount = Number(amountInput.replace(/[, ]/gu, ""));
			return { value: convertPay(amount, period, settings), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Could not convert this amount." };
		}
	}, [amountInput, period, settings]);
	const report = result.value ? payReport(Number(amountInput.replace(/[, ]/gu, "")), period, currency, settings) : "";
	const update = (patch: Partial<PaySettings>) => setSettings((current) => ({ ...current, ...patch }));

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="salary-amount">
					Pay amount
					<input className={fieldClassName} id="salary-amount" inputMode="decimal" onChange={(event) => setAmountInput(event.target.value)} value={amountInput} />
				</label>
				<label className={labelClassName} htmlFor="salary-period">
					That amount is…
					<select className={selectClassName} id="salary-period" onChange={(event) => setPeriod(event.target.value as PayPeriod)} value={period}>
						{PAY_PERIODS.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label.toLowerCase()}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="salary-currency">
					Currency
					<select className={selectClassName} id="salary-currency" onChange={(event) => setCurrency(event.target.value)} value={currency}>
						{CURRENCIES.map((option) => (
							<option key={option.code} value={option.code}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="salary-hours">
					Hours per week
					<input
						className={fieldClassName}
						id="salary-hours"
						max={168}
						min={1}
						onChange={(event) => update({ hoursPerWeek: Number(event.target.value) })}
						type="number"
						value={settings.hoursPerWeek}
					/>
				</label>
				<label className={labelClassName} htmlFor="salary-days">
					Working days per week
					<input
						className={fieldClassName}
						id="salary-days"
						max={7}
						min={1}
						onChange={(event) => update({ daysPerWeek: Number(event.target.value) })}
						type="number"
						value={settings.daysPerWeek}
					/>
				</label>
				<label className={labelClassName} htmlFor="salary-weeks">
					Working weeks per year
					<input
						className={fieldClassName}
						id="salary-weeks"
						max={52}
						min={1}
						onChange={(event) => update({ weeksPerYear: Number(event.target.value) })}
						type="number"
						value={settings.weeksPerYear}
					/>
				</label>
			</div>

			<ErrorNote message={result.error} />
			{result.value ? (
				<>
					<div className="grid gap-3 sm:grid-cols-2">
						{PAY_PERIODS.map((option) => (
							<div
								className={`border px-3 py-2.5 ${option.id === period ? "border-forest bg-[#f2f5ef]" : "border-line bg-[#fbfaf7]"}`}
								key={option.id}
							>
								<p className="m-0 font-mono text-[9px] uppercase tracking-[.08em] text-[#5f6259]">{option.label}</p>
								<p className="m-0 mt-1 font-serif text-[22px] leading-none tracking-[-.02em] text-ink">{formatMoney(result.value[option.id], currency)}</p>
							</div>
						))}
						<div className="border border-line bg-[#fbfaf7] px-3 py-2.5">
							<p className="m-0 font-mono text-[9px] uppercase tracking-[.08em] text-[#5f6259]">Hours per year</p>
							<p className="m-0 mt-1 font-serif text-[22px] leading-none tracking-[-.02em] text-ink">{result.value.hoursPerYear.toLocaleString("en-GB")}</p>
						</div>
					</div>
					<StatGrid
						items={[
							{ label: "Full-time basis", value: `${settings.hoursPerWeek} h/week` },
							{ label: "Working weeks", value: String(settings.weeksPerYear) },
							{ label: "Hourly", value: formatMoney(result.value.hour, currency) },
							{ label: "Yearly", value: formatMoney(result.value.year, currency) },
						]}
					/>
					<ResultBlock fileName="pay-breakdown.txt" rows={12} title="Breakdown" value={report} />
				</>
			) : null}
			<p className={hintClassName}>
				Everything scales from the hourly rate, so part-time patterns convert honestly: 20 hours a week over 50 weeks is 1,000 hours a year, not the
				2,080 of a full-time year. Figures are gross — no tax or pension is deducted.
			</p>
		</ToolPanel>
	);
}
