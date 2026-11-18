"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonArrayToJsonLines, jsonLinesToArray, formatJsonLines, type JsonlFormat } from "@/features/developer-tools/jsonl-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, selectClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const sample = `{"id":1,"name":"Ada","active":true}
{"id":2,"name":"Grace","active":false}
{"id":3,"name":"Linus"}`;

type Mode = "format" | "to-lines" | "to-array";

export const JsonlTool = () => {
	const [source, setSource] = useState(sample);
	const [format, setFormat] = useState<JsonlFormat>("compact");
	const [mode, setMode] = useState<Mode>("format");
	const result = useMemo(() => {
		try {
			if (mode === "to-array") return { output: jsonLinesToArray(source, format), report: null, error: "" };
			if (mode === "to-lines") return { output: jsonArrayToJsonLines(source, format), report: null, error: "" };
			const report = formatJsonLines(source, format);
			return { output: report.output, report, error: "" };
		} catch (error) {
			return { output: "", report: null, error: error instanceof Error ? error.message : "Could not process this input." };
		}
	}, [source, format, mode]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="jsonl-mode">
					Conversion
					<select className={selectClassName} id="jsonl-mode" value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
						<option value="format">Reformat JSON Lines</option>
						<option value="to-array">JSON array → JSON Lines</option>
						<option value="to-lines">JSON Lines → JSON array</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="jsonl-format">
					Output layout
					<select className={selectClassName} id="jsonl-format" value={format} onChange={(event) => setFormat(event.target.value as JsonlFormat)}>
						<option value="compact">One object per line</option>
						<option value="pretty">Pretty-printed records</option>
						<option value="sorted">Sorted keys</option>
					</select>
				</label>
			</div>
			<TextAreaField
				id="jsonl-input"
				label={mode === "to-lines" ? "JSON array" : "JSON Lines input"}
				value={source}
				onChange={setSource}
				placeholder={mode === "to-lines" ? '[{"id":1},{"id":2}]' : '{"id":1}\n{"id":2}'}
				rows={12}
				hint="Blank lines are skipped. Every other line must be one complete JSON value, which is how JSONL/NDJSON is written."
			/>
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Records", value: String(result.report.records) },
							{ label: "Failed lines", value: String(result.report.errors.length) },
							{ label: "Blank lines", value: String(result.report.blankLines) },
							{ label: "Distinct fields", value: String(result.report.fields.length) },
						]}
					/>
					{result.report.errors.length > 0 && (
						<ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-[#8a3028]">
							{result.report.errors.map((error) => (
								<li key={error.line}>
									Line {error.line}: {error.message}
								</li>
							))}
						</ul>
					)}
					{result.report.fields.length > 0 && <p className="m-0 font-mono text-[11px] text-[#5b5e55]">Fields: {result.report.fields.join(", ")}</p>}
				</>
			)}
			{result.output && (
				<>
					<ResultBlock title="Output" value={result.output} rows={14} fileName={mode === "to-array" ? "records.json" : "records.jsonl"} />
				</>
			)}
		</ToolPanel>
	);
};
