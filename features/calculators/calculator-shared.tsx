"use client";

import { useLayoutEffect, useRef, useState } from "react";

export const formatCalculatorDisplay = (value: number) => new Intl.NumberFormat("en", {
	maximumSignificantDigits: 14,
}).format(Object.is(value, -0) ? 0 : value);

const normalizeEditableNumber = (value: string) => {
	const withoutSeparators = value.replaceAll(",", "");
	const isNegative = withoutSeparators.startsWith("-");
	const numericCharacters = withoutSeparators.replace(/[^\d.]/gu, "");
	const [integerPart = "", ...fractionParts] = numericCharacters.split(".");
	const hasDecimalPoint = numericCharacters.includes(".");
	return `${isNegative ? "-" : ""}${integerPart}${hasDecimalPoint ? `.${fractionParts.join("")}` : ""}`;
};

const formatEditableNumber = (value: string) => {
	const isNegative = value.startsWith("-");
	const unsignedValue = isNegative ? value.slice(1) : value;
	const [integerPart = "", ...fractionParts] = unsignedValue.split(".");
	const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
	return `${isNegative ? "-" : ""}${groupedInteger}${unsignedValue.includes(".") ? `.${fractionParts.join("")}` : ""}`;
};

const getFormattedCaretPosition = (formattedValue: string, rawCharacterCount: number) => {
	let position = 0;
	let countedCharacters = 0;
	while (position < formattedValue.length && countedCharacters < rawCharacterCount) {
		if (formattedValue[position] !== ",") countedCharacters += 1;
		position += 1;
	}
	return position;
};

type CalculatorNumberFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
};

export const CalculatorNumberField = ({ id, label, value, onChange, placeholder = "0" }: CalculatorNumberFieldProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const pendingCaretPosition = useRef<number | null>(null);
	const [formatRevision, setFormatRevision] = useState(0);
	const formattedValue = formatEditableNumber(value);

	useLayoutEffect(() => {
		if (pendingCaretPosition.current === null || !inputRef.current) return;
		inputRef.current.setSelectionRange(pendingCaretPosition.current, pendingCaretPosition.current);
		pendingCaretPosition.current = null;
	}, [formattedValue, formatRevision]);

	return (
		<label className="block min-w-0 text-xs font-semibold text-[#3c3d37]" htmlFor={id}>
			{label}
			<input
				className="mt-2 block h-11 w-full min-w-0 border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
				id={id}
				inputMode="decimal"
				onChange={(event) => {
					const inputValue = event.currentTarget.value;
					const caretPosition = event.currentTarget.selectionStart ?? inputValue.length;
					const normalizedValue = normalizeEditableNumber(inputValue);
					const rawCharactersBeforeCaret = normalizeEditableNumber(inputValue.slice(0, caretPosition)).length;
					pendingCaretPosition.current = getFormattedCaretPosition(formatEditableNumber(normalizedValue), rawCharactersBeforeCaret);
					setFormatRevision((revision) => revision + 1);
					onChange(normalizedValue);
				}}
				placeholder={placeholder}
				ref={inputRef}
				type="text"
					value={formattedValue}
			/>
		</label>
	);
};
