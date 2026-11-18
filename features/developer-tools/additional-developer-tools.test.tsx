import { webcrypto } from "node:crypto";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	ColorConverterTool,
	JwtDecoderTool,
	JsonSchemaTool,
	UrlInspectorTool,
} from "@/features/developer-tools/additional-developer-tools";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("additional Developer tools", () => {
	it("inspects repeated URL query parameters and validates protocols", () => {
		render(<UrlInspectorTool />);
		const query = screen.getByRole("table", { name: "Query parameters (3)" });
		expect(query.textContent).toContain("clickkit");
		expect(query.textContent).toContain("tools");
		fireEvent.change(screen.getByLabelText("Absolute URL"), { target: { value: "javascript:alert(1)" } });
		expect(screen.getByRole("alert").textContent).toContain("Only HTTP and HTTPS");
	});

	it("updates accessible color previews and CSS representations", () => {
		render(<ColorConverterTool />);
		fireEvent.change(screen.getByLabelText("Color value"), { target: { value: "hsl(120, 100%, 50%)" } });
		expect(screen.getByRole("img", { name: "Color preview #00ff00" })).toBeTruthy();
		expect(screen.getByText("rgb(0, 255, 0)")).toBeTruthy();
	});

	it("verifies a local HS256 JWT and clearly reports signature success", async () => {
		vi.stubGlobal("crypto", webcrypto);
		const encode = (value: unknown) =>
			btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
		const secret = "component test secret";
		const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "user-1" })}`;
		const cryptoKey = await webcrypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const signature = await webcrypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signingInput));
		const signaturePart = btoa(String.fromCharCode(...new Uint8Array(signature)))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replace(/=+$/u, "");
		const user = userEvent.setup();
		render(<JwtDecoderTool />);
		fireEvent.change(screen.getByLabelText("Three-part JWT"), {
			target: { value: `${signingInput}.${signaturePart}` },
		});
		fireEvent.change(screen.getByLabelText("Shared secret"), { target: { value: secret } });
		await user.click(screen.getByRole("button", { name: "Verify signature" }));
		expect(await screen.findByText("Signature verified for the selected algorithm and key.")).toBeTruthy();
	});

	it("generates a schema and explains malformed JSON", async () => {
		const user = userEvent.setup();
		render(<JsonSchemaTool />);
		await user.click(screen.getByRole("button", { name: "Generate JSON Schema" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain(
			'"$schema": "https://json-schema.org/draft/2020-12/schema"',
		);
		fireEvent.change(screen.getByLabelText("JSON example"), { target: { value: "{bad" } });
		await user.click(screen.getByRole("button", { name: "Generate JSON Schema" }));
		expect(screen.getByRole("alert").textContent).toContain("Invalid JSON");
	});
});
