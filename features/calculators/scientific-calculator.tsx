"use client";

import { useMemo, useState, type FormEvent } from "react";
import { evaluateScientificExpression } from "@/features/calculators/calculator-utils";
import { formatCalculatorDisplay } from "@/features/calculators/calculator-shared";

type AngleUnit = "degrees" | "radians";
type OutputBase = "decimal" | "binary" | "octal" | "hexadecimal";
const outputBases: { id: OutputBase; label: string; radix: number }[] = [
	{ id: "decimal", label: "Decimal", radix: 10 },
	{ id: "binary", label: "Binary", radix: 2 },
	{ id: "octal", label: "Octal", radix: 8 },
	{ id: "hexadecimal", label: "Hexadecimal", radix: 16 },
];
type HistoryEntry = { expression: string; result: number };

const functionButtons = [
	{ token: "sin(", label: "sin", description: "Insert sine function" },
	{ token: "cos(", label: "cos", description: "Insert cosine function" },
	{ token: "tan(", label: "tan", description: "Insert tangent function" },
	{ token: "asin(", label: "sin⁻¹", description: "Insert inverse sine function" },
	{ token: "acos(", label: "cos⁻¹", description: "Insert inverse cosine function" },
	{ token: "atan(", label: "tan⁻¹", description: "Insert inverse tangent function" },
	{ token: "sqrt(", label: "√x", description: "Insert square root function" },
	{ token: "cbrt(", label: "∛x", description: "Insert cube root function" },
	{ token: "abs(", label: "abs", description: "Insert absolute value function" },
	{ token: "ln(", label: "ln", description: "Insert natural logarithm" },
	{ token: "log(", label: "log", description: "Insert base-10 logarithm" },
	{ token: "log2(", label: "log₂", description: "Insert base-2 logarithm" },
	{ token: "exp(", label: "eˣ", description: "Insert exponential function" },
	{ token: "floor(", label: "floor", description: "Insert floor function" },
	{ token: "ceil(", label: "ceil", description: "Insert ceiling function" },
	{ token: "round(", label: "round", description: "Insert rounding function" },
];

const advancedFunctionButtons = [
	{ token: "asec(", label: "sec⁻¹", description: "Insert inverse secant function" },
	{ token: "acsc(", label: "csc⁻¹", description: "Insert inverse cosecant function" },
	{ token: "acot(", label: "cot⁻¹", description: "Insert inverse cotangent function" },
	{ token: "sec(", label: "sec", description: "Insert secant function" },
	{ token: "csc(", label: "csc", description: "Insert cosecant function" },
	{ token: "cot(", label: "cot", description: "Insert cotangent function" },
	{ token: "sinh(", label: "sinh", description: "Insert hyperbolic sine function" },
	{ token: "cosh(", label: "cosh", description: "Insert hyperbolic cosine function" },
	{ token: "tanh(", label: "tanh", description: "Insert hyperbolic tangent function" },
	{ token: "sech(", label: "sech", description: "Insert hyperbolic secant function" },
	{ token: "csch(", label: "csch", description: "Insert hyperbolic cosecant function" },
	{ token: "coth(", label: "coth", description: "Insert hyperbolic cotangent function" },
	{ token: "asinh(", label: "asinh", description: "Insert inverse hyperbolic sine function" },
	{ token: "acosh(", label: "acosh", description: "Insert inverse hyperbolic cosine function" },
	{ token: "atanh(", label: "atanh", description: "Insert inverse hyperbolic tangent function" },
	{ token: "deg(", label: "deg", description: "Convert radians to degrees" },
	{ token: "rad(", label: "rad", description: "Convert degrees to radians" },
	{ token: "sign(", label: "sign", description: "Insert sign function" },
	{ token: "inv(", label: "1/x", description: "Insert reciprocal function" },
	{ token: "min(", label: "min", description: "Insert minimum function" },
	{ token: "max(", label: "max", description: "Insert maximum function" },
	{ token: "sum(", label: "sum", description: "Insert sum function" },
	{ token: "product(", label: "product", description: "Insert product function" },
	{ token: "mean(", label: "mean", description: "Insert mean function" },
	{ token: "median(", label: "median", description: "Insert median function" },
	{ token: "variance(", label: "variance", description: "Insert population variance function" },
	{ token: "stdev(", label: "stdev", description: "Insert population standard deviation function" },
	{ token: "pow(", label: "pow", description: "Insert power function" },
	{ token: "root(", label: "root", description: "Insert nth-root function" },
	{ token: "hypot(", label: "hypot", description: "Insert hypotenuse function" },
	{ token: "atan2(", label: "atan2", description: "Insert two-argument inverse tangent" },
	{ token: "clamp(", label: "clamp", description: "Insert clamp function" },
	{ token: "perm(", label: "nPr", description: "Insert permutation function" },
	{ token: "comb(", label: "nCr", description: "Insert combination function" },
] as const;

const multiArgumentFunctions = new Set(["min(", "max(", "sum(", "product(", "mean(", "median(", "variance(", "stdev(", "pow(", "root(", "hypot(", "atan2(", "clamp(", "perm(", "comb("]);


const keypadTokens = [
	...(["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"] as const).map((digit) => ({ token: digit, label: digit, description: `Digit ${digit}` })),
	{ token: ".", label: ".", description: "Decimal point" },
	{ token: "(", label: "(", description: "Open parenthesis" },
	{ token: ")", label: ")", description: "Close parenthesis" },
	{ token: ",", label: ",", description: "Function argument separator" },
	{ token: "+", label: "+", description: "Add" },
	{ token: "-", label: "−", description: "Subtract" },
	{ token: "*", label: "×", description: "Multiply" },
	{ token: "/", label: "÷", description: "Divide" },
	{ token: "%", label: "%", description: "Remainder" },
	{ token: "^", label: "xʸ", description: "Power" },
	{ token: "!", label: "!", description: "Factorial" },
	{ token: "pi", label: "π", description: "Pi constant" },
	{ token: "tau", label: "τ", description: "Tau constant" },
	{ token: "e", label: "e", description: "Euler's number" },
	{ token: "phi", label: "φ", description: "Golden ratio constant" },
	{ token: "ans", label: "Ans", description: "Previous answer" },
	{ token: "c", label: "c", description: "Speed of light in metres per second" },
	{ token: "g0", label: "g₀", description: "Standard gravity constant" },
	{ token: "h", label: "h", description: "Planck constant" },
	{ token: "kb", label: "kᵦ", description: "Boltzmann constant" },
	{ token: "na", label: "Nₐ", description: "Avogadro constant" },
] as const;

const ScientificCalculator = () => {
	const [expression, setExpression] = useState("");
	const [angleUnit, setAngleUnit] = useState<AngleUnit>("degrees");
	const [outputBase, setOutputBase] = useState<OutputBase>("decimal");
	const [lastAnswer, setLastAnswer] = useState(0);
	const [memory, setMemory] = useState(0);
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [error, setError] = useState("");
	const calculation = useMemo(() => {
		if (!expression.trim()) return null;
		try {
			return { result: evaluateScientificExpression(expression, angleUnit, lastAnswer), error: "" };
		} catch (calculationError) {
			return { result: null, error: calculationError instanceof Error ? calculationError.message : "Check this expression." };
		}
	}, [expression, angleUnit, lastAnswer]);

	const updateExpression = (value: string) => {
		setExpression(value);
		setError("");
	};
	const insertToken = (token: string) => updateExpression(`${expression}${token}`);
	const insertFunction = (token: string) => {
		if (expression.trim() && calculation?.result !== null && calculation?.result !== undefined) {
			updateExpression(multiArgumentFunctions.has(token) ? `${token}${expression},` : `${token}${expression})`);
		} else insertToken(token);
	};
	const evaluate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!calculation || calculation.result === null) {
			setError(calculation?.error || "Enter a calculation first.");
			return;
		}
		setLastAnswer(calculation.result);
		setHistory((previousHistory) => [{ expression, result: calculation.result }, ...previousHistory].slice(0, 8));
		setError("");
	};
	const currentResult = calculation?.result ?? null;

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<label className="block min-w-[220px] flex-1 text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-expression">Calculation
					<input className="mt-2 block h-12 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-base font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-expression" inputMode="text" onChange={(event) => updateExpression(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Try sin(30) + 2^3" value={expression} />
				</label>
				<label className="block min-w-[145px] text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-angle-unit">Angles
					<select className="mt-2 block h-12 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-angle-unit" value={angleUnit} onChange={(event) => { setAngleUnit(event.target.value as AngleUnit); setError(""); }}>
						<option value="degrees">Degrees</option>
						<option value="radians">Radians</option>
					</select>
				</label>
				<label className="block min-w-[145px] text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-output-base">Number base
					<select className="mt-2 block h-12 w-full cursor-pointer border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-output-base" value={outputBase} onChange={(event) => setOutputBase(event.target.value as OutputBase)}>
						{outputBases.map((base) => <option key={base.id} value={base.id}>{base.label}</option>)}
					</select>
				</label>
			</div>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Scientific functions">
				{functionButtons.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertFunction(token)} type="button">{label}</button>)}
			</div>
			<details className="border border-line bg-[#faf9f5] px-4 py-3">
				<summary className="cursor-pointer text-xs font-semibold text-[#50534c] outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent">More functions: hyperbolic, statistics, and combinatorics</summary>
				<div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Advanced scientific functions">
					{advancedFunctionButtons.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-surface px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertFunction(token)} type="button">{label}</button>)}
				</div>
			</details>
			<div className="grid grid-cols-5 gap-2 max-[520px]:grid-cols-3" role="group" aria-label="Scientific keypad">
				{keypadTokens.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertToken(token)} type="button">{label}</button>)}
				<button aria-label="Delete last character" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(expression.slice(0, -1))} type="button">DEL</button>
				<button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression("")} type="button">Clear</button>
				<button aria-label="Add current result to memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" disabled={currentResult === null} onClick={() => { if (currentResult !== null) setMemory((currentMemory) => currentMemory + currentResult); }} type="button">M+</button>
				<button aria-label="Recall memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(String(memory))} type="button">MR</button>
				<button aria-label="Clear memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setMemory(0)} type="button">MC</button>
			</div>
			{(error || calculation?.error) && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error || calculation?.error}</p>}
			<form className="flex flex-col gap-4" onSubmit={evaluate}>
				<section className="border-l-2 border-accent bg-[#f5f3eb] p-5" aria-label="Scientific calculator result" aria-live="polite">
					<div className="flex items-center justify-between gap-3">
						<p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Result</p>
						{lastAnswer !== 0 && <p className="m-0 text-[10px] text-muted">Ans: {formatCalculatorDisplay(lastAnswer)}</p>}
					</div>
					<p className="mb-0 mt-2 break-words font-serif text-[clamp(32px,6vw,48px)] leading-none tracking-[-.03em] text-forest">{currentResult === null || calculation?.error ? "—" : formatCalculatorDisplay(currentResult)}</p>
					{outputBase !== "decimal" && <p className="mb-0 mt-3 break-all font-mono text-xs text-[#60635b]">{outputBases.find((base) => base.id === outputBase)?.label}: {currentResult === null || calculation?.error ? "—" : Number.isSafeInteger(currentResult) ? `${currentResult.toString(outputBases.find((base) => base.id === outputBase)!.radix).toUpperCase()}${outputBase === "hexadecimal" ? "₁₆" : outputBase === "binary" ? "₂" : "₈"}` : "Use a whole-number result within the safe integer range."}</p>}
				</section>
				<button className="min-h-11 cursor-pointer self-end bg-forest px-6 text-sm font-semibold text-white transition-colors hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="submit">Calculate =</button>
			</form>
			{history.length > 0 && <section className="border-t border-line pt-4" aria-labelledby="scientific-history-title">
				<div className="mb-3 flex items-center justify-between gap-4">
					<h2 className="m-0 font-mono text-[10px] font-semibold uppercase tracking-[.08em] text-muted" id="scientific-history-title">Recent calculations</h2>
					<button className="cursor-pointer text-[11px] text-accent-dark underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setHistory([])} type="button">Clear history</button>
				</div>
				<ol className="m-0 flex list-none flex-col gap-2 p-0">{history.map((item, index) => <li key={`${item.expression}-${item.result}-${index}`}><button className="flex w-full cursor-pointer items-center justify-between gap-4 border border-line bg-surface px-3 py-2 text-left hover:bg-[#f7f5ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(String(item.result))} type="button"><span className="min-w-0 truncate font-mono text-[11px] text-muted">{item.expression}</span><span className="shrink-0 font-mono text-xs text-forest">{formatCalculatorDisplay(item.result)}</span></button></li>)}</ol>
			</section>}
			<p className="m-0 text-[11px] leading-relaxed text-muted">Supports arithmetic, powers, factorials, SI constants, previous answers, trigonometric and hyperbolic functions, logarithms, statistics, combinatorics, and decimal, binary, octal, or hexadecimal output for safe whole numbers. Use commas between function arguments. Trigonometric functions follow the selected angle unit.</p>
		</div>
	);
};

export default ScientificCalculator;
