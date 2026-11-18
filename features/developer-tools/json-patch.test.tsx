import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JsonPatchTool } from "@/features/developer-tools/json-patch-tool";
import { applyJsonPatch, generateJsonPatch, summariseJsonPatch } from "@/features/developer-tools/json-patch-utils";

afterEach(cleanup);

describe("JSON Patch generator", () => {
	it("returns no operations for identical documents", () => {
		expect(generateJsonPatch('{"a":1}', '{"a":1}')).toEqual([]);
	});

	it("builds add, remove, and replace operations for nested objects", () => {
		const operations = generateJsonPatch('{"a":1,"b":{"c":2},"gone":true}', '{"a":2,"b":{"c":3,"d":4}}');
		expect(operations).toEqual([
			{ op: "remove", path: "/gone" },
			{ op: "replace", path: "/a", value: 2 },
			{ op: "replace", path: "/b/c", value: 3 },
			{ op: "add", path: "/b/d", value: 4 },
		]);
	});

	it("diffs arrays of equal length and replaces arrays that change size", () => {
		expect(generateJsonPatch('{"list":[1,2]}', '{"list":[1,5]}')).toEqual([{ op: "replace", path: "/list/1", value: 5 }]);
		expect(generateJsonPatch('{"list":[1,2]}', '{"list":[1,2,3]}')).toEqual([{ op: "replace", path: "/list", value: [1, 2, 3] }]);
	});

	it("escapes JSON Pointer tokens and replaces the root", () => {
		expect(generateJsonPatch('{"a/b":1}', '{"a/b":2}')).toEqual([{ op: "replace", path: "/a~1b", value: 2 }]);
		expect(generateJsonPatch('{"a~b":1}', '{"a~b":2}')).toEqual([{ op: "replace", path: "/a~0b", value: 2 }]);
		expect(generateJsonPatch('{"a":1}', '"now a string"')).toEqual([{ op: "replace", path: "", value: "now a string" }]);
	});

	it("applies generated patches back to the original", () => {
		const original = '{"a":1,"list":[{"x":1}],"drop":true}';
		const updated = '{"a":2,"list":[{"x":9}],"added":{"deep":true}}';
		const operations = generateJsonPatch(original, updated);
		expect(applyJsonPatch(original, operations)).toEqual(JSON.parse(updated));
		expect(summariseJsonPatch(operations)).toEqual({ add: 1, remove: 1, replace: 2 });
	});

	it("rejects missing or malformed documents", () => {
		expect(() => generateJsonPatch("", "{}")).toThrow(/Paste the original JSON/u);
		expect(() => generateJsonPatch("{}", "{oops")).toThrow(/updated document is not valid JSON/u);
	});

	it("renders a patch and summary statistics", () => {
		render(<JsonPatchTool />);
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain('"op": "replace"');
		expect(screen.getByText(/Applying this patch/u)).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Updated document"), { target: { value: '{"name":"ClickKit","version":1,"tags":["tools"],"owner":{"name":"Ada"}}' } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("[]");
	});
});
