"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo, writeMetadata } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Fields = { title: string; author: string; subject: string; keywords: string };

const EMPTY: Fields = { title: "", author: "", subject: "", keywords: "" };

const FIELDS: { id: keyof Fields; label: string; hint: string; multiline?: boolean }[] = [
	{ id: "title", label: "Title", hint: "Often shows in the window bar and in search results." },
	{ id: "author", label: "Author", hint: "A person or a company." },
	{ id: "subject", label: "Subject", hint: "One line about what the document is." },
	{ id: "keywords", label: "Keywords", hint: "Separate them with commas." },
];

export const PdfMetadataTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [fields, setFields] = useState<Fields>(EMPTY);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const chooseFile = async (chosen: File | null) => {
		setResult(null);
		setError("");
		setPageCount(null);
		setFields(EMPTY);
		setFile(chosen);
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const info = await readPdfInfo(await readFileBytes(chosen));
			setPageCount(info.pageCount);
			setFields({
				title: info.title ?? "",
				author: info.author ?? "",
				subject: info.subject ?? "",
				keywords: info.keywords.join(", "),
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const save = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await writeMetadata(await readFileBytes(file), fields);
			const filled = Object.values(fields).filter((value) => value.trim()).length;
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "tagged"),
				note: filled === 0 ? "Every field cleared" : `${filled} field${filled === 1 ? "" : "s"} set`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF's details could not be saved.");
		} finally {
			setBusy(false);
		}
	};

	const changed = pageCount !== null;

	return (
		<ToolPanel>
			<FileField accept={ACCEPTED_PDF_TYPES} hint="Only the document's details change; every page is copied through as it is." id="pdf-metadata-file" label="PDF to describe" onFile={chooseFile} />
			{error ? <ErrorNote message={error} /> : null}
			{changed ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						{FIELDS.map((field) => (
							<div key={field.id}>
								<label className={labelClassName} htmlFor={`pdf-metadata-${field.id}`}>
									{field.label}
								</label>
								<input
									className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									id={`pdf-metadata-${field.id}`}
									onChange={(event) => {
										setFields((current) => ({ ...current, [field.id]: event.target.value }));
										setResult(null);
									}}
									placeholder={field.label}
									type="text"
									value={fields[field.id]}
								/>
								<p className={`${hintClassName} mt-2`}>{field.hint}</p>
							</div>
						))}
					</div>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Filled", value: `${Object.values(fields).filter((value) => value.trim()).length}/4` },
							{ label: "Keywords", value: String(fields.keywords.split(",").map((word) => word.trim()).filter(Boolean).length) },
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<div className="flex flex-wrap gap-2">
						<button className={primaryButtonClassName} disabled={busy} onClick={save} type="button">
							{busy ? "Saving…" : "Save details"}
						</button>
						<button
							className={buttonClassName}
							onClick={() => {
								setFields(EMPTY);
								setResult(null);
							}}
							type="button"
						>
							Clear all fields
						</button>
					</div>
					<p className={hintClassName}>{pageWord(pageCount ?? 0)} in this file.</p>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{result.note}</p>
				</div>
			) : null}
			{changed ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
