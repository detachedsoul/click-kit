"use client";

import { useMemo, useState } from "react";
import { evaluateArithmeticExpression } from "@/features/calculators/calculator-utils";
import { formatCalculatorDisplay } from "@/features/calculators/calculator-shared";

const keypad = [
	{ label: "Clear", value: "clear", kind: "utility" },
	{ label: "(", value: "(", kind: "operator" },
	{ label: ")", value: ")", kind: "operator" },
	{ label: "Backspace", value: "backspace", kind: "utility" },
	{ label: "7", value: "7", kind: "number" },
	{ label: "8", value: "8", kind: "number" },
	{ label: "9", value: "9", kind: "number" },
	{ label: "÷", value: "/", kind: "operator" },
	{ label: "4", value: "4", kind: "number" },
	{ label: "5", value: "5", kind: "number" },
	{ label: "6", value: "6", kind: "number" },
	{ label: "×", value: "*", kind: "operator" },
	{ label: "1", value: "1", kind: "number" },
	{ label: "2", value: "2", kind: "number" },
	{ label: "3", value: "3", kind: "number" },
	{ label: "−", value: "-", kind: "operator" },
	{ label: "0", value: "0", kind: "number" },
	{ label: ".", value: ".", kind: "number" },
	{ label: "+", value: "+", kind: "operator" },
	{ label: "=", value: "equals", kind: "equals" },
] as const;

const StandardCalculator = () => {
	const [expression, setExpression] = useState("");
	const [isShowingResult, setIsShowingResult] = useState(false);
	const [error, setError] = useState("");
	const calculation = useMemo(() => {
		if (!expression.trim()) return { value: null, error: "" };
		try {
			return { value: evaluateArithmeticExpression(expression), error: "" };
		} catch (calculationError) {
			return { value: null, error: calculationError instanceof Error ? calculationError.message : "Could not calculate this expression." };
		}
	}, [expression]);

	const clear = () => {
		setExpression("");
		setError("");
		setIsShowingResult(false);
	};

	const append = (value: string) => {
		setExpression((currentExpression) => isShowingResult && (/^[\d.]$/u.test(value) || value === "(")
			? value
			: `${currentExpression}${value}`);
		setError("");
		setIsShowingResult(false);
	};

	const calculate = () => {
		if (calculation.value === null) {
			setError(calculation.error || "Enter a calculation first.");
			return;
		}
		setExpression(String(calculation.value));
		setError("");
		setIsShowingResult(true);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === "=") {
			event.preventDefault();
			calculate();
		} else if (event.key === "Escape") {
			event.preventDefault();
			clear();
		}
	};

	return (
		<div className="grid grid-cols-[minmax(0,1fr)_minmax(230px,0.8fr)] gap-7 p-7 max-[760px]:grid-cols-1 max-[760px]:gap-5 max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex min-w-0 flex-col gap-4">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="calculator-expression">Calculation</label>
				<input
					className="h-[76px] w-full min-w-0 border border-field bg-[#f8f7f3] px-4 text-right font-mono text-[clamp(24px,5vw,36px)] text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="calculator-expression"
					inputMode="decimal"
					maxLength={200}
					onChange={(event) => { setExpression(event.target.value); setError(""); setIsShowingResult(false); }}
					onKeyDown={handleKeyDown}
					placeholder="0"
					value={expression}
				/>
				<div className="flex min-h-14 items-center justify-between gap-3 border-l-2 border-accent bg-[#f5f3eb] px-4 py-2" aria-live="polite">
					<span className="text-xs text-muted">Result</span>
					<output className="min-w-0 break-all text-right font-mono text-lg font-semibold text-forest" aria-label="Calculator result">
						{calculation.value === null ? "—" : formatCalculatorDisplay(calculation.value)}
					</output>
				</div>
				<p className="min-h-5 m-0 text-xs text-[#8a3f30]" id="calculator-error" role={error ? "alert" : undefined}>{error}</p>
				<p className="m-0 text-[11px] leading-relaxed text-muted">Use parentheses to group operations. Multiplication and division are evaluated before addition and subtraction.</p>
			</div>
			<div className="grid grid-cols-4 gap-2" role="group" aria-label="Calculator keypad">
				{keypad.map((key) => <button
					className={`min-h-[54px] cursor-pointer border border-line px-2 text-sm font-medium transition-colors hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${key.kind === "equals" ? "border-forest bg-forest text-white hover:bg-[#354d44]" : key.kind === "operator" ? "bg-[#f0efe9] text-ink" : key.kind === "utility" ? "bg-[#e9ede3] text-forest" : "bg-surface text-ink"}`}
					key={key.value}
					type="button"
					aria-label={key.value === "backspace" ? "Delete last character" : undefined}
					onClick={() => {
						if (key.value === "clear") clear();
						else if (key.value === "backspace") { setExpression((currentExpression) => currentExpression.slice(0, -1)); setError(""); setIsShowingResult(false); }
						else if (key.value === "equals") calculate();
						else append(key.value);
					}}
				>
					{key.label}
				</button>)}
			</div>
		</div>
	);
};

export default StandardCalculator;
