"use client";

import { SelectField } from "@/components/select-field";

import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { calculateDefiniteIntegral, evaluateScientificExpression } from "@/features/calculators/calculator-utils";
import { CalculatorNumberField, formatCalculatorDisplay } from "@/features/calculators/calculator-shared";

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
	{ token: "log10(", label: "log₁₀", description: "Insert base-10 logarithm" },
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
	{ token: "samplevariance(", label: "sample var", description: "Insert sample variance function" },
	{ token: "stdev(", label: "stdev", description: "Insert population standard deviation function" },
	{ token: "samplestdev(", label: "sample SD", description: "Insert sample standard deviation function" },
	{ token: "wmean(", label: "weighted mean", description: "Insert weighted mean function" },
	{ token: "gcd(", label: "GCD", description: "Insert greatest common divisor function" },
	{ token: "lcm(", label: "LCM", description: "Insert least common multiple function" },
	{ token: "pow(", label: "pow", description: "Insert power function" },
	{ token: "root(", label: "root", description: "Insert nth-root function" },
	{ token: "hypot(", label: "hypot", description: "Insert hypotenuse function" },
	{ token: "atan2(", label: "atan2", description: "Insert two-argument inverse tangent" },
	{ token: "clamp(", label: "clamp", description: "Insert clamp function" },
	{ token: "perm(", label: "nPr", description: "Insert permutation function" },
	{ token: "comb(", label: "nCr", description: "Insert combination function" },
] as const;

const multiArgumentFunctions = new Set(["min(", "max(", "sum(", "product(", "mean(", "median(", "variance(", "stdev(", "samplevariance(", "samplestdev(", "wmean(", "gcd(", "lcm(", "pow(", "root(", "hypot(", "atan2(", "clamp(", "perm(", "comb("]);
const functionUsage: Record<string, string> = {
	"sin(": "Enter an angle in the parentheses; sin(30) = 0.5 when Degrees is selected.",
	"cos(": "Enter an angle in the parentheses; cos(60) = 0.5 when Degrees is selected.",
	"tan(": "Enter an angle in the parentheses; tan(45) = 1 when Degrees is selected.",
	"asin(": "Enter a value from -1 to 1; asin(0.5) returns 30° in Degrees mode.",
	"acos(": "Enter a value from -1 to 1; acos(0.5) returns 60° in Degrees mode.",
	"atan(": "Enter a value; atan(1) returns 45° in Degrees mode.",
	"sqrt(": "Enter a number that is zero or greater; sqrt(9) = 3.",
	"cbrt(": "Enter any real number; cbrt(-8) = -2.",
	"abs(": "Enter a number to get its non-negative magnitude; abs(-5) = 5.",
	"ln(": "Enter a number greater than zero for its natural logarithm; ln(e) = 1.",
	"log(": "Enter a positive number for base-10 log, or log(value, base) for another base; log(100) = 2.",
	"log10(": "Enter a positive number for its base-10 logarithm; log10(100) = 2.",
	"log2(": "Enter a number greater than zero for its base-2 logarithm; log2(8) = 3.",
	"exp(": "Enter an exponent to calculate e^x; exp(1) = e.",
	"floor(": "Enter a number to round down; floor(2.8) = 2.",
	"ceil(": "Enter a number to round up; ceil(2.1) = 3.",
	"round(": "Enter a number and optional decimal places; halfway cases round away from zero, as in round(1.005, 2) = 1.01.",
	"asec(": "Enter a value with absolute magnitude at least 1; asec(2) = 60° in Degrees mode.",
	"acsc(": "Enter a value with absolute magnitude at least 1; acsc(2) = 30° in Degrees mode.",
	"acot(": "Enter a value; acot(1) = 45° in Degrees mode.",
	"sec(": "Enter an angle where cosine is nonzero; sec(60) = 2 in Degrees mode.",
	"csc(": "Enter an angle where sine is nonzero; csc(30) = 2 in Degrees mode.",
	"cot(": "Enter an angle where sine is nonzero; cot(45) = 1 in Degrees mode.",
	"sinh(": "Enter a real number for hyperbolic sine; sinh(0) = 0.",
	"cosh(": "Enter a real number for hyperbolic cosine; cosh(0) = 1.",
	"tanh(": "Enter a real number for hyperbolic tangent; tanh(0) = 0.",
	"sech(": "Enter a real number for hyperbolic secant; sech(0) = 1.",
	"csch(": "Enter a nonzero real number for hyperbolic cosecant.",
	"coth(": "Enter a nonzero real number for hyperbolic cotangent.",
	"asinh(": "Enter a real number for inverse hyperbolic sine; angles are not involved.",
	"acosh(": "Enter a number greater than or equal to 1 for inverse hyperbolic cosine.",
	"atanh(": "Enter a number strictly between -1 and 1 for inverse hyperbolic tangent.",
	"deg(": "Enter radians to convert them to degrees; deg(pi) = 180.",
	"rad(": "Enter degrees to convert them to radians; rad(180) = pi.",
	"sign(": "Enter a number to return -1, 0, or 1 according to its sign.",
	"inv(": "Enter a nonzero number to calculate its reciprocal; inv(4) = 0.25.",
	"min(": "Enter two or more comma-separated values; min(2, 5, 1) = 1.",
	"max(": "Enter two or more comma-separated values; max(2, 5, 1) = 5.",
	"sum(": "Enter comma-separated values to add; sum(1, 2, 3) = 6.",
	"product(": "Enter comma-separated values to multiply; product(2, 3, 4) = 24.",
	"mean(": "Enter comma-separated values for their arithmetic average; mean(1, 2, 3) = 2.",
	"median(": "Enter comma-separated values to find the middle value; median(1, 9, 2) = 2.",
	"variance(": "Enter comma-separated values for population variance; variance(1, 2, 3) = 2/3.",
	"samplevariance(": "Enter at least two sample values; samplevariance(1, 2, 3) = 1.",
	"stdev(": "Enter comma-separated values for population standard deviation; stdev(1, 2, 3) = sqrt(2/3).",
	"samplestdev(": "Enter at least two sample values; samplestdev(1, 2, 3) = 1.",
	"wmean(": "Enter value, weight pairs, such as wmean(80, 2, 90, 1) = 83.33. Weights must be nonnegative.",
	"gcd(": "Enter two or more safe whole numbers; gcd(18, 24) = 6.",
	"lcm(": "Enter two or more safe whole numbers; lcm(6, 8) = 24.",
	"pow(": "Enter a base and exponent separated by a comma; pow(2, 3) = 8.",
	"root(": "Enter a value and root index separated by a comma; root(27, 3) = 3.",
	"hypot(": "Enter two or more side lengths separated by commas; hypot(3, 4) = 5.",
	"atan2(": "Enter y first and x second; atan2(1, 1) = 45° in Degrees mode.",
	"clamp(": "Enter value, minimum, maximum; clamp(12, 0, 10) = 10.",
	"perm(": "Enter whole-number n and r with 0 ≤ r ≤ n ≤ 1000; perm(5, 2) = 20.",
	"comb(": "Enter whole-number n and r with 0 ≤ r ≤ n ≤ 1000; comb(5, 2) = 10.",
};

const operationGuideGroups = [
	{ title: "Trigonometry and angles", steps: [
		"sin(x) — sine; sin(30) = 0.5 in Degrees.", "cos(x) — cosine; cos(60) = 0.5 in Degrees.", "tan(x) — tangent; tan(45) = 1 in Degrees; undefined at odd multiples of 90°.",
		"sec(x), csc(x), cot(x) — reciprocal cosine, sine, and tangent; sec(60) = 2, csc(30) = 2, cot(45) = 1 in Degrees.",
		"asin(x), acos(x), atan(x) — inverse trig; asin(0.5) = 30°, acos(0.5) = 60°, atan(1) = 45° in Degrees.",
		"asec(x), acsc(x), acot(x) — inverse reciprocal trig; asec(2) = 60°, acsc(2) = 30°, acot(1) = 45° in Degrees.",
		"atan2(y, x) — angle of the point (x, y), returned in the selected angle unit; atan2(1, 1) = 45° in Degrees.",
		"deg(x), rad(x) — convert radians to degrees, or degrees to radians, regardless of the angle selector.",
	] },
	{ title: "Hyperbolic functions", steps: [
		"sinh(x), cosh(x), tanh(x) — hyperbolic sine, cosine, and tangent; sinh(0) = 0, cosh(0) = 1, tanh(0) = 0.",
		"sech(x), csch(x), coth(x) — reciprocal hyperbolic functions; sech(0) = 1 (csch and coth are undefined at zero).",
		"asinh(x), acosh(x), atanh(x) — inverse hyperbolic functions. Angles are not involved; asinh(sinh(1)) = 1.",
	] },
	{ title: "Powers, roots, and logs", steps: [
		"x^y or pow(x, y) — raise x to power y; enter 2^3 for 8.",
		"sqrt(x), cbrt(x), root(x, n) — square root (sqrt(9) = 3), cube root (cbrt(-8) = -2), or nth root (root(27, 3) = 3).",
		"!(postfix) — factorial; 5! = 120 and only whole numbers from 0 through 170 are supported.",
		"ln(x) — natural log (ln(e) = 1); log(x) or log10(x) — base-10 log (log(100) = 2); log2(x) — base-2 log; log(x, b) — log base b.",
		"exp(x) — e raised to x; inv(x) — reciprocal 1/x; abs(x) — absolute value.",
	] },
	{ title: "Rounding and comparisons", steps: [
		"floor(x) — round down (floor(2.8) = 2); ceil(x) — round up (ceil(2.1) = 3); round(x) — nearest integer, with ties away from zero (round(2.4) = 2, round(-2.5) = -3); sign(x) — -1, 0, or 1.",
		"min(a, b, ...) and max(a, b, ...) — smallest or largest supplied value; min(2, 5, 1) = 1.",
		"clamp(x, low, high) — keep x within the inclusive range; clamp(12, 0, 10) = 10.",
		"hypot(a, b, ...) — square root of the sum of squares; hypot(3, 4) = 5.",
	] },
	{ title: "Statistics and combinatorics", steps: [
		"sum(a, b, ...) — add values (sum(1, 2, 3) = 6); product(a, b, ...) — multiply them (product(2, 3, 4) = 24).",
		"mean(a, b, ...) — arithmetic average (mean(1, 2, 3) = 2); median(a, b, ...) — middle value after sorting (median(1, 9, 2) = 2).",
		"variance(a, b, ...) and stdev(a, b, ...) — population variance and population standard deviation; samplevariance(a, b, ...) and samplestdev(a, b, ...) use the sample denominator and require at least two values.",
		"wmean(value, weight, ...) — weighted average from value, weight pairs; weights must be nonnegative and have a positive sum.",
		"gcd(a, b, ...) and lcm(a, b, ...) — greatest common divisor and least common multiple of safe whole numbers.",
		"perm(n, r) (button nPr) — ordered arrangements (perm(5, 2) = 20); comb(n, r) (button nCr) — unordered selections (comb(5, 2) = 10). n and r must be whole numbers with 0 ≤ r ≤ n ≤ 1000.",
	] },
	{ title: "Constants and number bases", steps: [
		"pi, tau, e, phi, ans — π, 2π, Euler’s number, the golden ratio, and the last submitted answer.",
		"c, g0, h, kb, na — speed of light, standard gravity, Planck, Boltzmann, and Avogadro constants in SI units.",
		"The Number base selector shows decimal, binary, octal, or hexadecimal for safe whole-number results; fractions remain shown in decimal.",
	] },
	{ title: "Memory and history", steps: [
		"M+ adds the current live result to calculator memory; MR replaces the expression with the stored value; MC clears memory.",
		"Calculate saves the expression and result in Recent calculations. Select a history row to reuse its result; Clear history removes the list.",
	] },

] as const;

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
	const [selectedFunctionHint, setSelectedFunctionHint] = useState("");
	const expressionInputRef = useRef<HTMLInputElement>(null);
	const pendingExpressionCaret = useRef<number | null>(null);
	const [angleUnit, setAngleUnit] = useState<AngleUnit>("degrees");
	const [outputBase, setOutputBase] = useState<OutputBase>("decimal");
	const [lastAnswer, setLastAnswer] = useState(0);
	const [memory, setMemory] = useState(0);
	const [memoryIsSet, setMemoryIsSet] = useState(false);
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [error, setError] = useState("");
	const [integrand, setIntegrand] = useState("");
	const [integralLowerBound, setIntegralLowerBound] = useState("");
	const [integralUpperBound, setIntegralUpperBound] = useState("");
	const [integralResult, setIntegralResult] = useState<number | null>(null);
	const [integralError, setIntegralError] = useState("");
	const calculation = useMemo(() => {
		if (!expression.trim()) return null;
		try {
			return { result: evaluateScientificExpression(expression, angleUnit, lastAnswer), error: "" };
		} catch (calculationError) {
			return { result: null, error: calculationError instanceof Error ? calculationError.message : "Check this expression." };
		}
	}, [expression, angleUnit, lastAnswer]);

	useLayoutEffect(() => {
		if (pendingExpressionCaret.current === null || !expressionInputRef.current) return;
		expressionInputRef.current.focus();
		expressionInputRef.current.setSelectionRange(pendingExpressionCaret.current, pendingExpressionCaret.current);
		pendingExpressionCaret.current = null;
	}, [expression]);

	const updateExpression = (value: string) => {
		setExpression(value);
		setError("");
		pendingExpressionCaret.current = null;
		if (calculation?.result !== null && calculation?.result !== undefined || !value.trim()) setSelectedFunctionHint("");
	};
	const insertToken = (token: string) => updateExpression(`${expression}${token}`);
	const insertFunction = (token: string) => {
		const hasValidExpression = expression.trim() !== "" && calculation?.result !== null && calculation?.result !== undefined;
		const isMultiArgument = multiArgumentFunctions.has(token);
		const nextExpression = hasValidExpression
			? isMultiArgument ? `${token}${expression}, )` : `${token}${expression})`
			: isMultiArgument ? `${token}, )` : `${token})`;
		pendingExpressionCaret.current = hasValidExpression
			? isMultiArgument ? `${token}${expression}, `.length : nextExpression.length
			: token.length;
		setExpression(nextExpression);
		setError("");
		const usage = functionUsage[token] ?? "Enter the required value or values inside the parentheses, then calculate.";
		setSelectedFunctionHint(hasValidExpression && isMultiArgument ? `${usage} Your current expression fills the first argument; complete the remaining slot(s) after the comma.` : usage);
	};
	const resetIntegralResult = () => {
		setIntegralResult(null);
		setIntegralError("");
	};
	const integrate = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!integrand.trim() || integralLowerBound.trim() === "" || integralUpperBound.trim() === "") {
			setIntegralResult(null);
			setIntegralError("Enter an integrand and both bounds.");
			return;
		}
		try {
			const result = calculateDefiniteIntegral(integrand, Number(integralLowerBound), Number(integralUpperBound), angleUnit, lastAnswer);
			setIntegralResult(result);
			setIntegralError("");
			setLastAnswer(result);
			setHistory((previousHistory) => [{ expression: `Integral of ${integrand} from ${integralLowerBound} to ${integralUpperBound}`, result }, ...previousHistory].slice(0, 8));
		} catch (integrationError) {
			setIntegralResult(null);
			setIntegralError(integrationError instanceof Error ? integrationError.message : "Could not estimate this integral.");
		}
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
	const incompleteFunctionError = selectedFunctionHint && calculation?.error && /expects (?:\d+|at least \d+|\d+ to \d+) arguments?|Check the calculation|closing parenthesis|Unexpected character/u.test(calculation.error);
	const visibleError = error || (incompleteFunctionError ? "" : calculation?.error ?? "");
	const addCurrentResultToMemory = () => {
		if (currentResult === null) return;
		const nextMemory = memory + currentResult;
		if (!Number.isFinite(nextMemory)) {
			setError("That value would exceed the calculator memory range.");
			return;
		}
		setMemory(nextMemory);
		setMemoryIsSet(true);
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<label className="block min-w-[220px] flex-1 text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-expression">Calculation
					<input className="mt-2 block h-12 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-base font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="scientific-expression" inputMode="text" onChange={(event) => updateExpression(event.target.value)} ref={expressionInputRef} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Try sin(30) + 2^3" value={expression} />
				</label>
				<label className="block min-w-[145px] text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-angle-unit">Angles
					<SelectField containerClassName="relative mt-2 block w-full" className="h-12 cursor-pointer" id="scientific-angle-unit" value={angleUnit} onChange={(event) => { setAngleUnit(event.target.value as AngleUnit); setError(""); resetIntegralResult(); }}>
						<option value="degrees">Degrees</option>
						<option value="radians">Radians</option>
					</SelectField>
				</label>
				<label className="block min-w-[145px] text-xs font-semibold text-[#3c3d37]" htmlFor="scientific-output-base">Number base
					<SelectField containerClassName="relative mt-2 block w-full" className="h-12 cursor-pointer" id="scientific-output-base" value={outputBase} onChange={(event) => setOutputBase(event.target.value as OutputBase)}>
						{outputBases.map((base) => <option key={base.id} value={base.id}>{base.label}</option>)}
					</SelectField>
				</label>
			</div>
			{selectedFunctionHint && <p className="m-0 border-l-2 border-accent bg-[#f5f3eb] px-3 py-2 text-[11px] leading-relaxed text-[#50534c]" role="status" aria-live="polite">{selectedFunctionHint}</p>}
			<div className="flex flex-wrap gap-2" role="group" aria-label="Scientific functions">
				{functionButtons.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertFunction(token)} title={functionUsage[token]} type="button">{label}</button>)}
			</div>
			<details className="border border-line bg-[#faf9f5] px-4 py-3">
				<summary className="cursor-pointer text-xs font-semibold text-[#50534c] outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent">More functions: hyperbolic, statistics, and combinatorics</summary>
				<div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Advanced scientific functions">
					{advancedFunctionButtons.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-surface px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertFunction(token)} title={functionUsage[token]} type="button">{label}</button>)}
				</div>
			</details>
			<details className="border border-line bg-[#faf9f5] px-4 py-3">
				<summary className="cursor-pointer text-xs font-semibold text-[#50534c] outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent">Operation guide and examples</summary>
				<div className="mt-3 flex flex-col gap-3 text-[11px] leading-relaxed text-[#60635b]">
					<p className="m-0"><strong className="text-ink">How to use:</strong> type an expression or choose a function. With an empty or incomplete expression, a function inserts its parentheses and places the cursor in the first input slot. If a valid expression is already entered, a one-input function wraps it; a multi-input function uses it as the first argument and places the cursor in the next slot. For a blank multi-input function, enter the first value, move right past the comma, and enter the rest. Each function button shows a short usage hint when selected. Press Calculate to save a result to history and Ans.</p>
					<p className="m-0">Use * for multiplication, / for division, % for remainder, ^ for powers, ! after a number for factorial, and parentheses to group. Multiplication can also be implied, as in 2pi or 2(3 + 4). The angle selector affects trig and inverse-trig functions; it does not affect hyperbolic functions.</p>
					{operationGuideGroups.map((group) => <details className="border-t border-line pt-2" key={group.title}>
						<summary className="cursor-pointer font-semibold text-forest outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent">{group.title}</summary>
						<ul className="mb-1 mt-2 flex flex-col gap-1.5 pl-5">{group.steps.map((step) => <li key={step}>{step}</li>)}</ul>
					</details>)}
				</div>
			</details>
			<div className="grid grid-cols-5 gap-2 max-[520px]:grid-cols-3" role="group" aria-label="Scientific keypad">
				{keypadTokens.map(({ token, label, description }) => <button aria-label={description} className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" key={token} onClick={() => insertToken(token)} type="button">{label}</button>)}
				<button aria-label="Delete last character" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression(expression.slice(0, -1))} type="button">DEL</button>
				<button className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => updateExpression("")} type="button">Clear</button>
				<button aria-label="Add current result to memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" disabled={currentResult === null} onClick={addCurrentResultToMemory} type="button">M+</button>
				<button aria-label="Recall memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" disabled={!memoryIsSet} onClick={() => updateExpression(String(memory))} type="button">MR</button>
				<button aria-label="Clear memory" className="min-h-10 cursor-pointer border border-line bg-[#f0efe9] px-3 text-xs text-ink hover:border-[#aaa69a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50" disabled={!memoryIsSet} onClick={() => { setMemory(0); setMemoryIsSet(false); }} type="button">MC</button>
			</div>
			{memoryIsSet && <p className="m-0 text-[10px] text-muted">Stored memory: {formatCalculatorDisplay(memory)}</p>}
			{visibleError && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{visibleError}</p>}
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
			<details className="border border-line bg-[#faf9f5] px-4 py-3">
				<summary className="cursor-pointer text-xs font-semibold text-[#50534c] outline-2 outline-offset-2 outline-transparent focus-visible:outline-accent">Numerical integration (definite integral)</summary>
				<div className="mt-3 flex flex-col gap-4">
					<p className="m-0 text-[11px] leading-relaxed text-[#60635b]">Estimate the area under a continuous function between two bounds. Enter the integrand using x (for example, x^2 or sin(x)), add the lower and upper bounds, choose angle units above if needed, then calculate. This uses adaptive Simpson’s numerical method; it does not find a symbolic antiderivative. The result is saved to Ans and Recent calculations.</p>
					<form className="flex flex-col gap-4" onSubmit={integrate}>
						<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="integral-expression">Integrand f(x)
							<input className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="integral-expression" inputMode="text" onChange={(event) => { setIntegrand(event.target.value); resetIntegralResult(); }} placeholder="x^2 + sin(x)" value={integrand} />
						</label>
						<div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
							<CalculatorNumberField id="integral-lower-bound" label="Lower bound" value={integralLowerBound} onChange={(value) => { setIntegralLowerBound(value); resetIntegralResult(); }} placeholder="0" />
							<CalculatorNumberField id="integral-upper-bound" label="Upper bound" value={integralUpperBound} onChange={(value) => { setIntegralUpperBound(value); resetIntegralResult(); }} placeholder="1" />
						</div>
						<button className="min-h-11 cursor-pointer self-start bg-forest px-5 text-xs font-semibold text-white transition-colors hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="submit">Calculate definite integral</button>
					</form>
					{integralError && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{integralError}</p>}
					{integralResult !== null && <section className="border-l-2 border-accent bg-[#f5f3eb] p-4" aria-label="Numerical integral result" aria-live="polite"><p className="m-0 font-mono text-[10px] uppercase tracking-[.08em] text-muted">Approximate definite integral</p><p className="mb-0 mt-2 break-words font-serif text-2xl text-forest">{formatCalculatorDisplay(integralResult)}</p></section>}
					<p className="m-0 text-[10px] leading-relaxed text-muted">Results are approximate. Discontinuities, singularities, or very oscillatory functions may not converge; use a suitable interval and verify critical results independently. Reversing the bounds reverses the sign.</p>
				</div>
			</details>
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
