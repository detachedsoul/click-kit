import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64, findRegexMatches, formatJson, generateUuidV4, isoToTimestamp, jsonToTypeScript, timestampToIso } from "@/features/developer-tools/developer-utils";

describe("JSON tools", () => {
	it("formats and minifies valid JSON and rejects malformed input", () => {
		expect(formatJson("{\"name\":\"Ada\",\"ok\":true}", "pretty")).toBe('{\n  "name": "Ada",\n  "ok": true\n}');
		expect(formatJson("{ \"name\": \"Ada\" }", "minify")).toBe('{"name":"Ada"}');
		expect(() => formatJson("{name: 'Ada'}", "pretty")).toThrow(/Invalid JSON/u);
	});

	it("infers nested TypeScript types and safely quotes unusual property names", () => {
		expect(jsonToTypeScript('{"user-name":"Ada","roles":["admin","editor"],"profile":{"active":true}}', "User")).toContain('"user-name": string;');
		expect(jsonToTypeScript('{"profile":{"active":true}}')).toContain("profile: {\n\t\tactive: boolean;");
		expect(() => jsonToTypeScript("{}", "Bad Type")).toThrow(/identifier/u);
	});
});

describe("Base64 and UUID tools", () => {
	it("encodes and decodes Unicode text and rejects invalid UTF-8 payloads", () => {
		expect(encodeBase64("Hello 🙂")).toBe("SGVsbG8g8J+Zgg==");
		expect(decodeBase64("SGVsbG8g8J+Zgg==")).toBe("Hello 🙂");
		expect(decodeBase64("8J-YgA")).toBe("😀");
		expect(() => decodeBase64("%%% ")).toThrow(/valid Base64/u);
		 expect(() => decodeBase64("/w==")).toThrow(/UTF-8/u);
	});

	it("generates RFC 4122 version 4 UUIDs", () => {
		const uuid = generateUuidV4();
		expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu);
	});
});

describe("regular expression tester", () => {
	it("returns global matches with capture groups and indexes", () => {
		expect(findRegexMatches("one two", "(\\w+)", "i")).toEqual([
			{ text: "one", index: 0, captures: ["one"] },
			{ text: "two", index: 4, captures: ["two"] },
		]);
	});

	it("handles zero-width and invalid expressions", () => {
		expect(findRegexMatches("ab", "(?=.)", "u").map(({ index }) => index)).toEqual([0, 1]);
		expect(() => findRegexMatches("abc", "[", "")).toThrow(/Invalid regular expression/u);
		expect(() => findRegexMatches("abc", "", "")).toThrow(/Enter a regular expression/u);
	});
});

describe("timestamp converter", () => {
	it("converts Unix seconds and milliseconds to UTC ISO dates and back", () => {
		expect(timestampToIso(1735689600, "seconds")).toBe("2025-01-01T00:00:00.000Z");
		expect(timestampToIso(1735689600000, "milliseconds")).toBe("2025-01-01T00:00:00.000Z");
		expect(isoToTimestamp("2025-01-01T00:00:00Z", "seconds")).toBe(1735689600);
		expect(isoToTimestamp("2025-01-01T01:00:00+01:00", "milliseconds")).toBe(1735689600000);
	});

	it("rejects invalid dates and out-of-range timestamps", () => {
		expect(() => isoToTimestamp("2025-02-30T00:00:00Z", "seconds")).toThrow(/valid ISO 8601 calendar date/u);
		expect(() => isoToTimestamp("2025-01-01T00:00:00", "seconds")).toThrow(/timezone/u);
		expect(() => timestampToIso(Number.NaN, "seconds")).toThrow(/finite timestamp/u);
	});
});
