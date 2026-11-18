import { describe, expect, it } from "vitest";
import { chooseRandomOption, generatePassword, generateQrCode } from "@/features/productivity-tools/productivity-utils";

describe("QR code generator", () => {
	it("generates a downloadable PNG data URL locally", async () => {
		const image = await generateQrCode("https://example.com/hello?source=clickkit");
		expect(image).toMatch(/^data:image\/png;base64,/u);
		expect(image.length).toBeGreaterThan(500);
	});

	it("rejects empty and overly long QR content", async () => {
		await expect(generateQrCode("  ")).rejects.toThrow(/Enter a link/u);
		await expect(generateQrCode("x".repeat(2001))).rejects.toThrow(/2,000 characters/u);
	});
});

describe("password generator", () => {
	it("returns the requested length and guarantees each selected class", () => {
		const password = generatePassword({
			length: 32,
			lowercase: true,
			uppercase: true,
			numbers: true,
			symbols: true,
			excludeAmbiguous: false,
		});
		expect(password).toHaveLength(32);
		expect(password).toMatch(/[a-z]/u);
		expect(password).toMatch(/[A-Z]/u);
		expect(password).toMatch(/[0-9]/u);
		expect(password).toMatch(/[!#$%&()*+,-./:;<=>?@[\]^_{|}~]/u);
	});

	it("supports look-alike exclusion and rejects invalid option combinations", () => {
		const password = generatePassword({
			length: 20,
			lowercase: true,
			uppercase: true,
			numbers: false,
			symbols: false,
			excludeAmbiguous: true,
		});
		expect(password).not.toMatch(/[ilLI|1oO0`'"{}\\]/u);
		expect(() =>
			generatePassword({
				length: 8,
				lowercase: false,
				uppercase: false,
				numbers: false,
				symbols: false,
				excludeAmbiguous: false,
			}),
		).toThrow(/at least one/u);
		expect(() =>
			generatePassword({
				length: 3,
				lowercase: true,
				uppercase: false,
				numbers: false,
				symbols: false,
				excludeAmbiguous: false,
			}),
		).toThrow(/4 to 128/u);
	});
});

describe("random picker", () => {
	it("chooses one actual non-empty entry and counts duplicate entries separately", () => {
		const result = chooseRandomOption("tea\ncoffee\n\ntea\n");
		expect(result).toEqual(expect.objectContaining({ count: 3 }));
		expect(["tea", "coffee"]).toContain(result.choice);
	});

	it("rejects fewer than two usable choices", () => {
		expect(() => chooseRandomOption("only one\n\n ")).toThrow(/at least two/u);
	});
});
