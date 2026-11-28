"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, RotateCcw, Download } from "lucide-react";
import { ToolPanel } from "@/features/developer-tools/tool-ui";
import { csvProfileToCsv, type CsvProfileReport } from "@/features/developer-tools/csv-profile-core";

const MAX_CSV_BYTES = 50 * 1024 * 1024;
const tableClass = "border-collapse text-left text-xs";
const cellClass = "border-b border-r border-line px-2.5 py-2 align-top";

type WorkerResult = { report?: CsvProfileReport; error?: string };

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const formatValue = (value: number | null) => value === null ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);

const downloadFile = (name: string, content: string, type: string) => {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.click();
	URL.revokeObjectURL(url);
};

const Metric = ({ label, value, note }: { label: string; value: string; note?: string }) => (
	<div className="border border-line bg-[#f8f7f3] p-3"><p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p><p className="mb-0 mt-1 text-lg font-semibold tabular-nums">{value}</p>{note && <p className="mb-0 mt-1 text-[10px] text-muted">{note}</p>}</div>
);

export const CsvProfileTool = () => {
	const [report, setReport] = useState<CsvProfileReport | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [fileName, setFileName] = useState("");
	const workerRef = useRef<Worker | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	useEffect(() => () => workerRef.current?.terminate(), []);

	const reset = () => {
		workerRef.current?.terminate();
		workerRef.current = null;
		setReport(null);
		setError("");
		setBusy(false);
		setFileName("");
		if (inputRef.current) inputRef.current.value = "";
	};

	const analyzeFile = (file?: File) => {
		if (!file) return;
		workerRef.current?.terminate();
		setReport(null);
		setError("");
		setBusy(false);
		setFileName(file.name);
		if (file.size > MAX_CSV_BYTES) { setError("Choose a CSV file smaller than 50 MB. Large files are streamed in a worker to keep the page responsive."); return; }
		if (!/\.(?:csv|tsv|txt)$/iu.test(file.name)) { setError("Choose a .csv, .tsv, or delimited text file."); return; }
		if (typeof Worker === "undefined") { setError("This browser does not support Web Workers, which are required to profile files without freezing the page."); return; }
		setBusy(true);
		try {
			const worker = new Worker(new URL("./csv-profile-worker.ts", import.meta.url), { type: "module" });
			workerRef.current = worker;
			worker.onmessage = (event: MessageEvent<WorkerResult>) => {
				worker.terminate();
				workerRef.current = null;
				setBusy(false);
				if (event.data.error) { setError(event.data.error); return; }
				if (!event.data.report) { setError("The profiler did not return a report for this file."); return; }
				setReport(event.data.report);
			};
			worker.onerror = () => {
				worker.terminate();
				workerRef.current = null;
				setBusy(false);
				setError("The CSV worker could not read this file. Try a UTF-8 CSV with a header row.");
			};
			worker.postMessage({ file });
		} catch {
			setBusy(false);
			setError("The browser could not start the CSV worker. Try a current browser with Web Worker support.");
		}
	};

	const emptyCells = report?.columns.reduce((sum, column) => sum + column.empty, 0) ?? 0;
	const inconsistentColumns = report?.columns.filter((column) => column.inconsistent).length ?? 0;
	const exportBaseName = report?.fileName.replace(/\.[^.]+$/u, "") || "csv-profile";

	return <ToolPanel>
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-[240px] flex-1">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="csv-profile-file">CSV or delimited file<input accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="mt-2 block w-full cursor-pointer border border-field bg-surface px-3 py-2 text-xs text-ink file:mr-3 file:min-h-8 file:cursor-pointer file:border-0 file:bg-forest file:px-3 file:text-xs file:font-medium file:text-white" id="csv-profile-file" ref={inputRef} type="file" onChange={(event) => analyzeFile(event.target.files?.[0])} /></label>
				<p className="mb-0 mt-2 text-[11px] text-muted">Analyzes locally in a Web Worker, streaming 256 KB chunks. Maximum file size: 50 MB.</p>
			</div>
			<div className="flex flex-wrap gap-2">{report && <><button className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-surface px-3 text-xs hover:bg-[#f1f0ea]" type="button" onClick={() => downloadFile(`${exportBaseName}-profile.json`, JSON.stringify(report, null, 2), "application/json") }><Download size={14} aria-hidden="true" />Download JSON</button><button className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-surface px-3 text-xs hover:bg-[#f1f0ea]" type="button" onClick={() => downloadFile(`${exportBaseName}-profile.csv`, csvProfileToCsv(report), "text/csv;charset=utf-8") }><Download size={14} aria-hidden="true" />Download CSV</button></>}{(report || error || busy) && <button className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-line bg-surface px-3 text-xs hover:bg-[#f1f0ea]" type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Reset</button>}</div>
		</div>
		{busy && <div className="flex items-center gap-3 border-l-2 border-accent bg-[#f8f6ef] p-3" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-forest" aria-hidden="true" /><p className="m-0 text-xs">Profiling {fileName} in the background…</p></div>}
		{error && <p className="m-0 border-l-2 border-[#a34d37] bg-[#fbf1ee] p-3 text-xs leading-relaxed text-[#8a3f30]" role="alert">{error}</p>}
		{report && <>
			<section className="flex flex-col gap-3" aria-label="Dataset overview">
				<div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="m-0 text-sm font-semibold">Dataset overview</h2><p className="m-0 text-[11px] text-muted">{report.fileName} · {formatBytes(report.fileSize)} · delimiter {report.delimiter === "\t" ? "TAB" : JSON.stringify(report.delimiter)}</p></div>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
					<Metric label="Rows" value={report.rowCount.toLocaleString()} />
					<Metric label="Columns" value={report.columnCount.toLocaleString()} />
					<Metric label="Empty cells" value={emptyCells.toLocaleString()} />
					<Metric label="Duplicate rows" value={report.duplicateRows.toLocaleString()} />
					<Metric label="Inconsistent columns" value={inconsistentColumns.toLocaleString()} />
				</div>
			</section>
			{report.parseErrors.length > 0 && <section className="border-l-2 border-[#a57b36] bg-[#fbf6eb] p-3" aria-label="CSV parsing notes"><h2 className="m-0 text-xs font-semibold">Parsing notes ({report.parseErrors.length})</h2><ul className="mb-0 mt-2 list-disc space-y-1 pl-5 text-[11px] text-muted">{report.parseErrors.slice(0, 5).map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></section>}
			{(report.rowsWithMissingFields || report.rowsWithExtraFields) > 0 && <p className="m-0 text-[11px] text-[#8a3f30]">{report.rowsWithMissingFields.toLocaleString()} rows have fewer fields than the header; {report.rowsWithExtraFields.toLocaleString()} have extra fields.</p>}
			<section className="flex flex-col gap-3" aria-label="Column statistics"><div><h2 className="m-0 text-sm font-semibold">Column statistics</h2><p className="mb-0 mt-1 text-[11px] text-muted">Unique counts are exact up to 20,000 distinct values per column; capped counts display a lower bound.</p></div><div className="overflow-x-auto border border-line"><table className={`${tableClass} min-w-full`}><thead className="bg-[#f8f7f3]"><tr>{["Column", "Type", "Filled", "Empty", "Unique", "Minimum", "Maximum", "Average", "Quality"].map((heading) => <th className={`${cellClass} whitespace-nowrap font-semibold`} key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{report.columns.map((column, index) => <tr className={index % 2 ? "bg-[#fbfaf7]" : "bg-surface"} key={`${column.name}-${index}`}><th className={`${cellClass} max-w-52 min-w-36 font-semibold`} scope="row"><span className="break-words">{column.name}</span>{column.inconsistencyNotes.length > 0 && <ul className="mb-0 mt-1 list-disc space-y-0.5 pl-4 text-[10px] font-normal leading-relaxed text-[#8a3f30]">{column.inconsistencyNotes.map((note) => <li key={note}>{note}</li>)}</ul>}</th><td className={`${cellClass} whitespace-nowrap`}>{column.type}</td><td className={cellClass}>{column.nonEmpty.toLocaleString()}</td><td className={cellClass}>{column.empty.toLocaleString()}</td><td className={cellClass}>{column.uniqueIsLowerBound ? "≥ " : ""}{column.uniqueValues.toLocaleString()}</td><td className={cellClass}>{formatValue(column.minimum)}</td><td className={cellClass}>{formatValue(column.maximum)}</td><td className={cellClass}>{formatValue(column.average)}</td><td className={cellClass}>{column.inconsistent ? <span className="text-[#8a3f30]">Check values</span> : <span className="text-[#49634e]">Looks consistent</span>}</td></tr>)}</tbody></table></div></section>
			<section className="flex flex-col gap-3" aria-label="Data preview"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="m-0 text-sm font-semibold">Table preview</h2><p className="m-0 text-[11px] text-muted">First {Math.min(report.preview.length, 25).toLocaleString()} of {report.rowCount.toLocaleString()} data rows</p></div><div className="max-h-[420px] overflow-auto border border-line"><table className={`${tableClass} min-w-full`}><thead className="sticky top-0 bg-[#f8f7f3]"><tr>{report.columns.map((column, index) => <th className={`${cellClass} min-w-28 max-w-56 font-semibold`} key={`${column.name}-${index}`} scope="col">{column.name}</th>)}</tr></thead><tbody>{report.preview.slice(0, 25).map((row, rowIndex) => <tr className={rowIndex % 2 ? "bg-[#fbfaf7]" : "bg-surface"} key={`row-${rowIndex}`}>{report.columns.map((column, columnIndex) => <td className={`${cellClass} max-w-56 break-words`} key={`${column.name}-${columnIndex}`}>{row[columnIndex] || <span className="text-[#a34d37]">(empty)</span>}</td>)}</tr>)}</tbody></table></div></section>
		</>}
		{!report && !busy && !error && <div className="flex flex-col items-center gap-3 border border-dashed border-line bg-[#f8f7f3] px-5 py-12 text-center"><FileSpreadsheet className="text-muted" size={30} aria-hidden="true" /><h2 className="m-0 text-sm font-semibold">See what’s inside your CSV</h2><p className="m-0 max-w-md text-xs leading-relaxed text-muted">Upload a delimited file to inspect column types, missing values, duplicates, inconsistent entries, and useful numeric summaries. The file stays on this device.</p></div>}
	</ToolPanel>;
};
