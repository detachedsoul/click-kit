import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { base32Decode, generateSecret, hmac, toHex, totp, verifyTotp } from "@/features/developer-tools/hmac-utils";
import { HmacTool } from "@/features/developer-tools/hmac-tool";

afterEach(cleanup);

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"

describe("HMAC and TOTP toolkit", () => {
	it("matches published HMAC test vectors", async () => {
		const sha256 = await hmac("The quick brown fox jumps over the lazy dog", "key", "SHA-256");
		expect(sha256.hex).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
		expect(sha256.base64Url).not.toContain("=");
		const sha1 = await hmac("", "key", "SHA-1");
		expect(sha1.hex).toBe("f42bb0eeb018ebbd4597ae7213711ec60760843f");
		const base32Key = await hmac("message", "ME======", "SHA-256", "base32");
		expect(base32Key.hex).toHaveLength(64);
		await expect(hmac("message", "", "SHA-256")).rejects.toThrow(/Enter a key/u);
	});

	it("decodes Base32 and rejects invalid secrets", () => {
		expect(toHex(base32Decode("JBSWY3DP"))).toBe("48656c6c6f");
		expect(toHex(base32Decode("jbsw y3dp===="))).toBe("48656c6c6f");
		expect(() => base32Decode("")).toThrow(/empty/u);
		expect(() => base32Decode("ABC1")).toThrow(/not a Base32 character/u);
	});

	it("generates RFC 6238 codes", async () => {
		const at59 = await totp({ secret: rfcSecret, digits: 8, timestamp: 59_000 });
		expect(at59.code).toBe("94287082");
		expect(at59.counter).toBe(1);
		expect(at59.remaining).toBe(1);
		const at1111111109 = await totp({ secret: rfcSecret, digits: 8, timestamp: 1_111_111_109_000 });
		expect(at1111111109.code).toBe("07081804");
		const sha512 = await totp({ secret: rfcSecret, digits: 8, algorithm: "SHA-512", timestamp: 59_000 });
		expect(sha512.code).toMatch(/^\d{8}$/u);
		expect((await totp({ secret: "JBSWY3DPEHPK3PXP", digits: 6, timestamp: 0 })).code).toMatch(/^\d{6}$/u);
		await expect(totp({ secret: "JBSWY3DPEHPK3PXP", digits: 3 })).rejects.toThrow(/between 4 and 10/u);
		await expect(totp({ secret: "JBSWY3DPEHPK3PXP", period: 0 })).rejects.toThrow(/positive/u);
	});

	it("verifies codes within the window only", async () => {
		const options = { secret: "JBSWY3DPEHPK3PXP", timestamp: 1_700_000_000_000 };
		const current = await totp(options);
		expect(await verifyTotp(current.code, options)).toBe(true);
		expect(await verifyTotp(current.code, { ...options, timestamp: 1_700_000_000_000 + 30_000 })).toBe(true);
		expect(await verifyTotp(current.code, { ...options, timestamp: 1_700_000_000_000 + 90_000 })).toBe(false);
		expect(await verifyTotp("abc", options)).toBe(false);
	});

	it("generates valid 32-character Base32 secrets", () => {
		const secret = generateSecret();
		expect(secret).toMatch(/^[A-Z2-7]{32}$/u);
		expect(base32Decode(secret)).toHaveLength(20);
	});

	it("renders signatures and a live code", async () => {
		const user = userEvent.setup();
		render(<HmacTool />);
		await waitFor(() => expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("base64url"));
		await user.selectOptions(screen.getByLabelText("HMAC algorithm"), "SHA-512");
		await waitFor(() => expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("hex"));
		await waitFor(() => expect(screen.getByLabelText("Current code").textContent).toMatch(/^\d{6}$/u));
		fireEvent.change(screen.getByLabelText("TOTP secret (Base32)"), { target: { value: "not base32!" } });
		await waitFor(() => expect(screen.getByText(/not a Base32 character/u)).toBeTruthy());
	});
});
