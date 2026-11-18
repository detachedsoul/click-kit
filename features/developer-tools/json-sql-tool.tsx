"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { createTableFromJson, jsonToSqlInsert, type SqlDialect } from "@/features/developer-tools/json-sql-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, SegmentedControl, selectClassName, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `[
  { "id": 1, "name": "Ada", "active": true, "score": 9.5, "meta": { "plan": "pro" } },
  { "id": 2, "name": "O'Hara", "active": false, "score": null }
]`;

type Mode = "insert" | "create";

export const JsonSqlTool = () => {
	const [mode, setMode] = useState<Mode>("insert");
	const [source, setSource] = useState(sample);
	const [table, setTable] = useState("records");
	const [dialect, setDialect] = useState<SqlDialect>("postgres");
	const [multiRow, setMultiRow] = useState(true);
	const result = useMemo(() => {
		try {
			const sql =
				mode === "insert"
					? jsonToSqlInsert(source, { table, dialect, multiRow })
					: createTableFromJson(source, { table, dialect });
			return { sql, error: "" };
		} catch (error) {
			return { sql: "", error: error instanceof Error ? error.message : "Could not build SQL." };
		}
	}, [mode, source, table, dialect, multiRow]);
	return (
		<ToolPanel>
			<div className="flex flex-wrap items-end gap-4">
				<SegmentedControl<Mode>
					label="Output"
					options={[
						{ id: "insert", label: "INSERT rows" },
						{ id: "create", label: "CREATE TABLE" },
					]}
					value={mode}
					onChange={setMode}
				/>
				<label className={`${labelClassName} w-40`} htmlFor="sql-table">
					Table name
					<input className={fieldClassName} id="sql-table" value={table} onChange={(event) => setTable(event.target.value)} placeholder="records" />
				</label>
				<div className="w-44">
					<label className={labelClassName} htmlFor="sql-dialect">
						Dialect
					</label>
					<SelectField
						className={selectClassName}
						id="sql-dialect"
						value={dialect}
						onChange={(event) => setDialect(event.target.value as SqlDialect)}
					>
						<option value="postgres">PostgreSQL</option>
						<option value="mysql">MySQL / MariaDB</option>
						<option value="sqlite">SQLite</option>
					</SelectField>
				</div>
				{mode === "insert" && (
					<CheckboxField checked={multiRow} className="w-fit pb-2" label="Single multi-row statement" onChange={setMultiRow} />
				)}
			</div>
			<TextAreaField id="json-sql-input" label="JSON rows" value={source} onChange={setSource} placeholder="Paste an object or array of objects…" rows={12} />
			<ErrorNote message={result.error} />
			{!result.error && <ResultBlock title="SQL output" value={result.sql} rows={14} fileName="data.sql" />}
			<p className={hintClassName}>
				Column names come from the union of keys; missing values insert as NULL. Quotes are escaped, and nested objects or arrays are stored as
				JSON text.
			</p>
		</ToolPanel>
	);
};
