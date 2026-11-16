"use client";

import { useMemo, useState } from "react";
import { calculateScientificFunction, evaluateArithmeticExpression } from "@/features/calculators/calculator-utils";
import { formatCalculatorDisplay } from "@/features/calculators/calculator-shared";

type ScientificOperation = "sin" | "cos" | "tan" | "log" | "ln" | "sqrt" | "square";
const operationButtons: { operation: ScientificOperation; label: string; description: string }[] = [
	{ operation: "sin", label: "sin", description: "Sine" },
	{ operation: "cos", label: "cos", description: "Cosine" },
	{ operation: "tan", label: "tan", description: "Tangent" },
	{ operation: "log", label: "log", description: "Base-10 logarithm" },
	{ operation: "ln", label: "ln", description: "Natural logarithm" },
	{ operation: "sqrt", label: "√x", description: "Square root" },
	{ operation: "square", label: "x²", description: "Square" },
];

const ScientificCalculator = () => {
	const [expression, setExpression] = useState("");
	const [angleUnit, setAngleUnit] = useState<"degrees" | "radians">("degrees");
	const [error, setError] = useState("");
	const calculation = useMemo(() => {
		if (!expression.trim()) return null;
		try {
			return { result: evaluateArithmeticExpression(expression), error: "" };
		} catch (calculationError) {
			return { result: null, error: calculationError instanceof Error ? calculationError.message : "Check this expression." };
		}
	}, [expression]);

	const applyOperation = (operation: ScientificOperation) => {
		try {
			const value = evaluateArithmeticExpression(expression);
			const result = calculateScientificFunction(operation, value, angleUnit);
			setExpression(String(result));
			setError("");
		} catch (operationError) {
			setError(operationError instanceof Error ? operationError.message : "That operation could not be calculated.");
		}
	};
	const updateExpression = (value: string) => {
		setExpression(value);
		setError("");
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<label className="block min-w-[220px] flex-1 text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-expression">Calculation
					<input className="mt-2 block h-12 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-base font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-expression" inputMode="decimal" onChange={(event) => updateExpression(event.target.value)} placeholder="Try 2 * (3 + 4)" value={expression} />
				</label>
				<label className="block min-w-[145px] text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-angle-unit">Angles
					<select className="mt-2 block h-12 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-angle-unit" value={angleUnit} onChange={(event) => setAngleUnit(event.target.value as "degrees" | "radians")}>
						<option value="degrees">Degrees</option>
						<option value="radians">Radians</option>
					</select>
				</label>
			</div>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Scientific operations">
				<button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-4 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression("")} type="button">Clear</button>
				<button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-4 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(String(Math.PI))} type="button">π</button>
				<button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-4 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(String(Math.E))} type="button">e</button>
				{operationButtons.map(({ operation, label, description }) => <button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-4 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={operation} onClick={() => applyOperation(operation)} aria-label={description} type="button">{label}</button>)}
			</div>
			{(error || calculation?.error) && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error || calculation?.error}</p>}
			<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Scientific calculator result" aria-live="polite">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Result</p>
				<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{calculation?.result === null || calculation?.result === undefined || calculation.error ? "—" : formatCalculatorDisplay(calculation.result)}</p>
			</section>
			<p className="m-0 text-[11px] leading-relaxed text-muted">Enter arithmetic using +, -, *, /, and parentheses, then apply a scientific function to the result. Trigonometric functions use the selected angle units.</p>
		</div>
	);
};

export default ScientificCalculator;
