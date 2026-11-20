"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { docxToPdf } from "@/features/converter-tools/word-pdf";

type PageSize = "a4" | "letter";

const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DocxPdfTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageSize, setPageSize] = useState<PageSize>("a4");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [output, setOutput] = useState<{ blob: Blob; name: string; pageCount: number; wordCount: number } | null>(null);
	const url = useObjectUrl(output?.blob ?? null);

	const convert = async (chosen: File, size: PageSize) => {
		setBusy(true);
		setError("");
		setOutput(null);
		setFile(chosen);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the Word file under 30 MB.");
			const { bytes, pageCount, wordCount } = await docxToPdf(new Uint8Array(await chosen.arrayBuffer()), { pageSize: size });
			const base = chosen.name.replace(/\.docx$/iu, "") || "document";
			setOutput({ blob: new Blob([bytes.slice().buffer], { type: "application/pdf" }), name: `${base}.pdf`, pageCount, wordCount });
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/not a zip|central directory|not a Word document/iu.test(message)) setError("That file could not be opened as a Word document. Only .docx files work — the older .doc format does not.");
			else if (/no text/iu.test(message)) setError("This document has no text to convert — it may be images or empty paragraphs only.");
			else setError(message || "This document could not be converted.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPT}
				hint="Read in this tab and never uploaded. Headings, paragraphs, bold and italic text, lists, and tables are set again as real, selectable PDF text. Comments, tracked changes, text boxes, and pictures are left out rather than guessed at."
				id="docx-pdf-file"
				label="Word document (.docx)"
				onFile={(chosen) => {
					if (chosen) void convert(chosen, pageSize);
					else {
						setFile(null);
						setOutput(null);
						setError("");
					}
				}}
			/>
			<SegmentedControl<PageSize>
				label="Page size"
				onChange={(next) => {
					setPageSize(next);
					if (file) void convert(file, next);
				}}
				options={[
					{ id: "a4", label: "A4" },
					{ id: "letter", label: "Letter" },
				]}
				value={pageSize}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName}>Setting the pages…</p> : null}
			{output && url ? (
				<>
					<StatGrid
						items={[
							{ label: "Pages", value: String(output.pageCount) },
							{ label: "Words", value: output.wordCount.toLocaleString() },
							{ label: "Size", value: describeBytes(output.blob.size) },
							{ label: "Paper", value: pageSize === "a4" ? "A4" : "Letter" },
						]}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<FileDownloadLink fileName={output.name} label={`Download ${output.name}`} url={url} />
						<button className={buttonClassName} onClick={() => setOutput(null)} type="button">
							Clear
						</button>
					</div>
					<p className={hintClassName}>
						{output.pageCount === 1 ? "One page of" : `${output.pageCount} pages of`} real PDF text — you can select it, search it, and copy it.
					</p>
				</>
			) : null}
			<button className={primaryButtonClassName} disabled={!file || busy} onClick={() => file && void convert(file, pageSize)} type="button">
				{busy ? "Converting…" : "Convert again"}
			</button>
		</ToolPanel>
	);
};
