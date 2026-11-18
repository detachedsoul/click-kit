import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TomlJsonTool } from "@/features/developer-tools/toml-tool";
import { jsonToToml, tomlToJson } from "@/features/developer-tools/toml-utils";

afterEach(cleanup);

describe("TOML and JSON converter", () => {
	it("parses tables, arrays of tables, dates, and inline tables", () => {
		const json = JSON.parse(
			tomlToJson(
				'title = "demo"\nwhen = 1979-05-27T07:32:00Z\npoint = { x = 1, y = 2 }\n[[items]]\nid = 1\n[[items]]\nid = 2\n',
			),
		);
		expect(json).toEqual({
			title: "demo",
			when: "1979-05-27T07:32:00.000Z",
			point: { x: 1, y: 2 },
			items: [{ id: 1 }, { id: 2 }],
		});
	});

	it("writes nested tables and arrays back to TOML", () => {
		const toml = jsonToToml('{"name":"demo","nested":{"flag":true},"list":[1,2,3],"rows":[{"id":1},{"id":2}]}');
		expect(toml).toContain('name = "demo"');
		expect(toml).toContain("[nested]");
		expect(toml).toContain("flag = true");
		expect(toml).toContain("list = [ 1, 2, 3 ]");
		expect(toml).toContain("[[rows]]");
	});

	it("round-trips a document through both directions", () => {
		const source = '{"app":{"name":"kit","tags":["a","b"]},"count":2}';
		expect(JSON.parse(tomlToJson(jsonToToml(source)))).toEqual(JSON.parse(source));
	});

	it("rejects empty input, broken documents, and non-table roots", () => {
		expect(() => tomlToJson("  ")).toThrow(/Paste TOML/u);
		expect(() => tomlToJson("a = ")).toThrow(/Invalid TOML/u);
		expect(() => jsonToToml("")).toThrow(/Paste JSON/u);
		expect(() => jsonToToml("[1,2]")).toThrow(/table \(object\)/u);
		expect(() => jsonToToml('{"a":1')).toThrow(/Invalid JSON/u);
	});

	it("explains that TOML cannot represent null", () => {
		expect(() => jsonToToml('{"ok":1,"nested":{"bad":null}}')).toThrow(/nested\.bad/u);
	});

	it("renders and converts both directions with live output", async () => {
		const user = userEvent.setup();
		render(<TomlJsonTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"title": "ClickKit"');
		await user.click(screen.getByRole("button", { name: "JSON to TOML" }));
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain('title = "ClickKit"');
		expect(output).toContain("[[features]]");
		fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: '{"a":1}' } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("a = 1");
	});

	it("shows an alert for malformed input", () => {
		render(<TomlJsonTool />);
		fireEvent.change(screen.getByLabelText("TOML input"), { target: { value: "a = " } });
		expect(screen.getByRole("alert").textContent).toContain("Invalid TOML");
	});
});
