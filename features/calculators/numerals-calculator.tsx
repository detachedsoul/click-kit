"use client";

import { useMemo, useState } from "react";
import { fromRoman, numberToWords, ordinalSuffix, toRoman } from "@/features/calculators/numerals-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

type Mode = "number" | "roman";

export default function NumeralsCalculator() {
	const [mode, setMode] = useState<Mode>("number");
	const [number, setNumber] = useState("1994");
	const [roman, setRoman] = useState("MCMXCIV");
	const [useAnd, setUseAnd] = useState(true);
	const result = useMemo(() => {
		try {
			if (mode === "roman") {
				const value = fromRoman(roman);
				return { lines: [`Roman      ${roman.trim().toUpperCase()}`, `Number     ${value}`, `Ordinal    ${ordinalSuffix(value)}`, `Words      ${numberToWords(value, { useAnd })}`], error: "" };
			}
			const parsed = number.trim() === "" ? Number.NaN : Number(number);
			if (!Number.isFinite(parsed)) throw new Error("Enter a whole number.");
			const value = Math.trunc(parsed);
			const lines = [`Number     ${value}`, `Words      ${numberToWords(value, { useAnd })}`, `Ordinal    ${ordinalSuffix(Math.abs(value))}`];
			if (value >= 1 && value <= 3999) lines.push(`Roman      ${toRoman(value)}`);
			else lines.push("Roman      only numbers from 1 to 3,999 have standard Roman numerals");
			return { lines, error: "" };
		} catch (error) {
			return { lines: [], error: error instanceof Error ? error.message : "Could not convert this value." };
		}
	}, [mode, number, roman, useAnd]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="numerals-mode">
					Conversion
					<select className={selectClassName} id="numerals-mode" onChange={(event) => setMode(event.target.value as Mode)} value={mode}>
						<option value="number">Number → words and Roman</option>
						<option value="roman">Roman → number and words</option>
					</select>
				</label>
				{mode === "number" ? (
					<label className={labelClassName} htmlFor="numerals-number">
						Number
						<input className={fieldClassName} id="numerals-number" onChange={(event) => setNumber(event.target.value)} value={number} />
					</label>
				) : (
					<label className={labelClassName} htmlFor="numerals-roman">
						Roman numeral
						<input className={`${fieldClassName} font-mono uppercase`} id="numerals-roman" onChange={(event) => setRoman(event.target.value)} value={roman} />
					</label>
				)}
				<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="numerals-and">
					<input checked={useAnd} id="numerals-and" onChange={(event) => setUseAnd(event.target.checked)} type="checkbox" />
					British style (“one hundred and five”)
				</label>
			</div>
			<ErrorNote message={result.error} />
			{result.lines.length > 0 && <ResultBlock title="Result" value={result.lines.join("\n")} rows={6} fileName="numerals.txt" />}
			<p className={hintClassName}>
				Roman numerals follow the subtractive standard: 4 is IV, 9 is IX, 40 is XL, and 1994 is MCMXCIV. Numbers above 3,999 are still written out in
				words, since standard numerals do not go higher.
			</p>
		</ToolPanel>
	);
}
