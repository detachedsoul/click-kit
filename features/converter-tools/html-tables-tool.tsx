"use client";

import { useState } from "react";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, ResultBlock, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { FileField } from "@/features/image-tools/image-file-shared";
import { describeTable, type HtmlTable, readHtmlTables, type TableFormat, tableToCsv, tableToMarkdown } from "@/features/converter-tools/html-tables";

const MAX_BYTES = 5 * 1024 * 1024;

export const HtmlTableTool = () => {
	const [source, setSource] = useState("");
	const [tables, setTables] = useState<HtmlTable[] | null>(null);
	const [chosen, setChosen] = useState(0);
	const [format, setFormat] = useState<TableFormat>("csv");
	const [note, setNote] = useState("");
	const [error, setError] = useState("");

	const read = (html: string, label: string) => {
		setError("");
		try {
			if (!html.trim()) throw new Error("Paste the page or table markup first, or choose a saved .html file.");
			const found = readHtmlTables(html);
			if (!found.length) throw new Error("No table found. Copy the whole <table> element — a screenshot of a table has no rows in it.");
			setTables(found);
			setChosen(0);
			setNote(label);
		} catch (caught) {
			setTables(null);
			setError(caught instanceof Error ? caught.message : "That markup could not be read.");
		}
	};

	const chooseFile = async (file: File | null) => {
		if (!file) return;
		if (file.size > MAX_BYTES) {
			setError("Keep the file under 5 MB.");
			return;
		}
		const text = await file.text();
		setSource(text);
		read(text, file.name);
	};

	const table = tables?.[chosen] ?? null;
	const value = table ? (format === "csv" ? tableToCsv(table.rows) : tableToMarkdown(table.rows)) : "";
	const fileName = `${(table?.caption || "table").replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "").toLowerCase() || "table"}.${format === "csv" ? "csv" : "md"}`;

	return (
		<ToolPanel>
			<div>
				<label className={labelClassName} htmlFor="html-tables-source">
					Page markup
				</label>
				<textarea
					className={`mt-2 block min-h-45 w-full border border-field bg-surface px-3 py-2 font-mono text-[12px] text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent`}
					id="html-tables-source"
					onChange={(event) => {
						setSource(event.target.value);
						setTables(null);
						setError("");
					}}
					placeholder={'<table><tr><td>Item</td><td>Cost</td></tr>…'}
					rows={10}
					spellCheck={false}
					value={source}
				/>
			</div>
			<FileField accept=".html,.htm,text/html" hint="A saved page works too — the file is read in this tab and never uploaded." id="html-tables-file" label="…or a saved web page" onFile={(file) => void chooseFile(file)} />
			<button className={`${primaryButtonClassName} w-fit self-start`} onClick={() => read(source, "pasted markup")} type="button">
				Find the tables
			</button>
			{error ? <ErrorNote message={error} /> : null}
			{tables && table ? (
				<>
					{tables.length > 1 ? (
						<div>
							<label className={labelClassName} htmlFor="html-tables-pick">
								Which table
							</label>
							<select className={selectClassName} id="html-tables-pick" onChange={(event) => setChosen(Number(event.target.value))} value={chosen}>
								{tables.map((entry, index) => (
									<option key={`${entry.index}-${index}`} value={index}>
										{describeTable(entry)}
									</option>
								))}
							</select>
						</div>
					) : null}
					<SegmentedControl<TableFormat>
						label="Write it out as"
						onChange={setFormat}
						options={[
							{ id: "csv", label: "CSV" },
							{ id: "markdown", label: "Markdown table" },
						]}
						value={format}
					/>
					<StatGrid
						items={[
							{ label: "Tables found", value: String(tables.length) },
							{ label: "Rows", value: String(table.rows.length) },
							{ label: "Columns", value: String(table.rows.reduce((most, row) => Math.max(most, row.length), 0)) },
							{ label: "Read from", value: note || "—" },
						]}
					/>
					<ResultBlock fileName={fileName} rows={12} title="The table" value={value} />
				</>
			) : (
				<p className={hintClassName}>Paste markup with a table in it and the rows come out as CSV or a Markdown table: every cell&apos;s text, none of the styling.</p>
			)}
		</ToolPanel>
	);
};
