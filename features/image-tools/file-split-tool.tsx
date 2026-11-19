"use client";

import { useMemo, useState } from "react";
import { ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { CHUNK_SIZES, chunkName, chunkSummary, joinedName, joinBytes, MAX_JOIN_PARTS, MAX_SPLIT_BYTES, missingNumbers, orderParts, partsZipName, planChunks } from "@/features/image-tools/file-split-utils";
import { createZip } from "@/features/image-tools/zip-utils";

type Mode = "split" | "join";
type Part = { name: string; blob: Blob; size: number };
type Joined = { blob: Blob; name: string; size: number };

const MODES: { id: Mode; label: string }[] = [
	{ id: "split", label: "Split" },
	{ id: "join", label: "Join" },
];

export const FileSplitTool = () => {
	const [mode, setMode] = useState<Mode>("split");
	const [file, setFile] = useState<File | null>(null);
	const [chunkBytes, setChunkBytes] = useState(CHUNK_SIZES[2].id);
	const [parts, setParts] = useState<Part[]>([]);
	const [archive, setArchive] = useState<{ blob: Blob; name: string } | null>(null);
	const [joined, setJoined] = useState<Joined | null>(null);
	const [joinFiles, setJoinFiles] = useState<File[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const plan = useMemo(() => {
		if (!file) return null;
		try {
			return planChunks(file.size, chunkBytes);
		} catch {
			return null;
		}
	}, [chunkBytes, file]);

	const partUrls = useMemo(() => parts.map((part) => URL.createObjectURL(part.blob)), [parts]);
	const zipUrl = useObjectUrl(archive?.blob ?? null);
	const joinedUrl = useObjectUrl(joined?.blob ?? null);
	const orderedParts = orderParts(joinFiles.map((item) => ({ name: item.name, file: item })));
	const gaps = missingNumbers(orderedParts);
	const totalJoinBytes = joinFiles.reduce((sum, item) => sum + item.size, 0);

	const resetOutputs = () => {
		setParts([]);
		setArchive(null);
		setError("");
	};

	const chooseFile = (nextFile: File | null) => {
		resetOutputs();
		setFile(null);
		if (!nextFile) return;
		if (nextFile.size > MAX_SPLIT_BYTES) {
			setError("Split files up to 400 MB at a time.");
			return;
		}
		if (nextFile.size < 1) {
			setError("That file is empty, so there is nothing to split.");
			return;
		}
		setFile(nextFile);
	};

	const split = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setParts([]);
		setArchive(null);
		try {
			const chunks = planChunks(file.size, chunkBytes);
			const produced = chunks.map((chunk) => {
				const blob = file.slice(chunk.start, chunk.end);
				return { name: chunkName(file.name, chunk.index, chunks.length), blob, size: chunk.size };
			});
			setParts(produced);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not split this file.");
		} finally {
			setBusy(false);
		}
	};

	const zipParts = async () => {
		if (!parts.length || !file) return;
		setBusy(true);
		setError("");
		try {
			const entries = await Promise.all(parts.map(async (part) => ({ name: part.name, data: new Uint8Array(await part.blob.arrayBuffer()) })));
			const zip = await createZip(entries, { compress: false });
			setArchive({ blob: new Blob([zip.slice().buffer], { type: "application/zip" }), name: partsZipName(file.name) });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the archive.");
		} finally {
			setBusy(false);
		}
	};

	const join = async () => {
		if (!joinFiles.length) return;
		setBusy(true);
		setError("");
		setJoined(null);
		try {
			if (joinFiles.length > MAX_JOIN_PARTS) throw new Error(`Join up to ${MAX_JOIN_PARTS} parts at a time.`);
			if (totalJoinBytes > MAX_SPLIT_BYTES) throw new Error("Join parts totalling up to 400 MB at a time.");
			if (gaps.length) throw new Error(`Part ${gaps.join(", ")} is missing, so the joined file would be corrupt.`);
			const ordered = orderParts(joinFiles.map((item) => ({ name: item.name, file: item })));
			const pieces = await Promise.all(ordered.map(async (item) => new Uint8Array(await item.file.arrayBuffer())));
			const bytes = joinBytes(pieces);
			setJoined({ blob: new Blob([bytes.slice().buffer], { type: "application/octet-stream" }), name: joinedName(ordered), size: bytes.length });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not join these parts.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<SegmentedControl
				label="What do you want to do?"
				onChange={(value) => {
					setMode(value);
					setError("");
				}}
				options={MODES}
				value={mode}
			/>
			{mode === "split" ? (
				<>
					<label className={labelClassName} htmlFor="split-file">
						File to split
						<input
							className="mt-2 block w-full cursor-pointer border border-field bg-surface p-2 text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-[#eddfd4] file:px-3 file:py-1.5 file:text-xs file:text-accent-dark"
							id="split-file"
							onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
							type="file"
						/>
					</label>
					<label className={labelClassName} htmlFor="split-chunk">
						Part size
						<select className={selectClassName} id="split-chunk" onChange={(event) => setChunkBytes(Number(event.target.value))} value={chunkBytes}>
							{CHUNK_SIZES.map((option) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					{file && plan ? (
						<StatGrid
							items={[
								{ label: "File", value: describeBytes(file.size) },
								{ label: "Parts", value: chunkSummary(plan) },
								{ label: "Part size", value: CHUNK_SIZES.find((option) => option.id === chunkBytes)?.label ?? "custom" },
								{ label: "Last part", value: describeBytes(plan[plan.length - 1].size) },
							]}
						/>
					) : null}
					<button className={`${primaryButtonClassName} self-start`} disabled={!file || busy} onClick={() => void split()} type="button">
						{busy ? "Splitting…" : "Split file"}
					</button>
					{parts.length > 0 && file ? (
						<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h2 className="m-0 text-sm font-semibold">
									Parts <span className="font-normal text-muted">({parts.length})</span>
								</h2>
								<button
									className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
									disabled={busy}
									onClick={() => void zipParts()}
									type="button"
								>
									Download all as ZIP
								</button>
							</div>
							{archive && zipUrl ? <FileDownloadLink fileName={archive.name} label={`Download ${archive.name}`} url={zipUrl} /> : null}
							<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
								{parts.map((part, index) => (
									<li className="flex flex-wrap items-center justify-between gap-2 border border-line bg-[#fbfaf7] px-3 py-2 text-[11px]" key={part.name}>
										<span className="break-all font-medium text-ink">{part.name}</span>
										<span className="font-mono text-[#5f6259]">{describeBytes(part.size)}</span>
										<FileDownloadLink fileName={part.name} label="Download" url={partUrls[index]} />
									</li>
								))}
							</ul>
						</section>
					) : null}
				</>
			) : (
				<>
					<MultiFileField
						disabled={busy}
						hint="Pick the .part files in any order — they are joined by their part number, not by the order you selected them."
						id="join-files"
						label="Parts to join"
						onFiles={(next) => {
							setJoined(null);
							setError("");
							setJoinFiles(next);
						}}
					/>
					{joinFiles.length > 0 ? (
						<StatGrid
							items={[
								{ label: "Parts", value: String(joinFiles.length) },
								{ label: "Total size", value: describeBytes(totalJoinBytes) },
								{ label: "Output name", value: joinedName(orderedParts) },
								{ label: "Missing parts", value: gaps.length ? gaps.join(", ") : "none" },
							]}
						/>
					) : null}
					<button className={`${primaryButtonClassName} self-start`} disabled={!joinFiles.length || busy} onClick={() => void join()} type="button">
						{busy ? "Joining…" : "Join parts"}
					</button>
					{joined && joinedUrl ? (
						<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<h2 className="m-0 text-sm font-semibold">Joined file</h2>
								<FileDownloadLink fileName={joined.name} label={`Download ${joined.name}`} url={joinedUrl} />
							</div>
							<p className="m-0 text-[11px] text-muted">
								{joined.name} · {describeBytes(joined.size)}
							</p>
						</section>
					) : null}
				</>
			)}
			<ErrorNote message={error} />
			<p className={hintClassName}>
				Handy when an upload form refuses big files or an email limit blocks an attachment: split it, send the parts, then join them again. Parts are just
				raw bytes, so the rebuilt file is identical to the original — nothing is compressed or re-encoded.
			</p>
		</ToolPanel>
	);
};
