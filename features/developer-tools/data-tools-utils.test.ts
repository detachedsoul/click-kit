import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
	csvToJson,
	generateGitignore,
	hashFile,
	jsonToCsv,
	maximumHashFileBytes,
	queryJsonPath,
	validateJsonSchema,
} from "@/features/developer-tools/data-tools-utils";

describe("CSV and JSON converter", () => {
	it("parses escaped quotes, embedded newlines, empty cells, and duplicate headers", () => {
		expect(csvToJson('name,name,notes\nAda,Ada2,"comma, and\nnewline"\nBob,,"said ""hi"""')).toBe(
			'[\n  {\n    "name": "Ada",\n    "name_2": "Ada2",\n    "notes": "comma, and\\nnewline"\n  },\n  {\n    "name": "Bob",\n    "name_2": "",\n    "notes": "said \\"hi\\""\n  }\n]',
		);
	});

	it("skips blank lines but keeps records whose fields are all empty", () => {
		expect(JSON.parse(csvToJson("a,b\n\n1,2\n,\n3,4\n"))).toEqual([
			{ a: "1", b: "2" },
			{ a: "", b: "" },
			{ a: "3", b: "4" },
		]);
		expect(JSON.parse(csvToJson("a,b\n1,2\n\n"))).toEqual([{ a: "1", b: "2" }]);
	});

	it("converts CSV without headers, creates safe names for blank headings, and supports delimiters", () => {
		expect(JSON.parse(csvToJson("a;b\n1;2", ";"))).toEqual([{ a: "1", b: "2" }]);
		expect(JSON.parse(csvToJson("one\ttwo\n1\t2", "\t", false))).toEqual([["one", "two"], ["1", "2"]]);
		expect(JSON.parse(csvToJson(",name\n1,Ada"))).toEqual([{ column_1: "1", name: "Ada" }]);
	});

	it("serializes JSON arrays with proper escaping, union headers, and empty null cells", () => {
		const csv = jsonToCsv('[{"name":"Ada, A.","note":"said \\"hi\\"","extra":null},{"name":"Bo","active":true}]');
		expect(csv).toEqual('name,note,extra,active\r\n"Ada, A.","said ""hi""",,\r\nBo,,,true');
		expect(JSON.parse(csvToJson(csv))).toEqual([
			{ name: "Ada, A.", note: 'said "hi"', extra: "", active: "" },
			{ name: "Bo", note: "", extra: "", active: "true" },
		]);
	});

	it("rejects malformed quoting, mismatched rows, empty data, and invalid JSON shapes", () => {
		expect(() => csvToJson(" ")).toThrow(/Paste CSV/u);
		expect(() => csvToJson('a,b\n1,"unterminated')).toThrow(/unclosed quoted/u);
		expect(() => csvToJson("a,b\n1")).toThrow(/expected 2/u);
		expect(() => csvToJson('a\n1"x')).toThrow(/Unexpected quote/u);
		expect(() => jsonToCsv("{bad")).toThrow(/Invalid JSON/u);
		expect(() => jsonToCsv("[1,2]")).toThrow(/array of objects/u);
		expect(() => jsonToCsv("[]")).toThrow(/non-empty/u);
	});
});

describe("JSONPath query tester", () => {
	const data = '{"books":[{"title":"A","price":5},{"title":"B","price":12}],"meta":{"count":2}}';

	it("returns values and JSON Pointers for selected nodes", () => {
		expect(queryJsonPath(data, "$.books[*].title")).toEqual([
			{ pointer: "/books/0/title", value: "A" },
			{ pointer: "/books/1/title", value: "B" },
		]);
		expect(queryJsonPath(data, "$..count")).toEqual([{ pointer: "/meta/count", value: 2 }]);
	});

	it("supports safe filters and blocks JavaScript evaluation", () => {
		expect(queryJsonPath(data, "$.books[?(@.price < 10)].title")).toEqual([
			{ pointer: "/books/0/title", value: "A" },
		]);
		expect(() => queryJsonPath(data, "$[?(()=>globalThis.process.exit())]")).toThrow(/Invalid JSONPath/u);
	});

	it("validates query and data limits and reports invalid JSONPath", () => {
		expect(() => queryJsonPath("", "$.")).toThrow(/Paste JSON/u);
		expect(() => queryJsonPath(data, " ")).toThrow(/Enter a JSONPath/u);
		expect(() => queryJsonPath("{bad", "$.*")).toThrow(/Invalid JSON/u);
		expect(() => queryJsonPath(data, "not a path")).toThrow(/must start with/u);
		expect(() => queryJsonPath(data, "$".repeat(2_001))).toThrow(/2,000/u);
	});
});

describe("Draft 2020-12 JSON Schema validator", () => {
	const schema = JSON.stringify({
		$schema: "https://json-schema.org/draft/2020-12/schema",
		type: "object",
		required: ["id", "email"],
		properties: { id: { type: "integer" }, email: { type: "string", format: "email" } },
		additionalProperties: false,
	});

	it("validates JSON and standard formats", () => {
		expect(validateJsonSchema('{"id":1,"email":"ada@example.com"}', schema)).toEqual({
			valid: true,
			issues: [],
			omittedIssues: 0,
		});
	});

	it("reports instance paths and multiple violations", () => {
		const result = validateJsonSchema('{"id":"one","email":"not-email","extra":true}', schema);
		expect(result.valid).toBe(false);
		expect(result.issues).toHaveLength(3);
		expect(result.issues.map(({ path, keyword }) => [path, keyword])).toEqual([
			["$ (root)", "additionalProperties"],
			["/id", "type"],
			["/email", "format"],
		]);
	});

	it("caps displayed errors and supports boolean schemas", () => {
		const required = Array.from({ length: 105 }, (_, index) => `key${index}`);
		const result = validateJsonSchema("{}", JSON.stringify({ type: "object", required }));
		expect(result.issues).toHaveLength(100);
		expect(result.omittedIssues).toBe(5);
		expect(validateJsonSchema("123", "true").valid).toBe(true);
		expect(validateJsonSchema("123", "false").valid).toBe(false);
	});

	it("rejects invalid data/schema input, invalid schema types, and unresolved references", () => {
		expect(() => validateJsonSchema(" ", schema)).toThrow(/both/u);
		expect(() => validateJsonSchema("{bad", schema)).toThrow(/JSON data is invalid/u);
		expect(() => validateJsonSchema("{}", "{bad")).toThrow(/Schema is invalid JSON/u);
		expect(() => validateJsonSchema("{}", "null")).toThrow(/schema object or a boolean/u);
		expect(() => validateJsonSchema("{}", '{"$ref":"https://example.invalid/schema.json"}')).toThrow(/Could not validate/u);
	});
});

describe("local file checksum generator", () => {
	const subtle = webcrypto.subtle as unknown as SubtleCrypto;

	it("produces standard SHA-256 digests for text files and handles empty files", async () => {
		const hello = new File(["abc"], "hello.txt");
		await expect(hashFile(hello, "SHA-256", subtle)).resolves.toEqual({
			fileName: "hello.txt",
			size: 3,
			algorithm: "SHA-256",
			digest: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		});
		await expect(hashFile(new File([], "empty"), "SHA-256", subtle)).resolves.toMatchObject({
			digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		});
	});

	it("enforces file limits and secure-crypto availability", async () => {
		const oversized = { size: maximumHashFileBytes + 1, arrayBuffer: vi.fn() } as unknown as Blob;
		await expect(hashFile(oversized, "SHA-256", subtle)).rejects.toThrow(/64 MiB/u);
		expect(oversized.arrayBuffer).not.toHaveBeenCalled();
		await expect(hashFile(new Blob(["x"]), "SHA-256", null)).rejects.toThrow(/not available/u);
	});
});

describe(".gitignore template generator", () => {
	it("combines selected templates without duplicate rules", () => {
		const output = generateGitignore(["node", "python", "macos"]);
		expect(output).toContain("# Generated for Node.js / Next.js, Python, macOS");
		expect(output).toContain("node_modules/");
		expect(output).toContain("__pycache__/");
		expect(output).toContain(".DS_Store");
		expect(output.split("node_modules/")).toHaveLength(2);
	});

	it("requires at least one known template", () => {
		expect(() => generateGitignore([])).toThrow(/at least one/u);
		expect(() => generateGitignore(["unknown"] as never)).toThrow(/supported/u);
	});
});
