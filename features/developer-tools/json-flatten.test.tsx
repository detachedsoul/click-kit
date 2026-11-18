import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFlattenTool } from "@/features/developer-tools/json-flatten-tool";
import { flattenJson, unflattenJson } from "@/features/developer-tools/json-flatten-utils";

afterEach(cleanup);

describe("JSON flatten and unflatten", () => {
	it("flattens nested objects and arrays to dot paths", () => {
		expect(JSON.parse(flattenJson('{"user":{"id":42,"roles":["a","b"]},"active":true}'))).toEqual({
			"user.id": 42,
			"user.roles.0": "a",
			"user.roles.1": "b",
			active: true,
		});
	});

	it("supports bracket indexes, other delimiters, and keeping arrays intact", () => {
		expect(JSON.parse(flattenJson('{"a":[1,2]}', { arrayStyle: "bracket" }))).toEqual({ "a[0]": 1, "a[1]": 2 });
		expect(JSON.parse(flattenJson('{"a":{"b":1}}', { delimiter: "/" }))).toEqual({ "a/b": 1 });
		expect(JSON.parse(flattenJson('{"a":[1,2]}', { flattenArrays: false }))).toEqual({ a: [1, 2] });
	});

	it("escapes delimiters inside keys and keeps empty containers", () => {
		const flat = JSON.parse(flattenJson('{"a.b":{"c":1},"empty":{},"list":[]}'));
		expect(flat).toEqual({ "a\\.b.c": 1, empty: {}, list: [] });
		expect(JSON.parse(unflattenJson(JSON.stringify(flat)))).toEqual({ "a.b": { c: 1 }, empty: {}, list: [] });
	});

	it("rebuilds nested objects and arrays when unflattening", () => {
		expect(
			JSON.parse(
				unflattenJson('{"user.id":42,"user.roles.0":"a","user.roles.1":"b","flags":{"beta":true}}'),
			),
		).toEqual({ user: { id: 42, roles: ["a", "b"] }, flags: { beta: true } });
		expect(JSON.parse(unflattenJson('{"items[0].id":1,"items[1].id":2}'))).toEqual({ items: [{ id: 1 }, { id: 2 }] });
	});

	it("round-trips a realistic document", () => {
		const source = '{"a":{"b":[{"c":1},{"c":2}]},"d":null}';
		expect(JSON.parse(unflattenJson(flattenJson(source)))).toEqual(JSON.parse(source));
	});

	it("rejects empty input, invalid JSON, conflicts, and non-object roots", () => {
		expect(() => flattenJson(" ")).toThrow(/Paste JSON/u);
		expect(() => flattenJson("{bad")).toThrow(/Invalid JSON/u);
		expect(() => unflattenJson("[]")).toThrow(/JSON object/u);
		expect(() => unflattenJson('{"a":1,"a.b":2}')).toThrow(/non-object value/u);
		expect(() => unflattenJson('{"a.b":1,"a.b":2}')).not.toThrow();
	});

	it("renders flattened output and switches direction", async () => {
		const user = userEvent.setup();
		render(<JsonFlattenTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"user.profile.roles.0": "admin"');
		fireEvent.change(screen.getByLabelText("Array keys"), { target: { value: "bracket" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"user.profile.roles[0]"');
		await user.click(screen.getByRole("button", { name: "Unflatten" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"roles": [');
	});
});
