const romanTable: [number, string][] = [
	[1000, "M"],
	[900, "CM"],
	[500, "D"],
	[400, "CD"],
	[100, "C"],
	[90, "XC"],
	[50, "L"],
	[40, "XL"],
	[10, "X"],
	[9, "IX"],
	[5, "V"],
	[4, "IV"],
	[1, "I"],
];

export const toRoman = (value: number) => {
	if (!Number.isInteger(value)) throw new Error("Roman numerals only cover whole numbers.");
	if (value < 1) throw new Error("Roman numerals start at 1.");
	if (value > 3999) throw new Error("Standard Roman numerals stop at 3999.");
	let remaining = value;
	let output = "";
	for (const [amount, symbol] of romanTable) {
		while (remaining >= amount) {
			output += symbol;
			remaining -= amount;
		}
	}
	return output;
};

const romanPattern = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/u;

export const fromRoman = (input: string) => {
	const value = input.trim().toUpperCase();
	if (!value) throw new Error("Enter a Roman numeral first.");
	if (!/^[IVXLCDM]+$/u.test(value)) throw new Error("Roman numerals use I, V, X, L, C, D, and M only.");
	if (!romanPattern.test(value)) throw new Error(`${value} is not a valid Roman numeral in standard form.`);
	let remaining = value;
	let total = 0;
	for (const [amount, symbol] of romanTable) {
		while (remaining.startsWith(symbol)) {
			total += amount;
			remaining = remaining.slice(symbol.length);
		}
	}
	if (remaining) throw new Error(`${value} is not a valid Roman numeral.`);
	if (toRoman(total) !== value) throw new Error(`${value} should be written ${toRoman(total)}.`);
	return total;
};

const smallWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tensWords = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const scales: [number, string][] = [
	[1_000_000_000_000, "trillion"],
	[1_000_000_000, "billion"],
	[1_000_000, "million"],
	[1000, "thousand"],
];

const underHundred = (value: number) => (value < 20 ? smallWords[value] : `${tensWords[Math.floor(value / 10)]}${value % 10 ? `-${smallWords[value % 10]}` : ""}`);

const underThousand = (value: number, useAnd: boolean) => {
	const hundreds = Math.floor(value / 100);
	const remainder = value % 100;
	const parts: string[] = [];
	if (hundreds) parts.push(`${smallWords[hundreds]} hundred`);
	if (remainder) parts.push(`${hundreds && useAnd ? "and " : ""}${underHundred(remainder)}`);
	return parts.join(" ");
};

export const numberToWords = (value: number, options: { useAnd?: boolean } = {}) => {
	const useAnd = options.useAnd ?? true;
	if (!Number.isFinite(value)) throw new Error("Enter a number to convert.");
	if (!Number.isInteger(value)) throw new Error("Only whole numbers can be written out.");
	if (Math.abs(value) >= 1_000_000_000_000_000) throw new Error("Keep the number below one quadrillion.");
	if (value === 0) return "zero";
	const sign = value < 0 ? "minus " : "";
	let remaining = Math.abs(value);
	const parts: string[] = [];
	for (const [amount, name] of scales) {
		if (remaining >= amount) {
			const count = Math.floor(remaining / amount);
			parts.push(`${underThousand(count, useAnd)} ${name}`);
			remaining %= amount;
		}
	}
	if (remaining) parts.push(underThousand(remaining, useAnd));
	return `${sign}${parts.join(" ")}`;
};

export const ordinalSuffix = (value: number) => {
	const lastTwo = Math.abs(value) % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
	switch (Math.abs(value) % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
};
