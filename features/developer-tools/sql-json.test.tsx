import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseSqlInserts, sqlToJson } from "@/features/developer-tools/sql-json-utils";
import { SqlJsonTool } from "@/features/developer-tools/sql-json-tool";

afterEach(cleanup);

describe("SQL INSERT to JSON", () => {
	it("parses values with casts and escaped quotes", () => {
		const report = parseSqlInserts(
			"INSERT INTO people (id, name, active, note, score) VALUES (1, 'O''Brien', TRUE, NULL, 12.5), (2, 'Ada', false, 'hi', -3);",
		);
		expect(report.tables).toHaveLength(1);
		expect(report.tables[0].columns).toEqual(["id", "name", "active", "note", "score"]);
		expect(report.tables[0].rows).toEqual([
			{ id: 1, name: "O'Brien", active: true, note: null, score: 12.5 },
			{ id: 2, name: "Ada", active: false, note: "hi", score: -3 },
		]);
	});

	it("keeps everything as strings when casting is off", () => {
		const converted = sqlToJson("INSERT INTO t (a, b) VALUES (1, 'x');", { castTypes: false, wrap: false });
		expect(JSON.parse(converted.text)).toEqual([{ a: "1", b: "x" }]);
	});

	it("derives column names and handles quoted identifiers", () => {
		const report = parseSqlInserts('INSERT INTO "public"."orders" (`id`, "total") VALUES (7, 42);');
		expect(report.tables[0].table).toBe("orders");
		expect(report.tables[0].columns).toEqual(["id", "total"]);
		expect(parseSqlInserts("INSERT INTO logs VALUES (1, 'a');").tables[0].rows[0]).toEqual({ column_1: 1, column_2: "a" });
	});

	it("groups multiple tables and skips non-INSERT statements", () => {
		const converted = sqlToJson("CREATE TABLE x (id int);\nINSERT INTO a (id) VALUES (1);\nINSERT INTO b (id) VALUES (2), (3);", { castTypes: true, wrap: true });
		expect(JSON.parse(converted.text)).toEqual({ tables: { a: [{ id: 1 }], b: [{ id: 2 }, { id: 3 }] } });
		expect(converted.report.statements).toBe(2);
		expect(converted.report.warnings[0]).toContain("Skipped a CREATE statement");
	});

	it("strips comments and warns about column mismatches", () => {
		const report = parseSqlInserts("-- leading note\nINSERT INTO t (a, b) VALUES (1, 2, 3); /* trailing */");
		expect(report.tables[0].rows[0]).toEqual({ a: 1, b: 2 });
		expect(report.warnings.some((warning) => warning.includes("3 values but 2 columns"))).toBe(true);
	});

	it("rejects unusable input", () => {
		expect(() => parseSqlInserts("   ")).toThrow(/Paste INSERT statements/u);
		expect(() => parseSqlInserts("SELECT * FROM t;")).toThrow(/No INSERT statements/u);
		expect(() => parseSqlInserts("INSERT INTO t (a) VALUES ('open;")).toThrow(/Unterminated string/u);
	});

	it("renders converted rows", () => {
		render(<SqlJsonTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain('"name": "Ada Lovelace"');
		expect(output()).toContain('"notes": "It\'s a trial"');
		expect(output()).toContain('"customers"');
		fireEvent.click(screen.getByLabelText("Cast numbers, booleans, and NULL (off = everything is a string)"));
		expect(output()).toContain('"seats": "4"');
		fireEvent.change(screen.getByLabelText("SQL INSERT statements"), { target: { value: "not sql" } });
		expect(screen.getByText(/No INSERT statements|unrecognised/u)).toBeTruthy();
	});
});
