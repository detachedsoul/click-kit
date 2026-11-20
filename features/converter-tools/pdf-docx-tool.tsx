"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { pageWordCount, pdfPagesToDocx, type PdfPage } from "@/features/converter-tools/pdf-docx";
import { readFileBytes } from "@/features/pdf-tools/pdf-engine";
import { extractPdfText } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfBaseName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

export const PdfDocxTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [output, setOutput] = useState<{ blob: Blob; name: string; pages: number; words: number; empty: number[] } | null>(null);
	const url = useObjectUrl(output?.blob ?? null);

	const convert = async (chosen: File) => {
		setBusy(true);
		setError("");
		setOutput(null);
		setFile(chosen);
		try {
			const problem = validatePdfFile(chosen);
			if (problem) throw new Error(problem);
			const pages: PdfPage[] = await extractPdfText(await readFileBytes(chosen));
			const words = pageWordCount(pages);
			if (!words) throw new Error("This PDF has no text to carry across — it is probably a scan. Try the PDF to images tool, or run it through OCR first.");
			const bytes = pdfPagesToDocx(pages);
			setOutput({
				blob: new Blob([bytes.slice().buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
				empty: pages.filter((page) => !page.text.trim()).map((page) => page.page),
				name: `${pdfBaseName(chosen.name)}.docx`,
				pages: pages.length,
				words,
			});
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			setError(/password|encrypt/iu.test(message) ? "This PDF is locked. Unlock it first, then convert it." : message || "This PDF could not be read.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Read in this tab and never uploaded. Every page becomes a Word page, and its lines become paragraphs with the soft wraps joined back up. It is text only — pictures, columns, tables, and exact placement stay behind in the PDF."
				id="pdf-docx-file"
				label="PDF to convert"
				onFile={(chosen) => {
					if (chosen) void convert(chosen);
					else {
						setFile(null);
						setOutput(null);
						setError("");
					}
				}}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName}>Reading the pages…</p> : null}
			{output && url ? (
				<>
					<StatGrid
						items={[
							{ label: "Pages", value: String(output.pages) },
							{ label: "Words", value: output.words.toLocaleString() },
							{ label: "Size", value: describeBytes(output.blob.size) },
							{ label: "Blank pages", value: String(output.empty.length) },
						]}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<FileDownloadLink fileName={output.name} label={`Download ${output.name}`} url={url} />
						<button className={buttonClassName} onClick={() => setOutput(null)} type="button">
							Clear
						</button>
					</div>
					<p className={hintClassName}>
						{pageWord(output.pages)} written as Word paragraphs, a page break wherever the PDF had one
						{output.empty.length ? ` — pages ${output.empty.join(", ")} had no text and come across blank` : ""}.
					</p>
				</>
			) : null}
			<button className={primaryButtonClassName} disabled={!file || busy} onClick={() => file && void convert(file)} type="button">
				{busy ? "Converting…" : "Convert again"}
			</button>
		</ToolPanel>
	);
};
