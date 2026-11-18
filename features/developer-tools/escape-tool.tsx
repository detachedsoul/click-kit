"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { escapeExamples, transformEscapes, type EscapeDirection, type EscapeMode } from "@/features/developer-tools/escape-utils";
import { ErrorNote, ResultBlock, SegmentedControl, ToolPanel, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const modes: { id: EscapeMode; label: string }[] = [
	{ id: "json", label: "JSON string" },
	{ id: "javascript", label: "JavaScript string" },
	{ id: "sql", label: "SQL literal" },
	{ id: "shell", label: "Shell argument" },
	{ id: "regex", label: "Regular expression" },
	{ id: "unicode", label: "Unicode escapes" },
];

export const EscapeTool = () => {
	const [mode, setMode] = useState<EscapeMode>("json");
	const [direction, setDirection] = useState<EscapeDirection>("escape");
	const [source, setSource] = useState(escapeExamples.json);
	const result = useMemo(() => {
		try {
			return { output: transformEscapes(source, mode, direction), error: "" };
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not transform this text." };
		}
	}, [source, mode, direction]);
	const changeMode = (next: EscapeMode) => {
		setMode(next);
		setSource((current) => (!current.trim() || Object.values(escapeExamples).includes(current) ? escapeExamples[next] : current));
	};
	return (
		<ToolPanel>
			<div className="flex flex-wrap items-end gap-4">
				<SegmentedControl<EscapeDirection>
					label="Direction"
					options={[
						{ id: "escape", label: "Escape" },
						{ id: "unescape", label: "Unescape" },
					]}
					value={direction}
					onChange={setDirection}
				/>
				<div className="w-56">
					<label className={labelClassName} htmlFor="escape-mode">
						Context
					</label>
					<SelectField
						className={selectClassName}
						id="escape-mode"
						value={mode}
						onChange={(event) => changeMode(event.target.value as EscapeMode)}
					>
						{modes.map((item) => (
							<option key={item.id} value={item.id}>
								{item.label}
							</option>
						))}
					</SelectField>
				</div>
			</div>
			<TextAreaField
				id="escape-input"
				label={direction === "escape" ? "Text to escape" : "Escaped text"}
				value={source}
				onChange={setSource}
				placeholder="Paste text…"
				rows={10}
				hint="Shell mode wraps the value in single quotes; SQL mode doubles quotes; Unicode mode converts non-ASCII characters to \\uXXXX escapes."
			/>
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock
					title={direction === "escape" ? "Escaped output" : "Unescaped output"}
					value={result.output}
					rows={10}
					fileName={direction === "escape" ? "escaped.txt" : "unescaped.txt"}
				/>
			)}
			<p className={hintClassName}>Escaping is reversible per context; switch direction to run the inverse.</p>
		</ToolPanel>
	);
};
