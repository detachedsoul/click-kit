"use client";

import { useState } from "react";
import { ErrorNote, hintClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, fileToBytes, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { createZip, type ZipEntry } from "@/features/image-tools/zip-utils";
import { groupDuplicates, hashFilesInWorker, reportCsv, type DuplicateGroup } from "@/features/image-tools/duplicate-utils";

type HashRecord = { id: string; file: File; hash: string };
const buttonClass = "min-h-10 cursor-pointer border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const uniqueName = (name: string, taken: Set<string>) => {
	if (!taken.has(name)) return name;
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : "";
	let n = 2; while (taken.has(`${base}-${n}${ext}`)) n += 1;
	return `${base}-${n}${ext}`;
};

export const DuplicateFileFinder = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [records, setRecords] = useState<HashRecord[]>([]);
	const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState("");
	const [zip, setZip] = useState<Blob | null>(null);
	const [csv, setCsv] = useState<Blob | null>(null);
	const [zipName, setZipName] = useState("cleaned-collection.zip");
	const zipUrl = useObjectUrl(zip);
	const csvUrl = useObjectUrl(csv);
	const groups: DuplicateGroup[] = groupDuplicates(records);
	const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
	const wastedBytes = groups.reduce((sum, group) => sum + group.size * (group.files.length - 1), 0);
	const chooseFiles = (next: File[]) => { setFiles(next); setRecords([]); setRemoveIds(new Set()); setZip(null); setCsv(null); setError(""); setProgress(0); };
	const analyze = async () => {
		if (!files.length) return;
		setBusy(true); setError(""); setZip(null); setCsv(null); setRecords([]); setProgress(0);
		try {
			const inputs = files.map((file, index) => ({ id: `${index}-${file.name}-${file.size}`, file }));
			const hashes = await hashFilesInWorker(inputs, (done, total) => setProgress(Math.round(done / total * 100)));
			setRecords(inputs.flatMap(({ id, file }) => hashes.has(id) ? [{ id, file, hash: hashes.get(id)! }] : []));
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Could not analyze these files."); }
		finally { setBusy(false); }
	};
	const toggleRemove = (id: string) => setRemoveIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
	const exportReport = () => { setCsv(new Blob([reportCsv(groups, removeIds)], { type: "text/csv;charset=utf-8" })); };
	const buildZip = async () => {
		setBusy(true); setError(""); setZip(null);
		try {
			const keep = files.filter((_, index) => !removeIds.has(`${index}-${files[index].name}-${files[index].size}`));
			if (!keep.length) throw new Error("Choose at least one file to keep in the cleaned ZIP.");
			const taken = new Set<string>();
			const entries: ZipEntry[] = [];
			for (const file of keep) { const name = uniqueName(file.name, taken); taken.add(name); entries.push({ name, data: await fileToBytes(file), lastModified: new Date(file.lastModified) }); }
			const output = await createZip(entries);
			setZip(new Blob([output.slice().buffer], { type: "application/zip" }));
			setZipName("cleaned-collection.zip");
		} catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the cleaned ZIP."); }
		finally { setBusy(false); }
	};
	return <ToolPanel>
		<MultiFileField disabled={busy} hint="Select files from your device. Names, sizes and SHA-256 hashes are checked locally; nothing is uploaded." id="duplicate-files" label="Files to compare" onFiles={chooseFiles} />
		{files.length ? <><StatGrid items={[{ label: "Selected", value: String(files.length) }, { label: "Total size", value: describeBytes(totalBytes) }]} />
			<ul className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-auto border border-line bg-[#f8f7f3] p-3 text-xs">{files.map((file, index) => <li className="flex justify-between gap-3" key={`${index}-${file.name}`}><span className="break-all font-medium">{file.name}</span><span className="shrink-0 font-mono text-muted">{describeBytes(file.size)}</span></li>)}</ul>
			<button className={buttonClass} disabled={busy} onClick={() => void analyze()} type="button">{busy && !zip ? `Checking… ${progress}%` : "Find duplicates"}</button>
		</> : null}
		<ErrorNote message={error} />
		{records.length ? <>
			<StatGrid items={[{ label: "Duplicate groups", value: String(groups.length) }, { label: "Duplicate copies", value: String(groups.reduce((n, group) => n + group.files.length - 1, 0)) }, { label: "Potential space saved", value: describeBytes(wastedBytes) }]} />
			{groups.length ? <div className="flex flex-col gap-3">{groups.map((group, groupIndex) => <section className="border border-line bg-[#f8f7f3] p-3" key={group.hash}><h3 className="mb-2 mt-0 text-xs font-semibold">Group {groupIndex + 1} · {describeBytes(group.size)} each · {group.sameName ? "same filename" : "different filenames"}</h3><p className="mb-2 break-all font-mono text-[10px] text-muted">SHA-256: {group.hash}</p><ul className="m-0 flex list-none flex-col gap-2 p-0">{group.files.map(({ id, file }) => <li className="flex items-center gap-2 text-xs" key={id}><input aria-label={`Remove ${file.name} from cleaned ZIP`} checked={removeIds.has(id)} className="size-4 accent-forest" onChange={() => toggleRemove(id)} type="checkbox" /><span className="min-w-0 flex-1 break-all">{file.name}</span><span className="shrink-0 font-mono text-[10px] text-muted">{describeBytes(file.size)}</span></li>)}</ul></section>)}</div> : <p className={hintClassName}>No byte-for-byte duplicates found. The SHA-256 checks covered all {records.length} files.</p>}
			<p className={hintClassName}>Tick copies to exclude them from the cleaned ZIP. The list order does not change the source files, and every file stays on this device.</p>
			<div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy || files.length === removeIds.size} onClick={() => void buildZip()} type="button">{busy ? "Preparing ZIP…" : "Download cleaned ZIP"}</button><button className="min-h-10 cursor-pointer border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f1f0ea]" onClick={exportReport} type="button">Export duplicate report</button></div>
			{zip && zipUrl ? <FileDownloadLink fileName={zipName} label="Save cleaned-collection.zip" url={zipUrl} /> : null}
			{csv && csvUrl ? <FileDownloadLink fileName="duplicate-report.csv" label="Save duplicate-report.csv" url={csvUrl} /> : null}
		</> : null}
		<p className={hintClassName}>Files are grouped by their SHA-256 content hash; matching names or sizes alone never count as proof of a duplicate. Hashing runs in a Web Worker where available.</p>
	</ToolPanel>;
};
