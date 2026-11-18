"use client";

import { useState } from "react";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, hintClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, fileToBytes, FileField } from "@/features/image-tools/image-file-shared";
import { hexDump, identifyFile, type FileIdentity } from "@/features/image-tools/file-type-utils";

const HEADER_BYTES = 4096;

const verdict = (identity: FileIdentity) => {
	if (!identity.detected) return "Unrecognised — the first bytes match no known format.";
	if (identity.matches === null) return "Detected from the bytes; there is no extension to compare against.";
	if (identity.matches) return "The contents match the file extension.";
	return `Mismatch — the file says .${identity.declaredExtension}, the bytes say ${identity.detected.extension}.`;
};

const report = (file: File, identity: FileIdentity, dump: string) =>
	[
		`File: ${file.name}`,
		`Size: ${describeBytes(file.size)} (${file.size.toLocaleString()} bytes)`,
		`Browser MIME type: ${file.type || "unknown"}`,
		`Declared extension: ${identity.declaredExtension ? `.${identity.declaredExtension}` : "none"}`,
		identity.detected
			? `Detected type: ${identity.detected.label} (${identity.detected.mime}, .${identity.detected.extension}, ${identity.detected.kind})`
			: "Detected type: unknown",
		`Verdict: ${verdict(identity)}`,
		identity.note ? `Note: ${identity.note}` : "",
		"",
		"First bytes:",
		dump,
	]
		.filter((line) => line !== "")
		.join("\n");

export const FileTypeTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [identity, setIdentity] = useState<FileIdentity | null>(null);
	const [dump, setDump] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const chooseFile = async (nextFile: File | null) => {
		setIdentity(null);
		setDump("");
		setError("");
		setFile(null);
		if (!nextFile) return;
		setBusy(true);
		try {
			const bytes = await fileToBytes(nextFile, HEADER_BYTES);
			setIdentity(identifyFile(bytes, nextFile.name, nextFile.type));
			setDump(hexDump(bytes, 128));
			setFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not read this file.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				hint="Pick any file. Only the first 4 kB are read, and only in this browser tab."
				id="file-type-input"
				label="File"
				onFile={(next) => void chooseFile(next)}
			/>
			{busy ? (
				<p className="m-0 text-xs text-muted" role="status">
					Reading the file header…
				</p>
			) : null}
			<ErrorNote message={error} />
			{file && identity ? (
				<>
					<p
						className={`m-0 border-l-2 px-3 py-2 text-xs leading-relaxed ${
							identity.detected === null
								? "border-[#b78b42] bg-[#f8f2e2] text-[#61502b]"
								: identity.matches === false
									? "border-[#b64b31] bg-[#fbf0ec] text-[#7d3a29]"
									: "border-[#7f9a76] bg-[#f0f3ec] text-[#41543c]"
						}`}
						role="status"
					>
						{verdict(identity)}
					</p>
					<StatGrid
						items={[
							{ label: "Detected type", value: identity.detected?.label ?? "Unknown" },
							{ label: "MIME type", value: identity.detected?.mime ?? "—" },
							{ label: "Kind", value: identity.detected?.kind ?? "—" },
							{ label: "Real extension", value: identity.detected ? `.${identity.detected.extension}` : "—" },
							{ label: "Name says", value: identity.declaredExtension ? `.${identity.declaredExtension}` : "no extension" },
							{ label: "Browser says", value: identity.declaredMime || "unknown" },
							{ label: "File size", value: describeBytes(file.size) },
							{ label: "Bytes read", value: `${Math.min(file.size, HEADER_BYTES).toLocaleString()} B` },
						]}
					/>
					{identity.note ? <p className={hintClassName}>{identity.note}</p> : null}
					<ResultBlock fileName="file-type.txt" title="Report" value={report(file, identity, dump)} rows={12} />
					<div className="flex flex-wrap items-center gap-2">
						<CopyTextButton text={dump} />
						<span className="text-[11px] text-muted">Copy the first 128 bytes as hex and ASCII.</span>
					</div>
				</>
			) : null}
			<p className={hintClassName}>
				Extensions and browser MIME types are guesses based on the name. The signature bytes at the start of the file are the real answer — this is how
				upload filters and malware scanners identify files.
			</p>
		</ToolPanel>
	);
};
