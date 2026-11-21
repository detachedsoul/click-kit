"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { docxToMarkdown } from "@/features/converter-tools/docx";

type Format = "markdown" | "text";

const MAX_BYTES = 30 * 1024 * 1024;

export const DocxTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [format, setFormat] = useState<Format>("markdown");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [output, setOutput] = useState<{ text: string; name: string; format: Format } | null>(null);
	const blob = output ? new Blob([output.text], { type: "text/plain;charset=utf-8" }) : null;
	const url = useObjectUrl(blob);

	const convert = async (chosen: File, next: Format) => {
		setBusy(true);
		setError("");
		setOutput(null);
		setFile(chosen);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the Word file under 30 MB.");
			const bytes = new Uint8Array(await chosen.arrayBuffer());
			const text = await docxToMarkdown(bytes, { format: next });
			if (!text) throw new Error("This document has no text — it may be images only.");
			const base = chosen.name.replace(/\.docx$/iu, "") || "document";
			setOutput({ text, name: `${base}.${next === "markdown" ? "md" : "txt"}`, format: next });
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/not a zip|central directory/iu.test(message)) setError("That file could not be opened as a Word document. Only .docx files work — the older .doc format does not.");
			else setError(message || "This document could not be read.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				hint="Text structure becomes Markdown/plain text: headings, lists, emphasis, and tables. Page layout, fonts, pictures, columns, comments, tracked changes, and text boxes are not a 1:1 match and are not included."
				id="docx-file"
				label="Word document (.docx)"
				onFile={(chosen) => {
					if (chosen) void convert(chosen, format);
					else {
						setFile(null);
						setOutput(null);
						setError("");
					}
				}}
			/>
			<SegmentedControl<Format>
				label="Write out as"
				onChange={(next) => {
					setFormat(next);
					if (file) void convert(file, next);
				}}
				options={[
					{ id: "markdown", label: "Markdown" },
					{ id: "text", label: "Plain text" },
				]}
				value={format}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName}>Reading the document…</p> : null}
			{output ? (
				<>
					<StatGrid
						items={[
							{ label: "Words", value: String(output.text.split(/\s+/u).filter(Boolean).length) },
							{ label: "Characters", value: output.text.length.toLocaleString() },
							{ label: "Lines", value: String(output.text.split("\n").length) },
							{ label: "File size", value: describeBytes(file?.size ?? 0) },
						]}
					/>
					<div>
						<label className={labelClassName} htmlFor="docx-output">
							{output.format === "markdown" ? "Markdown" : "Plain text"}
						</label>
						<textarea
							className="mt-2 min-h-64 w-full border border-line bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							id="docx-output"
							readOnly
							spellCheck={false}
							value={output.text}
						/>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<FileDownloadLink fileName={output.name} label={`Download ${output.name}`} url={url} />
						<button className={buttonClassName} onClick={() => setOutput(null)} type="button">
							Clear
						</button>
					</div>
				</>
			) : null}
			<button className={primaryButtonClassName} disabled={!file || busy} onClick={() => file && void convert(file, format)} type="button">
				{busy ? "Converting…" : "Convert again"}
			</button>
		</ToolPanel>
	);
};
