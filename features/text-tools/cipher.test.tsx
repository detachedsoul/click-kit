import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyCipher, atbash, bruteForceCaesar, caesarShift, caesarToText, rot47 } from "@/features/text-tools/cipher-utils";
import { CipherTool } from "@/features/text-tools/cipher-tool";

afterEach(cleanup);

describe("classical ciphers", () => {
	it("shifts letters and preserves case and punctuation", () => {
		expect(caesarShift("Meet me at 5, ok?", 3)).toBe("Phhw ph dw 5, rn?");
		expect(caesarShift("Phhw ph dw 5, rn?", -3)).toBe("Meet me at 5, ok?");
		expect(caesarShift("abc", 26)).toBe("abc");
		expect(caesarShift("abc", 29)).toBe("def");
		expect(caesarShift("xyz", -1)).toBe("wxy");
	});

	it("implements ROT13 as a self-inverse", () => {
		expect(applyCipher("Hello, World!", "rot13")).toBe("Uryyb, Jbeyq!");
		expect(applyCipher(applyCipher("Hello", "rot13"), "rot13")).toBe("Hello");
	});

	it("implements Atbash and ROT47", () => {
		expect(atbash("abc XYZ")).toBe("zyx CBA");
		expect(rot47("Hello")).toBe("w6==@");
		expect(rot47("A")).toBe("p");
		expect(rot47(rot47("Secret 42!"))).toBe("Secret 42!");
	});

	it("decodes a Caesar shift and brute forces the rest", () => {
		expect(applyCipher("Khoor", "caesar", 3, true)).toBe("Hello");
		const rows = bruteForceCaesar("Khoor");
		expect(rows).toHaveLength(25);
		expect(rows[2]).toEqual({ shift: 3, text: "Hello" });
		expect(caesarToText(rows.slice(0, 2))).toBe("01 → Jgnnq\n02 → Ifmmp");
	});

	it("rejects empty input", () => {
		expect(() => applyCipher("  ", "caesar")).toThrow(/Paste some text/u);
		expect(() => bruteForceCaesar("")).toThrow(/Paste some text/u);
	});

	it("renders transformations and the brute-force table", () => {
		render(<CipherTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toBe("Phhw ph dw wkh kduerxu — wkh sodq vwdqgv.");
		fireEvent.click(screen.getByLabelText("Decode instead of encode"));
		expect(output()).toBe("Jbbq jb xq qeb exoylro — qeb mixk pqxkap.");
		fireEvent.click(screen.getByLabelText("Brute force all 25 shifts"));
		expect(output().split("\n")).toHaveLength(25);
		fireEvent.change(screen.getByLabelText("Your text"), { target: { value: " " } });
		expect(screen.getByRole("alert").textContent).toContain("Paste some text");
	});
});
