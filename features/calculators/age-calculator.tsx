"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { calculateAge, calculateCalendarDifference } from "@/features/calculators/calculator-utils";

const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const subscribeToLocalDate = (onChange: () => void) => {
	window.addEventListener("focus", onChange);
	window.addEventListener("visibilitychange", onChange);
	return () => {
		window.removeEventListener("focus", onChange);
		window.removeEventListener("visibilitychange", onChange);
	};
};
const getLocalDateSnapshot = () => formatLocalDate(new Date());
const getServerDateSnapshot = () => "";

const DateField = ({ id, label, value, onChange, min, max }: { id: string; label: string; value: string; onChange: (value: string) => void; min?: string; max?: string }) => (
	<label className="block min-w-0 text-xs font-semibold text-[#3c3d37]" htmlFor={id}>
		{label}
		<input className="mt-2 block h-11 w-full min-w-0 border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id={id} max={max} min={min} onChange={(event) => onChange(event.target.value)} type="date" value={value} />
	</label>
);

const AgeCalculator = () => {
	const [mode, setMode] = useState<"age" | "between">("age");
	const [birthDate, setBirthDate] = useState("");
	const [asOfDate, setAsOfDate] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const today = useSyncExternalStore(subscribeToLocalDate, getLocalDateSnapshot, getServerDateSnapshot);
	const effectiveAsOfDate = asOfDate || today;
	const effectiveEndDate = endDate || today;
	const calculation = useMemo(() => {
		const firstDate = mode === "age" ? birthDate : startDate;
		const secondDate = mode === "age" ? effectiveAsOfDate : effectiveEndDate;
		if (!firstDate || !secondDate) return null;
		try {
			return { ...(mode === "age" ? calculateAge(firstDate, secondDate) : calculateCalendarDifference(firstDate, secondDate)), error: "" };
		} catch (error) {
			return { years: 0, months: 0, days: 0, totalDays: 0, error: error instanceof Error ? error.message : "Could not compare these dates." };
		}
	}, [mode, birthDate, effectiveAsOfDate, startDate, effectiveEndDate]);

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-3 border border-line bg-[#f8f7f3] px-4 py-3">
				<legend className="px-1 text-xs font-semibold">What would you like to calculate?</legend>
				{[{ id: "age", label: "Age on a date" }, { id: "between", label: "Time between dates" }].map((option) => <label className="flex cursor-pointer items-center gap-2 text-xs" key={option.id}>
					<input className="size-4 accent-accent-dark" checked={mode === option.id} name="age-calculator-mode" onChange={() => setMode(option.id as "age" | "between")} type="radio" value={option.id} />{option.label}
				</label>)}
			</fieldset>
			<div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
				{mode === "age" ? <>
					<DateField id="birth-date" label="Date of birth" value={birthDate} onChange={setBirthDate} max={effectiveAsOfDate} />
					<DateField id="age-as-of-date" label="Age on" value={effectiveAsOfDate} onChange={setAsOfDate} />
				</> : <>
					<DateField id="date-range-start" label="From" value={startDate} onChange={setStartDate} max={effectiveEndDate} />
					<DateField id="date-range-end" label="To" value={effectiveEndDate} onChange={setEndDate} min={startDate || undefined} />
				</>}
			</div>
			{calculation?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{calculation.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label={mode === "age" ? "Calculated age" : "Time between dates"} aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">{mode === "age" ? "Age" : "Elapsed time"}</p>
				{calculation && !calculation.error ? <>
					<div className="mt-3 grid grid-cols-4 border-l border-t border-line max-[520px]:grid-cols-2">{[{ label: "Years", value: calculation.years }, { label: "Months", value: calculation.months }, { label: "Days", value: calculation.days }, { label: "Total days", value: calculation.totalDays }].map((metric) => <div className="border-b border-r border-line bg-surface px-3 py-3" key={metric.label}><p className="m-0 font-mono text-[9px] uppercase tracking-wide text-muted">{metric.label}</p><p className="mb-0 mt-1 font-serif text-[27px] leading-none text-forest">{metric.value.toLocaleString()}</p></div>)}</div>
					<p className="mb-0 mt-3 text-xs leading-relaxed text-[#60635b]">{mode === "age" ? `${calculation.years} years, ${calculation.months} months, and ${calculation.days} days old.` : `${calculation.years} years, ${calculation.months} months, and ${calculation.days} days between these dates.`}</p>
				</> : <p className="mb-0 mt-3 text-sm text-muted">Choose two dates to see the result.</p>}
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">Calendar dates are used, so daylight-saving changes do not affect the count. February 29 birthdays use February 28 as the anniversary in non-leap years.</p>
		</div>
	);
};

export default AgeCalculator;
