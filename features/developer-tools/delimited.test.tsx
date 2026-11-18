import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { convertDelimited, detectDelimiter, parseDelimited, toMarkdownTable, toSql } from "@/features/developer-tools/delimited-utils";
import { DelimitedTool } from "@/features/developer-tools/delimited-tool";

afterEach(cleanup);

describe("delimiter converter", () => {
	it("detects the delimiter and parses quoted fields", () => {
		expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
		expect(detectDelimiter("a\tb\tc")).toBe("\t");
		expect(detectDelimiter("a;b;c")).toBe(";");
		expect(detectDelimiter('a,b\n"x,y",z')).toBe(",");
		const table = parseDelimited('id,name\n1,"Hopper, Grace"\n2,"Say ""hi"""');
		expect(table.rows[1]).toEqual(["1", "Hopper, Grace"]);
		expect(table.rows[2]).toEqual(["2", 'Say "hi"']);
		expect(table.columns).toBe(2);
	});

	it("pads short rows and rejects empty or unclosed input", () => {
		const table = parseDelimited("a,b,c\n1,2");
		expect(table.rows[1]).toEqual(["1", "2", ""]);
		expect(() => parseDelimited("   ")).toThrow(/Paste delimited data/u);
		expect(() => parseDelimited('a,b\n"oops,2')).toThrow(/Unclosed quote/u);
	});

	it("builds typed JSON objects with unique keys", () => {
		const converted = convertDelimited('name,count,active,note,name\nAda,3,true,,Lovelace', { delimiter: "auto", output: "json", table: "t", typed: true });
		const objects = JSON.parse(converted.text) as Record<string, unknown>[];
		expect(objects[0]).toEqual({ name: "Ada", count: 3, active: true, note: null, name_2: "Lovelace" });
		const raw = convertDelimited("a\n007", { delimiter: "auto", output: "json", table: "t", typed: false });
		expect(raw.text).toContain('"007"');
	});

	it("renders TSV, markdown, and SQL output", () => {
		const table = parseDelimited("id,name\n1,Ada's work\n2,Bob", ",");
		expect(convertDelimited("id,name\n1,Ada", { delimiter: ",", output: "tsv", table: "t", typed: true }).text).toBe("id\tname\n1\tAda");
		expect(toMarkdownTable(parseDelimited("id,name\n1,a|b", ","))).toBe("| id | name |\n| --- | --- |\n| 1 | a\\|b |");
		expect(toSql(table, "people", "postgres")).toContain('INSERT INTO "people" ("id", "name")');
		expect(toSql(table, "people", "mysql")).toContain("`people`");
		expect(toSql(table, "people", "sqlite")).toContain("'Ada''s work'");
	});

	it("renders stats and switches output format", async () => {
		const user = userEvent.setup();
		render(<DelimitedTool />);
		expect(screen.getByText(/comma \(auto\)/u)).toBeTruthy();
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"role": "engineer"');
		await user.selectOptions(screen.getByLabelText("Output format"), "markdown");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("| --- |");
		await user.selectOptions(screen.getByLabelText("Output format"), "sql");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('INSERT INTO "people"');
		fireEvent.change(screen.getByLabelText("Delimited data"), { target: { value: "" } });
		expect(screen.getByText(/Paste delimited data/u)).toBeTruthy();
	});
});
