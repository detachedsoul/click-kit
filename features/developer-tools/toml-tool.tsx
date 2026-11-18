"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToToml, tomlToJson } from "@/features/developer-tools/toml-utils";
import { ErrorNote, ResultBlock, SegmentedControl, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";

const sampleToml = `title = "ClickKit"
version = "1.4.0"

[owner]
name = "Ada Lovelace"
joined = 2024-03-01T09:30:00Z

[[features]]
name = "toml"
stable = true

[[features]]
name = "json"
stable = true
`;

const sampleJson = `{
  "title": "ClickKit",
  "version": "1.4.0",
  "owner": {
    "name": "Ada Lovelace",
    "joined": "2024-03-01T09:30:00.000Z"
  },
  "features": [
    { "name": "toml", "stable": true },
    { "name": "json", "stable": true }
  ]
}
`;

type Direction = "toml-to-json" | "json-to-toml";

export const TomlJsonTool = () => {
	const [direction, setDirection] = useState<Direction>("toml-to-json");
	const [source, setSource] = useState(sampleToml);
	const result = useMemo(() => {
		try {
			return {
				output: direction === "toml-to-json" ? tomlToJson(source) : jsonToToml(source),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this document." };
		}
	}, [direction, source]);
	const changeDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => (!current.trim() || current === sampleToml || current === sampleJson ? (next === "toml-to-json" ? sampleToml : sampleJson) : current));
	};
	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Conversion direction"
				options={[
					{ id: "toml-to-json", label: "TOML to JSON" },
					{ id: "json-to-toml", label: "JSON to TOML" },
				]}
				value={direction}
				onChange={changeDirection}
			/>
			<TextAreaField
				id="toml-input"
				label={direction === "toml-to-json" ? "TOML input" : "JSON input"}
				value={source}
				onChange={setSource}
				placeholder={direction === "toml-to-json" ? "Paste TOML…" : "Paste a JSON object…"}
				rows={14}
				hint="Dates, arrays of tables, and inline tables are supported. JSON dates become TOML offset date-times, and nulls are rejected because TOML has no null type."
			/>
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock
					title={direction === "toml-to-json" ? "JSON output" : "TOML output"}
					value={result.output}
					fileName={direction === "toml-to-json" ? "converted.json" : "converted.toml"}
				/>
			)}
			<p className={hintClassName}>Everything runs locally in this tab; nothing is uploaded.</p>
		</ToolPanel>
	);
};
