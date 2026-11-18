import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	convertColor,
	decodeJwt,
	formatSql,
	hashText,
	inspectUrl,
	jsonToSchema,
	verifyJwtSignature,
} from "@/features/developer-tools/additional-developer-utils";

describe("URL inspector", () => {
	it("splits URL components and preserves repeated, decoded query values", () => {
		expect(inspectUrl("https://user:secret@example.com:8443/a%20b?tag=one&tag=two+words#section")).toEqual({
			url: "https://example.com:8443/a%20b?tag=one&tag=two+words#section",
			protocol: "https:",
			origin: "https://example.com:8443",
			host: "example.com:8443",
			pathname: "/a%20b",
			fragment: "#section",
			query: [
				{ name: "tag", value: "one" },
				{ name: "tag", value: "two words" },
			],
		});
	});

	it("rejects relative URLs and non-web protocols", () => {
		expect(() => inspectUrl("/search?q=test")).toThrow(/complete URL/u);
		expect(() => inspectUrl("javascript:alert(1)")).toThrow(/HTTP and HTTPS/u);
	});
});

describe("local hash generator", () => {
	it("matches the standard SHA-256 digest for UTF-8 text", async () => {
		expect(await hashText("abc", "SHA-256")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("reports unavailable secure crypto explicitly", async () => {
		await expect(hashText("abc", "SHA-256", null)).rejects.toThrow(/not available/u);
	});
});

describe("SQL formatter", () => {
	it("formats a query and accepts an explicitly selected dialect", async () => {
		expect(await formatSql("select id,name from users where active=true", "postgresql")).toBe(
			"SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = TRUE",
		);
	});

	it("rejects empty SQL and formats whitespace without claiming to validate syntax", async () => {
		await expect(formatSql("  ", "sql")).rejects.toThrow(/Paste a SQL query/u);
		expect(await formatSql("select from where", "sql")).toBe("SELECT\nFROM\nWHERE");
	});
});

describe("CSS color converter", () => {
	it("converts HEX, RGB and HSL to consistent formats", () => {
		expect(convertColor("#f00")).toEqual({
			hex: "#ff0000",
			rgb: "rgb(255, 0, 0)",
			hsl: "hsl(0, 100%, 50%)",
			alpha: 1,
		});
		expect(convertColor("hsl(120, 100%, 50%)").hex).toBe("#00ff00");
		expect(convertColor("rgba(0, 0, 255, 50%)")).toEqual({
			hex: "#0000ff80",
			rgb: "rgba(0, 0, 255, 0.5)",
			hsl: "hsla(240, 100%, 50%, 0.5)",
			alpha: 0.5,
		});
		expect(convertColor("rgb(50%, 50%, 50%)").hex).toBe("#808080");
		expect(convertColor("transparent").alpha).toBe(0);
	});

	it("rejects malformed color formats and out-of-range channels", () => {
		expect(() => convertColor("#12345")).toThrow(/Enter a HEX/u);
		expect(() => convertColor("rgb(256, 0, 0)")).toThrow(/between 0 and 255/u);
		expect(() => convertColor("hsl(0, 110%, 50%)")).toThrow(/HSL requires/u);
	});
});

describe("JSON Schema generator", () => {
	it("infers nested object properties, arrays, and heterogeneous unions", () => {
		const schema = JSON.parse(jsonToSchema('{"name":"Ada","items":[1,"two"],"profile":{"active":true}}')) as Record<
			string,
			unknown
		>;
		expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
		expect(schema.required).toEqual(["name", "items", "profile"]);
		const properties = schema.properties as Record<string, Record<string, unknown>>;
		expect(properties.name).toEqual({ type: "string" });
		expect(properties.items).toEqual({ type: "array", items: { anyOf: [{ type: "number" }, { type: "string" }] } });
	});

	it("supports null and rejects invalid or empty JSON", () => {
		expect(JSON.parse(jsonToSchema("null"))).toMatchObject({ type: "null" });
		expect(() => jsonToSchema(" ")).toThrow(/Paste a JSON example/u);
		expect(() => jsonToSchema("{bad")).toThrow(/Invalid JSON/u);
	});
});

describe("JWT decoder", () => {
	const subtle = webcrypto.subtle as unknown as SubtleCrypto;
	const encode = (value: unknown) =>
		btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
	const encodeBytes = (value: Uint8Array) =>
		btoa(String.fromCharCode(...value))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replace(/=+$/u, "");

	it("decodes Base64URL header and payload without trusting signature", () => {
		const result = decodeJwt(
			`${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "user-1", exp: 1_735_689_600 })}.not-verified`,
		);
		expect(result.header).toEqual({ alg: "HS256", typ: "JWT" });
		expect(result.payload.sub).toBe("user-1");
		expect(result.expiresAt).toBe("2025-01-01T00:00:00.000Z");
		expect(result.signaturePresent).toBe(true);
	});

	it("rejects invalid token structure and non-object JWT segments", () => {
		expect(() => decodeJwt(`${encode("not an object")}.${encode({})}.signature`)).toThrow(/must be a JSON object/u);
		expect(() => decodeJwt("a.b")).toThrow(/three-part JWT/u);
	});

	it("verifies HMAC signatures and rejects wrong secrets, changed payloads, and algorithm mismatch", async () => {
		const secret = "local test secret";
		const header = encode({ alg: "HS256", typ: "JWT" });
		const payload = encode({ sub: "user-1" });
		const signingInput = `${header}.${payload}`;
		const signature = await webcrypto.subtle.sign(
			{ name: "HMAC", hash: "SHA-256" },
			await webcrypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			),
			new TextEncoder().encode(signingInput),
		);
		const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
		await expect(verifyJwtSignature(token, secret, "HS256", subtle)).resolves.toBe(true);
		await expect(verifyJwtSignature(token, "wrong secret", "HS256", subtle)).resolves.toBe(false);
		await expect(
			verifyJwtSignature(
				`${header}.${encode({ sub: "changed" })}.${encodeBytes(new Uint8Array(signature))}`,
				secret,
				"HS256",
				subtle,
			),
		).resolves.toBe(false);
		await expect(verifyJwtSignature(token, secret, "RS256", subtle)).rejects.toThrow(/must match/u);
		await expect(
			verifyJwtSignature(
				`${encode({ alg: "HS256", crit: ["exp"] })}.${payload}.${encodeBytes(new Uint8Array(signature))}`,
				secret,
				"HS256",
				subtle,
			),
		).rejects.toThrow(/critical extensions/u);
		await expect(verifyJwtSignature(token, "", "HS256", subtle)).rejects.toThrow(/shared secret/u);
	});

	it("supports HS384 and HS512 JWTs", async () => {
		for (const [algorithm, hash] of [
			["HS384", "SHA-384"],
			["HS512", "SHA-512"],
		] as const) {
			const secret = "another local secret";
			const signingInput = `${encode({ alg: algorithm })}.${encode({ sub: "test" })}`;
			const key = await webcrypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(secret),
				{ name: "HMAC", hash },
				false,
				["sign"],
			);
			const signature = await webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
			const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
			await expect(verifyJwtSignature(token, secret, algorithm, subtle)).resolves.toBe(true);
		}
	});

	it("verifies RSA signatures with an SPKI PEM public key and rejects malformed PEM", async () => {
		const keyPair = await webcrypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: new Uint8Array([1, 0, 1]),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);
		const signingInput = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ aud: "click-kit" })}`;
		const signature = await webcrypto.subtle.sign(
			"RSASSA-PKCS1-v1_5",
			keyPair.privateKey,
			new TextEncoder().encode(signingInput),
		);
		const publicKey = new Uint8Array(await webcrypto.subtle.exportKey("spki", keyPair.publicKey));
		const pemBody =
			btoa(String.fromCharCode(...publicKey))
				.match(/.{1,64}/gu)
				?.join("\n") ?? "";
		const pem = `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;
		const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
		await expect(verifyJwtSignature(token, pem, "RS256", subtle)).resolves.toBe(true);
		await expect(verifyJwtSignature(token, "not a PEM key", "RS256", subtle)).rejects.toThrow(/PEM/u);
	});

	it("supports RS384 and RS512 JWT signatures", async () => {
		for (const [algorithm, hash] of [
			["RS384", "SHA-384"],
			["RS512", "SHA-512"],
		] as const) {
			const keyPair = await webcrypto.subtle.generateKey(
				{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash },
				true,
				["sign", "verify"],
			);
			const signingInput = `${encode({ alg: algorithm })}.${encode({ sub: "rsa-test" })}`;
			const signature = await webcrypto.subtle.sign(
				"RSASSA-PKCS1-v1_5",
				keyPair.privateKey,
				new TextEncoder().encode(signingInput),
			);
			const publicKey = new Uint8Array(await webcrypto.subtle.exportKey("spki", keyPair.publicKey));
			const pemBody =
				btoa(String.fromCharCode(...publicKey))
					.match(/.{1,64}/gu)
					?.join("\n") ?? "";
			const pem = `-----BEGIN PUBLIC KEY-----\n${pemBody}\n-----END PUBLIC KEY-----`;
			const token = `${signingInput}.${encodeBytes(new Uint8Array(signature))}`;
			await expect(verifyJwtSignature(token, pem, algorithm, subtle)).resolves.toBe(true);
		}
	});
});
