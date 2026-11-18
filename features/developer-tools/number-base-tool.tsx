"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import {
	bitwiseOperation,
	convertNumberBase,
	type BitwiseOperator,
} from "@/features/developer-tools/number-base-utils";
import {
	ErrorNote,
	SegmentedControl,
	StatGrid,
	ToolPanel,
	fieldClassName,
	hintClassName,
	labelClassName,
	selectClassName,
} from "@/features/developer-tools/tool-ui";

type Mode = "convert" | "bitwise";

const operators: { id: BitwiseOperator; label: string }[] = [
	{ id: "and", label: "AND" },
	{ id: "or", label: "OR" },
	{ id: "xor", label: "XOR" },
	{ id: "shiftLeft", label: "Shift left" },
	{ id: "shiftRight", label: "Shift right" },
];

export const NumberBaseTool = () => {
	const [mode, setMode] = useState<Mode>("convert");
	const [input, setInput] = useState("255");
	const [base, setBase] = useState("10");
	const [customBase, setCustomBase] = useState("16");
	const [left, setLeft] = useState("0xFF");
	const [right, setRight] = useState("0b1010");
	const [operator, setOperator] = useState<BitwiseOperator>("and");

	const conversion = useMemo(() => {
		if (mode !== "convert") return { data: null, error: "" };
		try {
			return { data: convertNumberBase(input, Number(base), Number(customBase)), error: "" };
		} catch (error) {
			return { data: null, error: error instanceof Error ? error.message : "Could not convert this number." };
		}
	}, [mode, input, base, customBase]);

	const bitwise = useMemo(() => {
		if (mode !== "bitwise") return { data: null, error: "" };
		try {
			return { data: bitwiseOperation(left, right, operator), error: "" };
		} catch (error) {
			return { data: null, error: error instanceof Error ? error.message : "Could not run this operation." };
		}
	}, [mode, left, right, operator]);

	return (
		<ToolPanel>
			<SegmentedControl<Mode>
				label="Mode"
				options={[
					{ id: "convert", label: "Base converter" },
					{ id: "bitwise", label: "Bitwise calculator" },
				]}
				value={mode}
				onChange={setMode}
			/>
			{mode === "convert" ? (
				<>
					<div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[700px]:grid-cols-1">
						<label className={labelClassName} htmlFor="base-input">
							Number
							<input
								className={`${fieldClassName} font-mono`}
								id="base-input"
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder="255, 0xFF, 0b1010"
								spellCheck={false}
							/>
						</label>
						<div>
							<label className={labelClassName} htmlFor="base-from">
								Input base
							</label>
							<SelectField className={selectClassName} containerClassName="" id="base-from" value={base} onChange={(event) => setBase(event.target.value)}>
								<option value="2">Binary (2)</option>
								<option value="8">Octal (8)</option>
								<option value="10">Decimal (10)</option>
								<option value="16">Hexadecimal (16)</option>
								<option value="36">Base 36</option>
							</SelectField>
						</div>
						<label className={labelClassName} htmlFor="base-custom">
							Custom base
							<input
								className={fieldClassName}
								id="base-custom"
								value={customBase}
								onChange={(event) => setCustomBase(event.target.value)}
								inputMode="numeric"
							/>
						</label>
					</div>
					<ErrorNote message={conversion.error} />
					{conversion.data && (
						<>
							<StatGrid
								items={[
									{ label: "Decimal", value: conversion.data.decimal },
									{ label: "Hexadecimal", value: conversion.data.hex },
									{ label: "Binary", value: conversion.data.binary },
									{ label: "Octal", value: conversion.data.octal },
									{ label: `Base ${customBase}`, value: conversion.data.custom },
									{ label: "Base 36", value: conversion.data.base36 },
									{ label: "Grouped bits", value: conversion.data.bits },
									{ label: "Bytes needed", value: conversion.data.byteLength },
								]}
							/>
							<p className={hintClassName}>
								The 0x, 0b, and 0o prefixes override the selected input base. Underscores are ignored, and negative values keep their sign.
							</p>
						</>
					)}
				</>
			) : (
				<>
					<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[700px]:grid-cols-1">
						<label className={labelClassName} htmlFor="bitwise-left">
							Left operand
							<input
								className={`${fieldClassName} font-mono`}
								id="bitwise-left"
								value={left}
								onChange={(event) => setLeft(event.target.value)}
								placeholder="0xFF"
								spellCheck={false}
							/>
						</label>
						<div>
							<label className={labelClassName} htmlFor="bitwise-operator">
								Operation
							</label>
							<SelectField
								className={selectClassName}
								id="bitwise-operator"
								value={operator}
								onChange={(event) => setOperator(event.target.value as BitwiseOperator)}
							>
								{operators.map((item) => (
									<option key={item.id} value={item.id}>
										{item.label}
									</option>
								))}
							</SelectField>
						</div>
						<label className={labelClassName} htmlFor="bitwise-right">
							Right operand
							<input
								className={`${fieldClassName} font-mono`}
								id="bitwise-right"
								value={right}
								onChange={(event) => setRight(event.target.value)}
								placeholder="0b1010"
								spellCheck={false}
							/>
						</label>
					</div>
					<ErrorNote message={bitwise.error} />
					{bitwise.data && (
						<StatGrid
							items={[
								{ label: "Decimal", value: bitwise.data.decimal },
								{ label: "Hexadecimal", value: `0x${bitwise.data.hex}` },
								{ label: "Binary", value: bitwise.data.binary },
							]}
						/>
					)}
					<p className={hintClassName}>Operands accept decimal, 0x hex, 0b binary, and 0o octal notation up to 64 bits.</p>
				</>
			)}
		</ToolPanel>
	);
};
