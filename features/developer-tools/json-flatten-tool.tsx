"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { flattenJson, unflattenJson } from "@/features/developer-tools/json-flatten-utils";
import {
	ErrorNote,
	ResultBlock,
	SegmentedControl,
	ToolPanel,
	hintClassName,
	labelClassName,
	selectClassName,
} from "@/features/developer-tools/tool-ui";

const sampleNested = `{
  "user": {
    "id": 42,
    "profile": { "name": "Ada", "roles": ["admin", "editor"] }
  },
  "active": true
}`;

const sampleFlat = `{
  "user.id": 42,
  "user.profile.name": "Ada",
  "user.profile.roles.0": "admin",
  "user.profile.roles.1": "editor",
  "active": true
}`;

type Direction = "flatten" | "unflatten";

export const JsonFlattenTool = () => {
	const [direction, setDirection] = useState<Direction>("flatten");
	const [source, setSource] = useState(sampleNested);
	const [delimiter, setDelimiter] = useState<"." | "/" | "_">(".");
	const [arrayStyle, setArrayStyle] = useState<"index" | "bracket">("index");
	const result = useMemo(() => {
		try {
			return {
				output: direction === "flatten" ? flattenJson(source, { delimiter, arrayStyle }) : unflattenJson(source, { delimiter }),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this JSON." };
		}
	}, [direction, source, delimiter, arrayStyle]);
	const changeDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => (!current.trim() || current === sampleNested || current === sampleFlat ? (next === "flatten" ? sampleNested : sampleFlat) : current));
	};
	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Mode"
				options={[
					{ id: "flatten", label: "Flatten" },
					{ id: "unflatten", label: "Unflatten" },
				]}
				value={direction}
				onChange={changeDirection}
			/>
			<div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
				<div>
					<label className={labelClassName} htmlFor="flatten-delimiter">
						Key delimiter
					</label>
					<SelectField
						className={selectClassName}
						id="flatten-delimiter"
						value={delimiter}
						onChange={(event) => setDelimiter(event.target.value as "." | "/" | "_")}
					>
						<option value=".">Dot — user.profile.name</option>
						<option value="/">Slash — user/profile/name</option>
						<option value="_">Underscore — user_profile_name</option>
					</SelectField>
				</div>
				{direction === "flatten" && (
					<div>
						<label className={labelClassName} htmlFor="flatten-arrays">
							Array keys
						</label>
						<SelectField
							className={selectClassName}
							id="flatten-arrays"
							value={arrayStyle}
							onChange={(event) => setArrayStyle(event.target.value as "index" | "bracket")}
						>
							<option value="index">Dotted index — roles.0</option>
							<option value="bracket">Bracket index — roles[0]</option>
						</SelectField>
					</div>
				)}
			</div>
			<TextAreaField
				id="flatten-input"
				label={direction === "flatten" ? "Nested JSON" : "Flattened JSON"}
				value={source}
				onChange={setSource}
				placeholder={direction === "flatten" ? "Paste nested JSON…" : "Paste path keys and values…"}
				rows={13}
				hint="Delimiters inside keys are escaped with a backslash. Unflatten rebuilds arrays from consecutive numeric keys starting at 0."
			/>
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock
					title={direction === "flatten" ? "Flattened JSON" : "Nested JSON"}
					value={result.output}
					fileName={direction === "flatten" ? "flattened.json" : "nested.json"}
				/>
			)}
			<p className={hintClassName}>Large documents are capped at 20,000 flattened keys.</p>
		</ToolPanel>
	);
};
