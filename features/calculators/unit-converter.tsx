"use client";

import { useMemo, useState } from "react";
import { convertMeasurement, unitCategories, type UnitCategory } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const UnitConverter = () => {
	const [category, setCategory] = useState<UnitCategory>("length");
	const [value, setValue] = useState("1");
	const [fromUnitId, setFromUnitId] = useState("meter");
	const [toUnitId, setToUnitId] = useState("foot");
	const currentCategory = unitCategories.find((item) => item.id === category)!;
	const fromUnit = currentCategory.units.find((unit) => unit.id === fromUnitId)!;
	const toUnit = currentCategory.units.find((unit) => unit.id === toUnitId)!;
	const conversion = useMemo(() => {
		if (!isCalculatorNumberComplete(value)) return { result: null, error: "" };
		try {
			return { result: convertMeasurement(Number(value), category, fromUnitId, toUnitId), error: "" };
		} catch (error) {
			return { result: null, error: error instanceof Error ? error.message : "Could not convert this value." };
		}
	}, [value, category, fromUnitId, toUnitId]);

	const changeCategory = (nextCategory: UnitCategory) => {
		const nextUnits = unitCategories.find((item) => item.id === nextCategory)!.units;
		setCategory(nextCategory);
		setFromUnitId(nextUnits[0].id);
		setToUnitId(nextUnits[1].id);
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<label className="block max-w-[420px] text-xs font-semibold text-[#3c3d37]" htmlFor="unit-category">Measurement
				<select className="mt-2 block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="unit-category" value={category} onChange={(event) => changeCategory(event.target.value as UnitCategory)}>
					{unitCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
				</select>
			</label>
			<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 max-[620px]:grid-cols-1">
				<div className="flex min-w-0 flex-col gap-4">
					<CalculatorNumberField id="unit-value" label="Value" value={value} onChange={setValue} placeholder="Enter a value" />
					<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="unit-from">From
						<select className="mt-2 block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="unit-from" value={fromUnitId} onChange={(event) => setFromUnitId(event.target.value)}>
							{currentCategory.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}
						</select>
					</label>
				</div>
				<button className="mb-1 min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-[620px]:justify-self-center" type="button" onClick={() => { setFromUnitId(toUnitId); setToUnitId(fromUnitId); }}>Swap units</button>
				<label className="block min-w-0 text-xs font-semibold text-[#3c3d37]" htmlFor="unit-to">To
					<select className="mt-2 block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="unit-to" value={toUnitId} onChange={(event) => setToUnitId(event.target.value)}>
						{currentCategory.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>)}
					</select>
				</label>
			</div>
			{conversion.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{conversion.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Conversion result" aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Converted value</p>
				<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{conversion.result === null ? "—" : `${formatCalculatorDisplay(conversion.result)} ${toUnit.symbol}`}</p>
				<p className="mb-0 mt-3 break-words text-xs text-[#60635b]">{value || "—"} {fromUnit.symbol} = {conversion.result === null ? "—" : `${formatCalculatorDisplay(conversion.result)} ${toUnit.symbol}`}</p>
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">Conversions use standard unit definitions. Volume units are US customary; temperature is converted with separate Celsius, Fahrenheit, and Kelvin formulas.</p>
		</div>
	);
};

export default UnitConverter;
