import { describe, expect, it } from "vitest";
import { createCsvProfiler, csvProfileToCsv, inferCsvValueType } from "@/features/developer-tools/csv-profile-core";

describe("CSV profile core", () => {
	it("infers conservative column types without treating padded identifiers as numbers", () => {
		expect(inferCsvValueType("42")).toBe("integer");
		expect(inferCsvValueType("-2.5e1")).toBe("number");
		expect(inferCsvValueType("TRUE")).toBe("boolean");
		expect(inferCsvValueType("2024-06-18")).toBe("date");
		expect(inferCsvValueType("0012")).toBe("text");
		expect(inferCsvValueType("   ")).toBe("empty");
	});

	it("aggregates missing values, duplicates, unique values, numeric stats, and inconsistencies", () => {
		const profiler = createCsvProfiler(new File([""], "sample.csv"));
		profiler.setHeader(["Name", "Age", "City", "Age"]);
		profiler.addRow(["Ada", "36", "New York", "36"]);
		profiler.addRow(["Ada", "36", "New York", "36"]);
		profiler.addRow(["Bo", "41", "new york"]);
		profiler.addRow(["Cy", "unknown", "Paris", "extra", "overflow"]);
		profiler.addParseErrors(["Row 5: test parse note"]);
		const result = profiler.finish(",");

		expect(result.rowCount).toBe(4);
		expect(result.columnCount).toBe(4);
		expect(result.duplicateRows).toBe(1);
		expect(result.rowsWithMissingFields).toBe(1);
		expect(result.rowsWithExtraFields).toBe(1);
		expect(result.columns.map((column) => column.name)).toEqual(["Name", "Age", "City", "Age (2)"]);
		expect(result.columns[1]).toMatchObject({ type: "mixed", empty: 0, uniqueValues: 3, minimum: 36, maximum: 41, average: 37.666666666666664, inconsistent: true });
		expect(result.columns[2].inconsistencyNotes[0]).toContain("case or whitespace variants");
		expect(result.columns[3]).toMatchObject({ type: "mixed", nonEmpty: 3, empty: 1, average: 36, inconsistent: true });
		expect(result.preview).toHaveLength(4);
		expect(result.parseErrors).toEqual(["Row 5: test parse note"]);
	});

	it("exports a compact CSV report with safe quoting", () => {
		const profiler = createCsvProfiler(new File([""], "sample.csv"));
		profiler.setHeader(["Name, city", "Score"]);
		profiler.addRow(["New York, NY", "3"]);
		const csv = csvProfileToCsv(profiler.finish(","));
		expect(csv).toContain('"Name, city",text,1,0,1');
		expect(csv).toContain("Score,integer,1,0,1,3,3,3,");
	});
});
