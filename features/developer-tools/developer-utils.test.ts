import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
	decodeBase64,
	decodeBase64Bytes,
	encodeBase64,
	encodeBase64Bytes,
	findRegexMatches,
	formatJson,
	generateUuidV4,
	isoToTimestamp,
	jsonToTypeScript,
	maximumBinaryBytes,
	timestampToIso,
} from "@/features/developer-tools/developer-utils";

const getTypeScriptDiagnostics = (source: string) => {
	const fileName = "/generated-types.ts";
	const options: ts.CompilerOptions = {
		strict: true,
		exactOptionalPropertyTypes: true,
		noUncheckedIndexedAccess: true,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
	};
	const host = ts.createCompilerHost(options);
	const originalGetSourceFile = host.getSourceFile.bind(host);
	const originalFileExists = host.fileExists.bind(host);
	const originalReadFile = host.readFile.bind(host);
	host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
		path === fileName
			? ts.createSourceFile(path, source, languageVersion)
			: originalGetSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
	host.fileExists = (path) => path === fileName || originalFileExists(path);
	host.readFile = (path) => (path === fileName ? source : originalReadFile(path));
	const program = ts.createProgram([fileName], options, host);
	return ts
		.getPreEmitDiagnostics(program)
		.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
};

describe("JSON tools", () => {
	it("formats and minifies valid JSON and rejects malformed input", () => {
		expect(formatJson('{"name":"Ada","ok":true}', "pretty")).toBe('{\n  "name": "Ada",\n  "ok": true\n}');
		expect(formatJson('{ "name": "Ada" }', "minify")).toBe('{"name":"Ada"}');
		expect(() => formatJson("{name: 'Ada'}", "pretty")).toThrow(/Invalid JSON/u);
	});

	it("preserves distinct array object shapes in strict mode", () => {
		const output = jsonToTypeScript('[{"id":1,"name":"Ada"},{"enabled":true}]', "Entry", "strict");
		expect(output).toContain("Array<{\n\tid: number;");
		expect(output).toContain("} | {\n\tenabled: boolean;");
		expect(output).not.toContain("id?:");
	});

	it("merges object shapes and marks properties missing from samples as optional in flexible mode", () => {
		const output = jsonToTypeScript(
			'[{"id":1,"profile":{"name":"Ada","active":true}},{"enabled":false,"profile":{"score":12}}]',
			"Entry",
			"flexible",
		);
		expect(output).toContain("id?: number;");
		expect(output).toContain("enabled?: boolean;");
		expect(output).toContain("name?: string;");
		expect(output).toContain("active?: boolean;");
		expect(output).toContain("score?: number;");
		expect(output).not.toContain("} | {");
	});

	it("handles scalar unions, nested arrays, empty values, nulls, and special property names", () => {
		expect(jsonToTypeScript('[1,"two",null]', "Values", "strict")).toContain("Array<number | string | null>");
		expect(jsonToTypeScript('[{"x":[]},{"x":[{"a":1},{"b":true}]}]', "Nested", "flexible")).toContain(
			"a?: number;",
		);
		const mixed = jsonToTypeScript('[{"a":1},{"b":true},null]', "Mixed", "flexible");
		expect(mixed).toContain("a?: number;");
		expect(mixed).toContain("b?: boolean;");
		expect(mixed).toContain("| null>");
		expect(jsonToTypeScript("[]")).toContain("unknown[]");
		expect(jsonToTypeScript("{}")).toContain("Record<string, unknown>");
		expect(jsonToTypeScript("null")).toContain("= null;");
		expect(jsonToTypeScript('{"not-valid":1,"Δ-value":true,"__proto__":null}')).toContain('"Δ-value": boolean;');
		expect(jsonToTypeScript('[{"same":1},{"same":2}]', "Same")).toContain("Array<{\n\tsame: number;");
	});

	it("emits valid TypeScript under strict compiler settings in both modes", () => {
		const example = '[{"id":1,"profile":{"name":"Ada"}},{"enabled":true,"profile":{"score":2}}]';
		const strict = jsonToTypeScript(example, "StrictEntry", "strict");
		const flexible = jsonToTypeScript(example, "FlexibleEntry", "flexible");
		const mixed = jsonToTypeScript('[{"a":1},{"b":true},null]', "MixedEntry", "flexible");
		const checks = [
			'const strictSample: StrictEntry = [{ id: 1, profile: { name: "Ada" } }, { enabled: true, profile: { score: 2 } }];',
			"const flexibleSample: FlexibleEntry = [{ profile: {} }, { id: 1, enabled: true, profile: { score: 2 } }];",
			"const mixedSample: MixedEntry = [{ a: 1 }, { b: true }, null];",
		].join("\n");
		expect(getTypeScriptDiagnostics(`${strict}\n${flexible}\n${mixed}\n${checks}`)).toEqual([]);
	}, 15_000);

	it("validates JSON, size, inference mode, Unicode type names, and reserved identifiers", () => {
		expect(jsonToTypeScript('{"ok":true}', "Δοκιμή")).toContain("export type Δοκιμή");
		expect(() => jsonToTypeScript(" ")).toThrow(/Paste a JSON example/u);
		expect(() => jsonToTypeScript("{bad")).toThrow(/Invalid JSON/u);
		expect(() => jsonToTypeScript("{}", "Bad Type")).toThrow(/identifier/u);
		expect(() => jsonToTypeScript("{}", "class")).toThrow(/identifier/u);
		expect(() => jsonToTypeScript("{}", "interface")).toThrow(/identifier/u);
		expect(() => jsonToTypeScript("{}", "string")).toThrow(/identifier/u);
		expect(() => jsonToTypeScript("{}", "Root", "other" as never)).toThrow(/inference mode/u);
		expect(() => jsonToTypeScript(`"${"x".repeat(1_000_001)}"`)).toThrow(/one million/u);
	});
});

describe("Base64 and UUID tools", () => {
	it("encodes and decodes Unicode text and rejects invalid UTF-8 payloads", () => {
		expect(encodeBase64("Hello 🙂")).toBe("SGVsbG8g8J+Zgg==");
		expect(decodeBase64("SGVsbG8g8J+Zgg==")).toBe("Hello 🙂");
		expect(decodeBase64("8J-YgA")).toBe("😀");
		expect(decodeBase64("data:text/plain;charset=utf-8;base64,SGVsbG8=")).toBe("Hello");
		expect(() => decodeBase64("%%% ")).toThrow(/valid Base64/u);
		expect(() => decodeBase64("/w==")).toThrow(/binary data/u);
	});

	it("encodes and decodes arbitrary binary bytes and MIME-labelled data URLs", () => {
		const bytes = new Uint8Array([0, 255, 128, 10, 42]);
		expect(encodeBase64Bytes(bytes)).toBe("AP+ACio=");
		expect([...decodeBase64Bytes("AP+ACio=").bytes]).toEqual([...bytes]);
		expect(decodeBase64Bytes("data:image/png;charset=binary;base64,iVBORw0KGgo=")).toMatchObject({
			mimeType: "image/png",
		});
		expect(decodeBase64Bytes("YQ\n==").bytes).toEqual(new Uint8Array([97]));
		expect([...decodeBase64Bytes("8J-YgA").bytes]).toEqual([240, 159, 152, 128]);
		expect(encodeBase64Bytes(new Uint8Array())).toBe("");
		expect(decodeBase64Bytes("").bytes).toHaveLength(0);
	});

	it("rejects malformed Base64, invalid data URLs, and oversized binary inputs", () => {
		for (const value of [
			"!!!!",
			"A===",
			"YQ=",
			"AB==",
			"-+==",
			"data:image/png,AA==",
			"data:not-a-mime;base64,AA==",
		]) {
			expect(() => decodeBase64Bytes(value)).toThrow();
		}
		expect(() => encodeBase64("x".repeat(1_000_001))).toThrow(/one million/u);
		expect(() => encodeBase64Bytes(new Uint8Array(maximumBinaryBytes + 1))).toThrow(/8 MB/u);
		expect(() => decodeBase64Bytes("A".repeat(11_000_000))).toThrow(/10.7 MB/u);
	});

	it("accepts the maximum supported binary file size", () => {
		const bytes = new Uint8Array(maximumBinaryBytes);
		const encoded = encodeBase64Bytes(bytes);
		expect(encoded).toHaveLength(Math.ceil(maximumBinaryBytes / 3) * 4);
		expect(decodeBase64Bytes(encoded).bytes).toHaveLength(maximumBinaryBytes);
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
