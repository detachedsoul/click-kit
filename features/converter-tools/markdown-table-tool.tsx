"use client";

import { useState } from "react";
import { convertTable, type ConvertedTable } from "@/features/converter-tools/markdown-table";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const SAMPLE = `| Item | Qty | Cost |
| :--- | --: | :-: |
| Tea | 2 | 4.50 |
| Coffee | 1 | 6.00 |`;

export const MarkdownTableTool = () => {
	const [source, setSource] = useState("");
	const [result, setResult] = useState<ConvertedTable | null>(null);
	const [error, setError] = useState("");

	const convert = () => {
		setError("");
		setResult(null);
		try {
			setResult(convertTable(source));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "That table could not be read.");
		}
	};

	return (
		<ToolPanel>
			<div>
				<label className={labelClassName} htmlFor="markdown-table-source">
					Table, in Markdown or HTML
				</label>
				<textarea
					className="mt-2 block min-h-45 w-full border border-field bg-surface px-3 py-2 font-mono text-[12px] text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="markdown-table-source"
					onChange={(event) => {
						setSource(event.target.value);
						setResult(null);
						setError("");
					}}
					placeholder={SAMPLE}
					rows={10}
					spellCheck={false}
					value={source}
				/>
			</div>
			<button className={`${primaryButtonClassName} w-fit self-start`} onClick={convert} type="button">
				Convert the table
			</button>
			{error ? <ErrorNote message={error} /> : null}
			{result ? (
				<>
					<StatGrid
						items={[
							{ label: "Found as", value: result.kind === "markdown" ? "Markdown" : "HTML" },
							{ label: "Written out as", value: result.kind === "markdown" ? "HTML" : "Markdown" },
							{ label: "Rows", value: String(result.rows) },
							{ label: "Columns", value: String(result.columns) },
						]}
					/>
					<ResultBlock fileName={result.kind === "markdown" ? "table.html" : "table.md"} rows={12} title="The table" value={result.output} />
					<p className={hintClassName}>
						{result.kind === "markdown"
							? "The header row went into a <thead> and everything under it into a <tbody>. Pipeline alignment became a text-align style, and any < or & inside a cell was escaped so it shows as text."
							: "Every cell's text came across; styling, spans, and colspan widths did not, because a pipe table has no boxes to put them in."}
					</p>
				</>
			) : (
				<p className={hintClassName}>
					Paste either one and it comes out the other way: a Markdown pipe table becomes a &lt;table&gt; element, and a &lt;table&gt; element becomes a pipe table. The direction is worked out from what you paste, so there is no switch to set. Everything happens in this tab.
				</p>
			)}
		</ToolPanel>
	);
};
