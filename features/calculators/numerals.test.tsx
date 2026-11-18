import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { fromRoman, numberToWords, ordinalSuffix, toRoman } from "@/features/calculators/numerals-utils";
import NumeralsCalculator from "@/features/calculators/numerals-calculator";

afterEach(cleanup);

describe("Roman numerals and number words", () => {
	it("converts numbers to Roman numerals", () => {
		expect(toRoman(1)).toBe("I");
		expect(toRoman(4)).toBe("IV");
		expect(toRoman(9)).toBe("IX");
		expect(toRoman(40)).toBe("XL");
		expect(toRoman(90)).toBe("XC");
		expect(toRoman(400)).toBe("CD");
		expect(toRoman(900)).toBe("CM");
		expect(toRoman(1994)).toBe("MCMXCIV");
		expect(toRoman(3999)).toBe("MMMCMXCIX");
		expect(() => toRoman(0)).toThrow(/start at 1/u);
		expect(() => toRoman(4000)).toThrow(/stop at 3999/u);
		expect(() => toRoman(2.5)).toThrow(/whole numbers/u);
	});

	it("parses Roman numerals and rejects non-standard forms", () => {
		expect(fromRoman("MCMXCIV")).toBe(1994);
		expect(fromRoman("  iv ")).toBe(4);
		expect(() => fromRoman("")).toThrow(/Enter a Roman numeral/u);
		expect(() => fromRoman("ABC")).toThrow(/use I, V, X/u);
		expect(() => fromRoman("IIII")).toThrow(/not a valid Roman numeral/u);
		expect(() => fromRoman("MMMM")).toThrow(/not a valid Roman numeral/u);
		expect(() => fromRoman("IC")).toThrow(/not a valid Roman numeral/u);
	});

	it("writes numbers in words", () => {
		expect(numberToWords(0)).toBe("zero");
		expect(numberToWords(13)).toBe("thirteen");
		expect(numberToWords(21)).toBe("twenty-one");
		expect(numberToWords(100)).toBe("one hundred");
		expect(numberToWords(105)).toBe("one hundred and five");
		expect(numberToWords(105, { useAnd: false })).toBe("one hundred five");
		expect(numberToWords(1234)).toBe("one thousand two hundred and thirty-four");
		expect(numberToWords(1000000)).toBe("one million");
		expect(numberToWords(-42)).toBe("minus forty-two");
		expect(numberToWords(2_500_000_000)).toBe("two billion five hundred million");
		expect(() => numberToWords(1.5)).toThrow(/whole numbers/u);
		expect(() => numberToWords(Number.NaN)).toThrow(/Enter a number/u);
	});

	it("adds ordinal suffixes", () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 102].map(ordinalSuffix)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "102nd"]);
	});

	it("renders both directions", async () => {
		const user = userEvent.setup();
		render(<NumeralsCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("Roman      MCMXCIV");
		expect(output()).toContain("one thousand nine hundred and ninety-four");
		fireEvent.change(screen.getByLabelText("Number"), { target: { value: "41" } });
		expect(output()).toContain("Roman      XLI");
		await user.selectOptions(screen.getByLabelText("Conversion"), "roman");
		fireEvent.change(screen.getByLabelText("Roman numeral"), { target: { value: "XLII" } });
		expect(output()).toContain("Number     42");
		fireEvent.change(screen.getByLabelText("Roman numeral"), { target: { value: "IIII" } });
		expect(screen.getByRole("alert").textContent).toContain("not a valid Roman numeral");
	});
});
