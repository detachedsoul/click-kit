import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { NumberBaseTool } from "@/features/developer-tools/number-base-tool";
import { bitwiseOperation, convertNumberBase, parseInBase } from "@/features/developer-tools/number-base-utils";

afterEach(cleanup);

describe("number base converter", () => {
	it("converts between common bases", () => {
		expect(convertNumberBase("255", 10)).toMatchObject({
			decimal: "255",
			hex: "FF",
			binary: "11111111",
			octal: "377",
			bits: "1111 1111",
			byteLength: "1",
		});
		expect(convertNumberBase("FF", 16).decimal).toBe("255");
		expect(convertNumberBase("0b1010").decimal).toBe("10");
	});

	it("honours prefixes, custom bases, and signs", () => {
		expect(convertNumberBase("0xFF").detectedBase).toBe(16);
		expect(convertNumberBase("0o17").decimal).toBe("15");
		expect(convertNumberBase("1234", 10, 7).custom).toBe("3412");
		expect(convertNumberBase("1_000").decimal).toBe("1000");
		expect(convertNumberBase("-101", 2)).toMatchObject({ decimal: "-5", binary: "-101", hex: "-5" });
	});

	it("handles very large values without losing precision", () => {
		expect(convertNumberBase("18446744073709551615").hex).toBe("FFFFFFFFFFFFFFFF");
		expect(convertNumberBase("FFFFFFFFFFFFFFFF", 16).decimal).toBe("18446744073709551615");
	});

	it("validates digits and bases", () => {
		expect(() => parseInBase("  ")).toThrow(/Enter a number/u);
		expect(() => parseInBase("2", 2)).toThrow(/not a valid base-2 digit/u);
		expect(() => parseInBase("1", 1)).toThrow(/Bases run from 2 to 36/u);
		expect(() => parseInBase("0x", 10)).toThrow(/digits after the prefix/u);
		expect(() => convertNumberBase("10", 10, 37)).toThrow(/Custom bases/u);
	});

	it("supports bitwise operations on 64-bit values", () => {
		expect(bitwiseOperation("0xFF", "0x0F", "and")).toMatchObject({ decimal: "15", hex: "F", binary: "00001111" });
		expect(bitwiseOperation("0xF0", "0x0F", "or").hex).toBe("FF");
		expect(bitwiseOperation("0b1100", "0b1010", "xor").decimal).toBe("6");
		expect(bitwiseOperation("1", "4", "shiftLeft").decimal).toBe("16");
		expect(bitwiseOperation("256", "4", "shiftRight").decimal).toBe("16");
	});

	it("rejects invalid bitwise input", () => {
		expect(() => bitwiseOperation("-1", "1", "and")).toThrow(/non-negative/u);
		expect(() => bitwiseOperation("1", "64", "shiftLeft")).toThrow(/0 to 63/u);
		expect(() => bitwiseOperation("18446744073709551616", "1", "and")).toThrow(/64-bit/u);
	});

	it("renders conversions and switches modes", async () => {
		const user = userEvent.setup();
		render(<NumberBaseTool />);
		expect(screen.getAllByText("FF").length).toBeGreaterThan(0);
		fireEvent.change(screen.getByLabelText("Input base"), { target: { value: "16" } });
		fireEvent.change(screen.getByLabelText("Number"), { target: { value: "A5" } });
		expect(screen.getByText("165")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Bitwise calculator" }));
		expect(screen.getByText("00001010")).toBeTruthy();
		await user.selectOptions(screen.getByLabelText("Operation"), "shiftLeft");
		fireEvent.change(screen.getByLabelText("Right operand"), { target: { value: "1" } });
		expect(screen.getByText("510")).toBeTruthy();
	});
});
