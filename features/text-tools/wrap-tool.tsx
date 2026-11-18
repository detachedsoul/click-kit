"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { wrapText } from "@/features/text-tools/wrap-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const sample = `A hard wrap puts a line break at a fixed column so the text fits in terminals, emails, and code comments. It is different from soft wrapping, which only changes how a paragraph is displayed.

Unwrapping goes the other way: it joins the line breaks inside each paragraph and keeps the blank lines between paragraphs.`;

export const WrapTool = () => {
	const [source, setSource] = useState(sample);
	const [width, setWidth] = useState(72);
	const [mode, setMode] = useState<"wrap" | "unwrap">("wrap");
	const [breakLongWords, setBreakLongWords] = useState(false);
	const [keepBlankLines, setKeepBlankLines] = useState(true);
	const result = useMemo(() => {
		try {
			return { report: wrapText(source, { width, mode, breakLongWords, keepBlankLines }), error: "" };
		} catch (error) {
			return { report: null, error: error instanceof Error ? error.message : "Could not process this text." };
		}
	}, [source, width, mode, breakLongWords, keepBlankLines]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label className={labelClassName} htmlFor="wrap-width">
					Column width
					<input className={fieldClassName} id="wrap-width" max={200} min={3} onChange={(event) => setWidth(Number(event.target.value))} type="number" value={width} />
				</label>
				<label className={labelClassName} htmlFor="wrap-mode">
					Action
					<select className={fieldClassName} id="wrap-mode" onChange={(event) => setMode(event.target.value as "wrap" | "unwrap")} value={mode}>
						<option value="wrap">Wrap to column width</option>
						<option value="unwrap">Unwrap paragraphs</option>
					</select>
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="wrap-long-words">
					<input checked={breakLongWords} id="wrap-long-words" onChange={(event) => setBreakLongWords(event.target.checked)} type="checkbox" />
					Break words longer than the width
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="wrap-blank">
					<input checked={keepBlankLines} id="wrap-blank" onChange={(event) => setKeepBlankLines(event.target.checked)} type="checkbox" />
					Keep blank lines between paragraphs
				</label>
			</div>
			<TextAreaField id="wrap-input" label="Your text" value={source} onChange={setSource} placeholder="Paste text to wrap or unwrap." rows={11} />
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Lines", value: String(result.report.lines) },
							{ label: "Longest line", value: `${result.report.longestLine} chars` },
							{ label: "Words", value: String(result.report.words) },
							{ label: "Paragraphs", value: String(result.report.paragraphs) },
						]}
					/>
					<ResultBlock title="Result" value={result.report.text} rows={14} fileName="wrapped.txt" />
				</>
			)}
			<p className={hintClassName}>
				Wrapping is greedy: words fill each line until the next one would exceed the width. Unwrapping also repairs hyphenated breaks such as{" "}
				<code>docu-</code> / <code>ment</code>.
			</p>
		</ToolPanel>
	);
};
