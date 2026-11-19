"use client";

import { useState } from "react";
import { CheckboxField, ErrorNote, hintClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, fileToBytes, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { createZip, describeZip, type ZipEntry } from "@/features/image-tools/zip-utils";

type Archive = { blob: Blob; fileName: string; entries: number; inputBytes: number };

const uniqueName = (name: string, taken: Set<string>) => {
	if (!taken.has(name)) return name;
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name;
	const extension = dot > 0 ? name.slice(dot) : "";
	let index = 2;
	while (taken.has(`${base}-${index}${extension}`)) index += 1;
	return `${base}-${index}${extension}`;
};

export const ZipTool = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [compress, setCompress] = useState(true);
	const [archive, setArchive] = useState<Archive | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const archiveUrl = useObjectUrl(archive?.blob ?? null);
	const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

	const chooseFiles = (next: File[]) => {
		setArchive(null);
		setError("");
		setFiles(next);
	};

	const build = async () => {
		if (files.length === 0) return;
		setBusy(true);
		setError("");
		setArchive(null);
		try {
			const taken = new Set<string>();
			const entries: ZipEntry[] = [];
			for (const file of files) {
				const name = uniqueName(file.name, taken);
				taken.add(name);
				entries.push({ name, data: await fileToBytes(file), lastModified: new Date(file.lastModified) });
			}
			const zip = await createZip(entries, { compress });
			const summary = describeZip(zip);
			setArchive({
				blob: new Blob([zip.slice().buffer], { type: "application/zip" }),
				fileName: files.length === 1 ? `${files[0].name.replace(/\.[^./\\]+$/u, "")}.zip` : "archive.zip",
				entries: summary.entries,
				inputBytes: totalBytes,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the archive.");
		} finally {
			setBusy(false);
		}
	};

	const saving = archive ? archive.inputBytes - archive.blob.size : 0;

	return (
		<ToolPanel>
			<MultiFileField
				disabled={busy}
				hint="Pick as many files as you like. They are read here and packed into a standard .zip — nothing is uploaded."
				id="zip-files"
				label="Files to include"
				onFiles={chooseFiles}
			/>
			{files.length > 0 ? (
				<>
					<ul className="m-0 flex list-none flex-col gap-1 border border-line bg-[#f8f7f3] p-3 text-xs">
						{files.map((file, index) => (
							<li className="flex flex-wrap items-baseline justify-between gap-2" key={`${file.name}-${index}`}>
								<span className="break-all font-medium text-ink">{file.name}</span>
								<span className="font-mono text-[11px] text-muted">{describeBytes(file.size)}</span>
							</li>
						))}
					</ul>
					<CheckboxField
						checked={compress}
						hint="Off stores files as they are. On uses the browser's deflate and keeps whichever result is smaller."
						id="zip-compress"
						label="Compress files where it helps"
						onChange={setCompress}
					/>
				</>
			) : null}
			<button
				className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={files.length === 0 || busy}
				onClick={() => void build()}
				type="button"
			>
				{busy ? "Packing…" : "Create ZIP"}
			</button>
			<ErrorNote message={error} />
			{archive && archiveUrl ? (
				<>
					<StatGrid
						items={[
							{ label: "Files", value: String(archive.entries) },
							{ label: "Input", value: describeBytes(archive.inputBytes) },
							{ label: "Archive", value: describeBytes(archive.blob.size) },
							{ label: "Saved", value: saving > 0 ? describeBytes(saving) : "Nothing to gain" },
						]}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<FileDownloadLink fileName={archive.fileName} label={`Download ${archive.fileName}`} url={archiveUrl} />
						<span className="text-[11px] text-muted">Standard ZIP with UTF-8 names, readable by every extractor.</span>
					</div>
					<ResultBlock fileName="manifest.txt" title="Archive contents" value={files.map((file) => `${file.name}  ${file.size} bytes`).join("\n")} rows={8} />
				</>
			) : null}
			<p className={hintClassName}>
				ZIP is a container, not a compressor: already-compressed files (JPEG, MP4, PDF) barely shrink. This tool writes deflate entries when the browser
				supports it and stores the rest.
			</p>
		</ToolPanel>
	);
};
