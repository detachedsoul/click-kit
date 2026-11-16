"use client";

import { useMemo, useState } from "react";
import { calculateFuelEconomy, type FuelEconomyUnit } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay, isCalculatorNumberComplete } from "@/features/calculators/calculator-shared";

const economyUnits: { id: FuelEconomyUnit; label: string }[] = [
	{ id: "km-per-liter", label: "Kilometres per litre (km/L)" },
	{ id: "liters-per-100-km", label: "Litres per 100 kilometres (L/100 km)" },
	{ id: "us-mpg", label: "Miles per US gallon (US mpg)" },
	{ id: "imperial-mpg", label: "Miles per Imperial gallon (Imperial mpg)" },
];

const FuelEconomyCalculator = () => {
	const [unit, setUnit] = useState<FuelEconomyUnit>("km-per-liter");
	const [efficiency, setEfficiency] = useState("12");
	const [distance, setDistance] = useState("100");
	const result = useMemo(() => {
		if (!isCalculatorNumberComplete(efficiency) || !isCalculatorNumberComplete(distance)) return null;
		try {
			return { ...calculateFuelEconomy(Number(efficiency), Number(distance), unit), error: "" };
		} catch (error) {
			return { litersPer100Km: 0, kmPerLiter: 0, usMpg: 0, imperialMpg: 0, fuelForTripLiters: 0, unitLabel: "", error: error instanceof Error ? error.message : "Could not calculate fuel economy." };
		}
	}, [efficiency, distance, unit]);

	return <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
			<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="fuel-economy-unit">Fuel economy unit
				<select className="mt-2 block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface pl-3 pr-8 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="fuel-economy-unit" value={unit} onChange={(event) => setUnit(event.target.value as FuelEconomyUnit)}>
					{economyUnits.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
				</select>
			</label>
			<CalculatorNumberField id="fuel-efficiency" label={`Fuel economy (${economyUnits.find((option) => option.id === unit)?.label.split(" (").at(-1)?.replace(")", "") ?? "unit"})`} value={efficiency} onChange={setEfficiency} placeholder="12" />
		</div>
		<CalculatorNumberField id="fuel-distance" label="Trip distance (km)" value={distance} onChange={setDistance} placeholder="100" />
		{result?.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p>}
		<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Fuel economy result" aria-live="polite">
			<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Estimated fuel for trip</p>
			<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{result && !result.error ? `${formatCalculatorDisplay(result.fuelForTripLiters)} L` : "—"}</p>
			<div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 max-[520px]:grid-cols-1">
				<p className="m-0 text-xs text-[#60635b]">L/100 km: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.litersPer100Km) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">km/L: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.kmPerLiter) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">US mpg: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.usMpg) : "—"}</strong></p>
				<p className="m-0 text-xs text-[#60635b]">Imperial mpg: <strong className="font-semibold text-ink">{result && !result.error ? formatCalculatorDisplay(result.imperialMpg) : "—"}</strong></p>
			</div>
		</section>
		<p className="m-0 text-[11px] leading-relaxed text-muted">Imperial mpg is distinguished from US mpg because the gallons differ. Trip fuel is an estimate; actual consumption varies with driving conditions and vehicle load.</p>
	</div>;
};

export default FuelEconomyCalculator;
