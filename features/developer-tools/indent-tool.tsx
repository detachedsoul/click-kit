"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { convertIndentation, indentLabel, type IndentOptions, type IndentUnit } from "@/features/developer-tools/indent-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `function build(config) {
\tif (!config) {
\t\tthrow new Error("missing config");
\t}
\treturn {
\t\tname: config.name,
   \t\tretries: config.retries ?? 3
\t};
}`;

const unitOptions: IndentUnit[] = [2, 4, 8, "tab"];

export const IndentTool = () => {
	const [source, setSource] = useState(sample);
	const [from, setFrom] = useState<IndentOptions["from"]>("auto");
	const [to, setTo] = useState<IndentUnit>(2);
	const [trimTrailing, setTrimTrailing] = useState(true);
	const [blankLines, setBlankLines] = useState(false);
	const result = useMemo(() => {
		try {
			return { report: convertIndentation(source, { from, to, trimTrailing, blankLines }), error: "" };
		} catch (error) {
			return { report: null, error: error instanceof Error ? error.message : "Could not re-indent this text." };
		}
	}, [source, from, to, trimTrailing, blankLines]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="indent-from">
					Current indentation
					<select className={selectClassName} id="indent-from" value={String(from)} onChange={(event) => setFrom(event.target.value === "auto" ? "auto" : (Number(event.target.value) as IndentUnit))}>
						<option value="auto">Detect automatically</option>
						{unitOptions.map((unit) => (
							<option key={String(unit)} value={String(unit)}>
								{indentLabel(unit)}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="indent-to">
					Convert to
					<select className={selectClassName} id="indent-to" value={String(to)} onChange={(event) => setTo(event.target.value === "tab" ? "tab" : (Number(event.target.value) as IndentUnit))}>
						{unitOptions.map((unit) => (
							<option key={String(unit)} value={String(unit)}>
								{indentLabel(unit)}
							</option>
						))}
					</select>
				</label>
				<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="indent-trim">
					<input checked={trimTrailing} id="indent-trim" onChange={(event) => setTrimTrailing(event.target.checked)} type="checkbox" />
					Trim trailing whitespace
				</label>
				<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="indent-blank">
					<input checked={blankLines} id="indent-blank" onChange={(event) => setBlankLines(event.target.checked)} type="checkbox" />
					Keep whitespace on blank lines
				</label>
			</div>
			<TextAreaField id="indent-input" label="Text to re-indent" value={source} onChange={setSource} placeholder={"function x() {\n    return 1;\n}"} rows={14} hint="Leading indentation is converted column by column, so mixed tabs and spaces end up consistent." />
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Detected", value: indentLabel(result.report.detected) },
							{ label: "Lines changed", value: String(result.report.changedLines) },
							{ label: "Tab-indented lines", value: String(result.report.tabbedLines) },
							{ label: "Mixed lines", value: String(result.report.mixedLines) },
						]}
					/>
					<p className={hintClassName}>{result.report.basis}</p>
					<ResultBlock title="Result" value={result.report.output} rows={14} fileName="text.txt" />
				</>
			)}
		</ToolPanel>
	);
};
