"use client";

import { useState } from "react";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { buildXlsx, csvToRows, readXlsx, rowsToCsv, type Sheet, sheetName, sheetSummary } from "@/features/converter-tools/xlsx";

type Direction = "to-xlsx" | "to-csv";

const MAX_BYTES = 40 * 1024 * 1024;
const PREVIEW_ROWS = 12;
const PREVIEW_COLUMNS = 8;

const baseName = (name: string) => name.replace(/\.[^.]+$/u, "") || "sheet";

const Preview = ({ rows }: { rows: string[][] }) => {
	if (!rows.length) return <p className={hintClassName}>That file has no rows in it.</p>;
	const shown = rows.slice(0, PREVIEW_ROWS);
	return (
		<div className="overflow-x-auto border border-line">
			<table className="w-full border-collapse text-left text-xs">
				<tbody>
					{shown.map((row, rowIndex) => (
						<tr className={rowIndex === 0 ? "bg-[#fbfaf7] font-semibold" : ""} key={rowIndex}>
							{Array.from({ length: Math.min(Math.max(row.length, 1), PREVIEW_COLUMNS) }, (_, column) => (
								<td className="border-b border-line px-2 py-1 text-ink" key={column}>
									{row[column] ?? ""}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{rows.length > PREVIEW_ROWS || (rows[0]?.length ?? 0) > PREVIEW_COLUMNS ? (
				<p className="m-0 border-t border-line px-2 py-1 text-[11px] text-muted">
					Showing {shown.length} of {rows.length} rows and {Math.min(PREVIEW_COLUMNS, Math.max(...rows.map((row) => row.length)))} columns.
				</p>
			) : null}
		</div>
	);
};

export const SpreadsheetTool = () => {
	const [direction, setDirection] = useState<Direction>("to-xlsx");
	const [file, setFile] = useState<File | null>(null);
	const [sheets, setSheets] = useState<Sheet[] | null>(null);
	const [chosen, setChosen] = useState(0);
	const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const rows = direction === "to-xlsx" ? sheets?.[0]?.rows ?? [] : sheets?.[chosen]?.rows ?? [];
	const summary = sheetSummary(rows);

	const reset = () => {
		setSheets(null);
		setChosen(0);
		setResult(null);
		setError("");
	};

	const load = async (picked: File | null) => {
		reset();
		setFile(picked);
		if (!picked) return;
		setBusy(true);
		try {
			if (picked.size > MAX_BYTES) throw new Error("Keep the file under 40 MB.");
			if (direction === "to-xlsx") {
				if (!/\.csv$/iu.test(picked.name)) throw new Error("That is not a .csv file. Save the spreadsheet as CSV first, or switch to the other direction.");
				const text = await picked.text();
				if (!text.trim()) throw new Error("That file is empty.");
				setSheets([{ name: sheetName(baseName(picked.name)), rows: csvToRows(text) }]);
			} else {
				if (!/\.xlsx$/iu.test(picked.name)) throw new Error("That is not a .xlsx file. Older .xls files and Google Sheets links will not work — save or export as .xlsx first.");
				const read = await readXlsx(new Uint8Array(await picked.arrayBuffer()));
				setSheets(read);
				setChosen(0);
			}
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/zip|central directory|not a zip/iu.test(message)) setError("That file could not be opened — it may be damaged, or renamed from another format.");
			else setError(message || "That file could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const convert = async () => {
		if (!file || !sheets) return;
		setBusy(true);
		setError("");
		try {
			if (direction === "to-xlsx") {
				const out = await buildXlsx([{ name: sheets[0].name, rows: sheets[0].rows }]);
				setResult({ blob: new Blob([out.slice().buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name: `${baseName(file.name)}.xlsx` });
			} else {
				const sheet = sheets[chosen];
				const csv = rowsToCsv(sheet.rows);
				setResult({ blob: new Blob([csv], { type: "text/csv;charset=utf-8" }), name: `${baseName(file.name)}${sheets.length > 1 ? `-${sheetName(sheet.name).replace(/\s+/gu, "-")}` : ""}.csv` });
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "That conversion did not work.");
		} finally {
			setBusy(false);
		}
	};

	const switchDirection = (next: Direction) => {
		setDirection(next);
		reset();
		setFile(null);
	};

	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Direction"
				onChange={switchDirection}
				options={[
					{ id: "to-xlsx", label: "CSV to Excel" },
					{ id: "to-csv", label: "Excel to CSV" },
				]}
				value={direction}
			/>
			<FileField
				accept={direction === "to-xlsx" ? ".csv,text/csv" : ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
				hint={direction === "to-xlsx" ? "Commas, quoted cells, and blank lines are all handled; a cell that is only a number becomes a real number, so totals work in Excel." : "Values only: formulas come through as their last stored result, and styles, charts, and pictures stay behind."}
				id="spreadsheet-file"
				label={direction === "to-xlsx" ? "CSV file" : "Excel workbook (.xlsx)"}
				onFile={(picked) => void load(picked)}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy && !result ? <p className={hintClassName}>Reading the file…</p> : null}
			{sheets ? (
				<>
					{sheets.length > 1 ? (
						<div>
							<label className={labelClassName} htmlFor="spreadsheet-sheet">
								Which sheet
							</label>
							<select
								className={selectClassName}
								id="spreadsheet-sheet"
								onChange={(event) => {
									setChosen(Number(event.target.value));
									setResult(null);
								}}
								value={chosen}
							>
								{sheets.map((sheet, index) => (
									<option key={sheet.name} value={index}>
										{sheet.name} ({sheet.rows.length} rows)
									</option>
								))}
							</select>
						</div>
					) : null}
					<StatGrid
						items={[
							{ label: "Rows", value: String(summary.rows) },
							{ label: "Columns", value: String(summary.columns) },
							{ label: "Numbers", value: String(summary.numbers) },
							{ label: "Size now", value: describeBytes(file?.size ?? 0) },
						]}
					/>
					<Preview rows={rows} />
					<button className={primaryButtonClassName} disabled={busy || summary.rows === 0} onClick={() => void convert()} type="button">
						{busy ? "Converting…" : direction === "to-xlsx" ? "Build the workbook" : "Build the CSV"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-[18px]">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className={hintClassName}>Saved on this device. Nothing was uploaded.</p>
				</div>
			) : null}
			<p className={hintClassName}>Both directions happen in the tab: the file is unpacked, read, and written again by the browser itself, with no round trip to a server.</p>
		</ToolPanel>
	);
};
