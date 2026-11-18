"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToQuery, queryToJson } from "@/features/developer-tools/query-utils";
import { CheckboxField, ErrorNote, hintClassName, ResultBlock, SegmentedControl, ToolPanel } from "@/features/developer-tools/tool-ui";

const sampleQuery = "?tag=typescript&tag=json&filter[status]=active&filter[limit]=20&page=2";
const sampleJson = `{
  "tag": ["typescript", "json"],
  "filter": { "status": "active", "limit": "20" },
  "page": "2"
}`;

type Direction = "query-to-json" | "json-to-query";

export const QueryJsonTool = () => {
	const [direction, setDirection] = useState<Direction>("query-to-json");
	const [source, setSource] = useState(sampleQuery);
	const [plusAsSpace, setPlusAsSpace] = useState(true);
	const [leading, setLeading] = useState(false);
	const result = useMemo(() => {
		try {
			return {
				output: direction === "query-to-json" ? queryToJson(source, { plusAsSpace }) : jsonToQuery(source, { leading }),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this data." };
		}
	}, [direction, source, plusAsSpace, leading]);
	const changeDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => (!current.trim() || current === sampleQuery || current === sampleJson ? (next === "query-to-json" ? sampleQuery : sampleJson) : current));
	};
	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Conversion direction"
				options={[
					{ id: "query-to-json", label: "Query string to JSON" },
					{ id: "json-to-query", label: "JSON to query string" },
				]}
				value={direction}
				onChange={changeDirection}
			/>
			<div className="flex flex-wrap items-center gap-5">
				{direction === "query-to-json" ? (
					<CheckboxField
						checked={plusAsSpace}
						className="py-1"
						label={<>Treat <code className="font-mono text-[11px]">+</code> as a space</>}
						onChange={setPlusAsSpace}
					/>
				) : (
					<label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-xs text-ink">
						<input
							className="checkbox-input"
							type="checkbox"
							checked={leading}
							onChange={(event) => setLeading(event.target.checked)}
						/>
						Start the result with <code className="font-mono text-[11px]">?</code>
					</label>
				)}
			</div>
			<TextAreaField
				id="query-input"
				label={direction === "query-to-json" ? "Query string" : "JSON object"}
				value={source}
				onChange={setSource}
				placeholder={direction === "query-to-json" ? "?a=1&b=2" : '{"a":"1","b":"2"}'}
				rows={12}
				hint="Repeated keys become arrays, key[0] style indexes rebuild arrays, and key[sub] groups become nested objects. Values stay strings, as HTTP delivers them."
			/>
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock
					title={direction === "query-to-json" ? "JSON output" : "Query string output"}
					value={result.output}
					fileName={direction === "query-to-json" ? "query.json" : "query.txt"}
				/>
			)}
			<p className={hintClassName}>Parsing and encoding both happen locally; full URLs stay in your browser.</p>
		</ToolPanel>
	);
};
