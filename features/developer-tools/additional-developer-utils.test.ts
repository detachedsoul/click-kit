import { describe, expect, it } from "vitest";
import {
	convertColor,
	decodeJwt,
	formatSql,
	hashText,
	inspectUrl,
	jsonToSchema,
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
	const encode = (value: unknown) =>
		btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");

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
		expect(() => decodeJwt("one.two.three")).toThrow(/header is not valid/u);
		expect(() => decodeJwt("a.b")).toThrow(/three-part JWT/u);
	});
});
