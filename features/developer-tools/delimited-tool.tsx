"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { convertDelimited, delimiterLabel, type DelimitedOutput, type Delimiter } from "@/features/developer-tools/delimited-utils";
import { CheckboxField, CheckboxRow, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `id,name,role,joined
1,Ada Lovelace,engineer,1843-01-01
2,"Hopper, Grace",admiral,1944-06-01
3,Alan Turing,researcher,1936-05-28`;

const outputOptions: { id: DelimitedOutput; label: string }[] = [
	{ id: "json", label: "JSON objects" },
	{ id: "json-array", label: "JSON arrays" },
	{ id: "csv", label: "CSV" },
	{ id: "tsv", label: "TSV" },
	{ id: "markdown", label: "Markdown table" },
	{ id: "sql", label: "SQL INSERT" },
];

export const DelimitedTool = () => {
	const [source, setSource] = useState(sample);
	const [delimiter, setDelimiter] = useState<Delimiter | "auto">("auto");
	const [output, setOutput] = useState<DelimitedOutput>("json");
	const [table, setTable] = useState("people");
	const [typed, setTyped] = useState(true);
	const result = useMemo(() => {
		try {
			const converted = convertDelimited(source, { delimiter, output, table, typed });
			return { ...converted, error: "" };
		} catch (error) {
			return { text: "", table: null, error: error instanceof Error ? error.message : "Could not parse this data." };
		}
	}, [source, delimiter, output, table, typed]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="delimited-input-delimiter">
					Input delimiter
					<select className={selectClassName} id="delimited-input-delimiter" value={delimiter} onChange={(event) => setDelimiter(event.target.value as Delimiter | "auto")}>
						<option value="auto">Detect automatically</option>
						<option value=",">Comma (CSV)</option>
						<option value="	">Tab (TSV)</option>
						<option value=";">Semicolon</option>
						<option value="|">Pipe (PSV)</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="delimited-output">
					Output format
					<select className={selectClassName} id="delimited-output" value={output} onChange={(event) => setOutput(event.target.value as DelimitedOutput)}>
						{outputOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				{output === "sql" && (
					<label className={labelClassName} htmlFor="delimited-table">
						SQL table name
						<input className={fieldClassName} id="delimited-table" value={table} onChange={(event) => setTable(event.target.value)} />
					</label>
				)}
			</div>
			{output === "json" && (
				<CheckboxRow>
					<CheckboxField checked={typed} id="delimited-typed" label={<>Infer numbers, booleans, and empty values</>} onChange={setTyped} />
				</CheckboxRow>
			)}
			<TextAreaField
				id="delimited-input"
				label="Delimited data"
				value={source}
				onChange={setSource}
				placeholder={"id,name\n1,Ada"}
				rows={12}
				hint="Quoted fields, doubled quotes, and CRLF line endings are handled. The first row is treated as the header for JSON and SQL output."
			/>
			<ErrorNote message={result.error} />
			{result.table && (
				<>
					<StatGrid
						items={[
							{ label: "Data rows", value: String(Math.max(result.table.rows.length - 1, 0)) },
							{ label: "Columns", value: String(result.table.columns) },
							{ label: "Detected delimiter", value: delimiter === "auto" ? `${delimiterLabel(result.table.delimiter)} (auto)` : delimiterLabel(result.table.delimiter) },
						]}
					/>
					<ResultBlock
						title="Output"
						value={result.text}
						rows={14}
						fileName={output === "markdown" ? "table.md" : output === "sql" ? "insert.sql" : output === "json" || output === "json-array" ? "data.json" : "data.txt"}
					/>
				</>
			)}
			<p className={hintClassName}>
				Duplicate or blank header names are renamed (<code>name_2</code>, <code>column_3</code>) so the JSON keys stay unique.
			</p>
		</ToolPanel>
	);
};
