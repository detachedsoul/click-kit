const maximumInputLength = 200;
const maximumBase = 36;

const digitValue = (character: string) => {
	const code = character.toLowerCase().charCodeAt(0);
	if (code >= 48 && code <= 57) return code - 48;
	if (code >= 97 && code <= 122) return code - 87;
	return -1;
};

export type ParsedNumber = { value: bigint; base: number; negative: boolean };

export const parseInBase = (input: string, fallbackBase = 10): ParsedNumber => {
	const trimmed = input.trim();
	if (!trimmed) throw new Error("Enter a number to convert.");
	if (trimmed.length > maximumInputLength) throw new Error("Keep number input under 200 characters.");
	const negative = trimmed.startsWith("-");
	const unsigned = negative ? trimmed.slice(1) : trimmed;
	if (!unsigned) throw new Error("Enter digits after the minus sign.");
	const prefix = unsigned.slice(0, 2).toLowerCase();
	let base = fallbackBase;
	let digits = unsigned;
	if (prefix === "0x") {
		base = 16;
		digits = unsigned.slice(2);
	} else if (prefix === "0b") {
		base = 2;
		digits = unsigned.slice(2);
	} else if (prefix === "0o") {
		base = 8;
		digits = unsigned.slice(2);
	}
	if (base < 2 || base > maximumBase) throw new Error("Bases run from 2 to 36.");
	if (!digits) throw new Error("Enter digits after the prefix.");
	let value = BigInt(0);
	const bigBase = BigInt(base);
	for (const character of digits.replaceAll("_", "")) {
		const digit = digitValue(character);
		if (digit === -1 || digit >= base) throw new Error(`"${character}" is not a valid base-${base} digit.`);
		value = value * bigBase + BigInt(digit);
	}
	return { value: negative ? -value : value, base, negative };
};

export type BaseConversion = {
	input: string;
	detectedBase: number;
	decimal: string;
	binary: string;
	octal: string;
	hex: string;
	base36: string;
	bits: string;
	custom: string;
	byteLength: string;
};

export const convertNumberBase = (input: string, base = 10, customBase = 16): BaseConversion => {
	const parsed = parseInBase(input, base);
	if (!Number.isInteger(customBase) || customBase < 2 || customBase > maximumBase) throw new Error("Custom bases run from 2 to 36.");
	const value = parsed.value;
	const magnitude = value < BigInt(0) ? -value : value;
	const sign = value < BigInt(0) ? "-" : "";
	const binary = `${sign}${magnitude.toString(2)}`;
	const bits = magnitude.toString(2).padStart(Math.ceil(magnitude.toString(2).length / 4) * 4, "0").match(/.{4}/gu)?.join(" ") ?? "0";
	const byteLength = String(Math.max(1, Math.ceil(magnitude.toString(2).length / 8)));
	return {
		input: input.trim(),
		detectedBase: parsed.base,
		decimal: value.toString(10),
		binary,
		octal: `${sign}${magnitude.toString(8)}`,
		hex: `${sign}${magnitude.toString(16).toUpperCase()}`,
		base36: `${sign}${magnitude.toString(36).toUpperCase()}`,
		bits,
		custom: `${sign}${magnitude.toString(customBase).toUpperCase()}`,
		byteLength,
	};
};

export type BitwiseOperator = "and" | "or" | "xor" | "shiftLeft" | "shiftRight";

export type BitwiseResult = { operator: BitwiseOperator; left: string; right: string; decimal: string; hex: string; binary: string };

const bitwise64Mask = (BigInt(1) << BigInt(64)) - BigInt(1);

export const bitwiseOperation = (leftInput: string, rightInput: string, operator: BitwiseOperator): BitwiseResult => {
	const left = parseInBase(leftInput, 10).value;
	const right = parseInBase(rightInput, 10).value;
	if (left < BigInt(0) || right < BigInt(0)) throw new Error("Bitwise operations need non-negative 64-bit values.");
	if (left > bitwise64Mask || right > bitwise64Mask) throw new Error("Bitwise operations are limited to 64-bit values.");
	if ((operator === "shiftLeft" || operator === "shiftRight") && right > BigInt(63)) throw new Error("Shift amounts run from 0 to 63.");
	const result =
		operator === "and"
			? left & right
			: operator === "or"
				? left | right
				: operator === "xor"
					? left ^ right
					: operator === "shiftLeft"
						? (left << right) & bitwise64Mask
						: left >> right;
	return {
		operator,
		left: left.toString(10),
		right: right.toString(10),
		decimal: result.toString(10),
		hex: result.toString(16).toUpperCase(),
		binary: result.toString(2).padStart(Math.ceil(result.toString(2).length / 8) * 8, "0"),
	};
};

export const formatWithBase = (value: bigint, base: number) => {
	if (base < 2 || base > maximumBase) throw new Error("Bases run from 2 to 36.");
	return value.toString(base).toUpperCase();
};
