import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { formatJsonLines, jsonArrayToJsonLines, jsonLinesToArray } from "@/features/developer-tools/jsonl-utils";
import { JsonlTool } from "@/features/developer-tools/jsonl-tool";

afterEach(cleanup);

describe("JSON Lines toolkit", () => {
	it("counts valid records, fields, and blank lines", () => {
		const report = formatJsonLines('{"id":1,"name":"Ada"}\n\n{"id":2,"name":"Grace"}\n');
		expect(report.records).toBe(2);
		expect(report.blankLines).toBe(1);
		expect(report.fields).toEqual(["id", "name"]);
		expect(report.output.split("\n")).toHaveLength(2);
		expect(report.errors).toEqual([]);
	});

	it("reports failing lines without discarding valid ones", () => {
		const report = formatJsonLines('{"id":1}\n{"id": \n{"id":3}');
		expect(report.records).toBe(2);
		expect(report.errors).toHaveLength(1);
		expect(report.errors[0].line).toBe(2);
		expect(report.output).toBe('{"id":1}\n{"id":3}');
	});

	it("pretty prints nested records and sorts keys", () => {
		const pretty = formatJsonLines('{"a":{"b":1},"c":[1,2]}', "pretty");
		expect(pretty.output).toContain('\n  "a": {\n    "b": 1\n  }');
		const sorted = formatJsonLines('{"z":1,"a":{"y":2,"b":3}}', "sorted");
		expect(sorted.output).toBe('{"a":{"b":3,"y":2},"z":1}');
	});

	it("converts between arrays and lines", () => {
		expect(jsonArrayToJsonLines('[{"b":2,"a":1}]', "sorted")).toBe('{"a":1,"b":2}');
		expect(jsonLinesToArray('{"id":1}\n{"id":2}')).toBe('[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]');
		expect(() => jsonArrayToJsonLines('{"id":1}')).toThrow(/Expected a JSON array/u);
		expect(() => jsonArrayToJsonLines("[]")).toThrow(/empty/u);
	});

	it("rejects empty or wholly invalid input", () => {
		expect(() => formatJsonLines("   ")).toThrow(/Paste newline-delimited JSON/u);
		expect(() => formatJsonLines("nope\nalso nope")).toThrow(/Every line failed/u);
	});

	it("renders counts and switches conversion mode", async () => {
		const user = userEvent.setup();
		render(<JsonlTool />);
		expect(screen.getAllByText("3").length).toBeGreaterThan(0);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe(sampleValue);
		await user.selectOptions(screen.getByLabelText("Conversion"), "to-array");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe('[{"id":1,"name":"Ada","active":true},{"id":2,"name":"Grace","active":false},{"id":3,"name":"Linus"}]');
		fireEvent.change(screen.getByLabelText("JSON Lines input"), { target: { value: "1\n2" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("[1,2]");
		await user.selectOptions(screen.getByLabelText("Conversion"), "to-lines");
		fireEvent.change(screen.getByLabelText("JSON array"), { target: { value: '[{"id":1},{"id":2}]' } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe('{"id":1}\n{"id":2}');
		await user.selectOptions(screen.getByLabelText("Conversion"), "format");
		fireEvent.change(screen.getByLabelText("JSON Lines input"), { target: { value: '{"a":' } });
		expect(screen.getByText(/Every line failed/u)).toBeTruthy();
	});
});

const sampleValue = `{"id":1,"name":"Ada","active":true}
{"id":2,"name":"Grace","active":false}
{"id":3,"name":"Linus"}`;
