"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import { compareUnitPrices, money, unitLabels, type Unit, type UnitPriceOffer } from "@/features/calculators/unit-price-utils";

const starterOffers: UnitPriceOffer[] = [
	{ id: "offer-1", name: "Supermarket own brand", price: 2.49, quantity: 500, unit: "g" },
	{ id: "offer-2", name: "Large bag", price: 4.2, quantity: 1, unit: "kg" },
	{ id: "offer-3", name: "Corner shop", price: 1.35, quantity: 250, unit: "g" },
];

let nextId = starterOffers.length + 1;

const unitOptions = (Object.keys(unitLabels) as Unit[]).map((unit) => ({ unit, label: unitLabels[unit] }));

export default function UnitPriceCalculator() {
	const [offers, setOffers] = useState<UnitPriceOffer[]>(starterOffers);
	const comparison = useMemo(() => {
		try {
			return { value: compareUnitPrices(offers), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Could not compare these offers." };
		}
	}, [offers]);
	const update = (id: string, patch: Partial<UnitPriceOffer>) => setOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)));
	const report = useMemo(() => {
		if (!comparison.value) return "";
		const { rows, cheapest, mostExpensive, savingPercent, measureLabel } = comparison.value;
		const sorted = [...rows].sort((left, right) => left.pricePerBase - right.pricePerBase);
		return [
			...sorted.map((row, index) => {
				const mark = row.id === cheapest?.id ? "★" : " ";
				return `${mark} ${String(index + 1).padStart(2, "0")}. ${row.name}\n     ${money(row.price)} for ${row.size} → ${money(row.pricePerHundred)} ${row.displayUnit}`;
			}),
			"",
			`Cheapest      ${cheapest?.name} at ${money(cheapest?.pricePerHundred ?? 0)} ${measureLabel}`,
			`Most expensive ${mostExpensive?.name} at ${money(mostExpensive?.pricePerHundred ?? 0)} ${measureLabel}`,
			`Saving        ${savingPercent}% between the best and worst price per unit`,
		].join("\n");
	}, [comparison]);
	return (
		<ToolPanel>
			<div className="flex flex-col gap-3">
				<span className={labelClassName}>Offers to compare</span>
				{offers.map((offer, index) => (
					<div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.4fr)_6.5rem_6rem_9rem_auto]" key={offer.id}>
						<label htmlFor={`${offer.id}-name`}>
							<span className="sr-only">{`Offer ${index + 1} name`}</span>
							<input
								className={fieldClassName}
								id={`${offer.id}-name`}
								onChange={(event) => update(offer.id, { name: event.target.value })}
								placeholder="Product or shop"
								value={offer.name}
							/>
						</label>
						<label htmlFor={`${offer.id}-price`}>
							<span className="sr-only">{`Offer ${index + 1} price`}</span>
							<input
								className={fieldClassName}
								id={`${offer.id}-price`}
								min="0"
								onChange={(event) => update(offer.id, { price: Number(event.target.value) })}
								step="0.01"
								type="number"
								value={Number.isFinite(offer.price) ? offer.price : ""}
							/>
						</label>
						<label htmlFor={`${offer.id}-quantity`}>
							<span className="sr-only">{`Offer ${index + 1} amount`}</span>
							<input
								className={fieldClassName}
								id={`${offer.id}-quantity`}
								min="0"
								onChange={(event) => update(offer.id, { quantity: Number(event.target.value) })}
								step="any"
								type="number"
								value={Number.isFinite(offer.quantity) ? offer.quantity : ""}
							/>
						</label>
						<label htmlFor={`${offer.id}-unit`}>
							<span className="sr-only">{`Offer ${index + 1} unit`}</span>
							<select className={selectClassName} id={`${offer.id}-unit`} onChange={(event) => update(offer.id, { unit: event.target.value as Unit })} value={offer.unit}>
								{unitOptions.map((option) => (
									<option key={option.unit} value={option.unit}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<button
							className="min-h-11 cursor-pointer border border-line bg-surface px-3 text-xs text-[#54554e] hover:border-[#aaa69a] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => setOffers((current) => (current.length > 1 ? current.filter((item) => item.id !== offer.id) : current))}
							type="button"
						>
							Remove
						</button>
					</div>
				))}
				<button
					className={`${primaryButtonClassName} self-start`}
					onClick={() => {
						nextId += 1;
						setOffers((current) => [...current, { id: `offer-${nextId}`, name: "", price: 0, quantity: 0, unit: "g" }]);
					}}
					type="button"
				>
					Add offer
				</button>
			</div>
			<ErrorNote message={comparison.error} />
			{comparison.value && (
				<>
					<StatGrid
						items={[
							{ label: "Cheapest", value: comparison.value.cheapest ? money(comparison.value.cheapest.pricePerHundred) : "—" },
							{ label: "Per", value: comparison.value.measureLabel },
							{ label: "Saving", value: `${comparison.value.savingPercent}%` },
							{ label: "Offers", value: String(comparison.value.rows.length) },
						]}
					/>
					<ResultBlock fileName="unit-prices.txt" rows={12} title="Result" value={report} />
				</>
			)}
			<p className={hintClassName}>
				Prices are normalised to a shared measure — per 100 g, per 100 ml, per metre, or per item — so a 2 kg bag and a 400 g box can be compared
				directly. Mixing weight, volume, length, and count units gives a mixed-unit warning.
			</p>
		</ToolPanel>
	);
}
