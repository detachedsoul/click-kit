import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JsonZodTool } from "@/features/developer-tools/zod-tool";
import { jsonToZod } from "@/features/developer-tools/zod-utils";

afterEach(cleanup);

describe("JSON to Zod generator", () => {
	it("maps primitive types and nested objects", () => {
		const code = jsonToZod('{"id":1,"name":"Ada","active":true,"score":9.5,"profile":{"city":"Lagos"}}');
		expect(code).toContain('import { z } from "zod";');
		expect(code).toContain("export const RootSchema = z.object({");
		expect(code).toContain("id: z.number().int(),");
		expect(code).toContain("name: z.string(),");
		expect(code).toContain("active: z.boolean(),");
		expect(code).toContain("score: z.number(),");
		expect(code).toContain("city: z.string(),");
		expect(code).toContain("export type Root = z.infer<typeof RootSchema>;");
	});

	it("marks nullable values and missing keys", () => {
		const code = jsonToZod('[{"id":1,"note":null},{"id":2,"label":"x"}]');
		expect(code).toContain("note: z.null().optional(),");
		expect(code).toContain("label: z.string().optional(),");
		expect(code).toContain("id: z.number().int(),");
	});

	it("unions mixed primitive types and handles arrays", () => {
		const code = jsonToZod('{"value":"x","other":null,"list":[1,"two"],"rows":[{"a":1}],"empty":[]}');
		expect(code).toContain("value: z.string(),");
		expect(code).toContain("other: z.null(),");
		expect(code).toContain("z.union([z.number().int(), z.string()])");
		expect(code).toContain("rows: z.array(z.object({");
		expect(code).toContain("empty: z.array(z.unknown()),");
	});

	it("nullables a union when one sample is null", () => {
		const code = jsonToZod('{"a":null,"b":1}');
		expect(code).toContain("a: z.null(),");
		const nullableUnion = jsonToZod('{"a":null,"b":"x"}');
		expect(nullableUnion).toContain("a: z.null(),");
		expect(jsonToZod('{"a":1}')).toContain("a: z.number().int(),");
	});

	it("quotes keys that are not valid identifiers and supports array roots", () => {
		expect(jsonToZod('{"my-key":1}')).toContain('"my-key": z.number().int(),');
		expect(jsonToZod("[1,2]", "Counts")).toContain("export const CountsSchema = z.array(z.number().int());");
	});

	it("rejects broken input and invalid names", () => {
		expect(() => jsonToZod(" ")).toThrow(/Paste JSON/u);
		expect(() => jsonToZod("{bad")).toThrow(/Invalid JSON/u);
		expect(() => jsonToZod("{}", "  ")).toThrow(/Give the schema a name/u);
		expect(() => jsonToZod("{}", "1bad")).toThrow(/valid TypeScript identifiers/u);
	});

	it("renders the schema and updates live", () => {
		render(<JsonZodTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("RootSchema");
		fireEvent.change(screen.getByLabelText("Schema name"), { target: { value: "person" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("PersonSchema");
		fireEvent.change(screen.getByLabelText("JSON sample"), { target: { value: "{oops" } });
		expect(screen.getByRole("alert").textContent).toContain("Invalid JSON");
	});
});
