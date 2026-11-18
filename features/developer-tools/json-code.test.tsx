import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { JsonCodeTool } from "@/features/developer-tools/json-code-tool";
import { jsonToCode } from "@/features/developer-tools/json-code-utils";

afterEach(cleanup);

const sample = '{"id":7,"name":"Ada","active":true,"score":9.5,"tags":["a"],"profile":{"city":"Lagos"},"items":[{"sku":"x","qty":2}]}';

describe("JSON to typed code", () => {
	it("generates Go structs with json tags and exported names", () => {
		const code = jsonToCode(sample, "go");
		expect(code).toContain("type Root struct {");
		expect(code).toContain('ID int64 `json:"id"`');
		expect(code).toContain('Tags []string `json:"tags"`');
		expect(code).toContain('SKU string `json:"sku"`');
		expect(code).toContain("type Profile struct {");
	});

	it("generates serde-enabled Rust structs", () => {
		const code = jsonToCode(sample, "rust");
		expect(code).toContain("use serde::{Deserialize, Serialize};");
		expect(code).toContain("pub struct Root {");
		expect(code).toContain("pub tags: Vec<String>,");
		expect(code).toContain("pub items: Vec<Item>,");
	});

	it("generates Python dataclasses with optional fields last", () => {
		const code = jsonToCode('{"a":1,"b":null}', "python");
		expect(code).toContain("from dataclasses import dataclass");
		expect(code).toContain("class Root:");
		expect(code).toContain("    a: int");
		expect(code).toContain("    b: Any");
	});

	it("generates Java records and boxes optional primitives", () => {
		const code = jsonToCode('{"count":1,"label":"x","rows":[{"id":1}],"flag":null}', "java");
		expect(code).toContain("import java.util.List;");
		expect(code).toContain("public record Root(long count, String label, List<Row> rows, Object flag) {}");
		expect(code).toContain("public record Row(long id) {}");
	});

	it("marks fields missing from some array objects as optional per language", () => {
		const source = '[{"id":1},{"id":2,"name":"two"}]';
		expect(jsonToCode(source, "go")).toContain('Name *string `json:"name,omitempty"`');
		expect(jsonToCode(source, "rust")).toContain("Option<String>");
		expect(jsonToCode(source, "python")).toContain("Optional[str] = None");
	});

	it("handles primitive and array roots with a named alias", () => {
		expect(jsonToCode('["a","b"]', "go", "Tags")).toContain("type Tags []string");
		expect(jsonToCode('{"id":1}', "rust", "Row")).toContain("pub struct Row");
		expect(jsonToCode('[1,2,3]', "python", "Numbers")).toContain("Numbers = list[int]");
	});

	it("rejects empty input, broken JSON, empty root names, and deep nesting", () => {
		expect(() => jsonToCode(" ", "go")).toThrow(/Paste JSON/u);
		expect(() => jsonToCode("{bad", "go")).toThrow(/Invalid JSON/u);
		expect(() => jsonToCode("{}", "go", "  ")).toThrow(/root type a name/u);
		const deep = `${"[".repeat(45)}1${"]".repeat(45)}`;
		expect(() => jsonToCode(deep, "go")).toThrow(/nested too deeply/u);
	});

	it("renders code for the selected language and root name", async () => {
		const user = userEvent.setup();
		render(<JsonCodeTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("type Root struct");
		fireEvent.change(screen.getByLabelText("Target language"), { target: { value: "rust" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("pub struct Root");
		fireEvent.change(screen.getByLabelText("Root type name"), { target: { value: "Person" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("pub struct Person");
		await user.selectOptions(screen.getByLabelText("Target language"), "java");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("public record Person(");
	});
});
