"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { addHeadersAndFooters, fillLabel, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Align = "left" | "center" | "right";

const ALIGNMENTS: { id: Align; label: string }[] = [
	{ id: "left", label: "Left" },
	{ id: "center", label: "Centre" },
	{ id: "right", label: "Right" },
];

export const PdfPageNumbersTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [title, setTitle] = useState("");
	const [header, setHeader] = useState("{title}");
	const [footer, setFooter] = useState("Page {page} of {pages}");
	const [align, setAlign] = useState<Align>("center");
	const [startAt, setStartAt] = useState("1");
	const [skipFirst, setSkipFirst] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const start = Math.max(1, Number.parseInt(startAt || "1", 10) || 1);
	const total = pageCount === null ? 0 : pageCount + start - 1;
	const sample = footer.trim()
		? fillLabel(footer, { page: start + (skipFirst ? 1 : 0), pages: total, title, date: new Date().toISOString().slice(0, 10) })
		: "—";

	const chooseFile = async (chosen: File | null) => {
		setResult(null);
		setError("");
		setPageCount(null);
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
			setTitle(info.title ?? "");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const apply = async () => {
		if (!file) return;
		if (!header.trim() && !footer.trim()) {
			setError("Write something for the header or the footer.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await addHeadersAndFooters(await readFileBytes(file), {
				header,
				footer,
				align,
				startAt: start,
				skipFirst,
			});
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "numbered"),
				note: `Numbers ${skipFirst ? start + 1 : start}${total > (skipFirst ? start : start - 1) ? `–${total}` : ""}${skipFirst ? ", first page left clean" : ""}`,
			});
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			setError(/WinAnsi|encode/iu.test(message) ? "The built-in numbering font only covers Latin letters, digits, and common punctuation." : message || "This PDF could not be numbered.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Headers and page numbers are added on top of each page, so the text underneath stays selectable and the fonts stay embedded."
				id="pdf-numbers-file"
				label="PDF to number"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClassName} htmlFor="pdf-numbers-header">
								Header
							</label>
							<input
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="pdf-numbers-header"
								onChange={(event) => {
									setHeader(event.target.value);
									setResult(null);
								}}
								placeholder="Leave empty for none"
								type="text"
								value={header}
							/>
						</div>
						<div>
							<label className={labelClassName} htmlFor="pdf-numbers-footer">
								Footer
							</label>
							<input
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="pdf-numbers-footer"
								onChange={(event) => {
									setFooter(event.target.value);
									setResult(null);
								}}
								placeholder="Leave empty for none"
								type="text"
								value={footer}
							/>
						</div>
					</div>
					<p className={hintClassName}>
						Placeholders: <code>{"{page}"}</code>, <code>{"{pages}"}</code>, <code>{"{title}"}</code>, <code>{"{date}"}</code>.
					</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClassName} htmlFor="pdf-numbers-align">
								Line up on
							</label>
							<select className={`${selectClassName} mt-2`} id="pdf-numbers-align" onChange={(event) => setAlign(event.target.value as Align)} value={align}>
								{ALIGNMENTS.map((item) => (
									<option key={item.id} value={item.id}>
										{item.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClassName} htmlFor="pdf-numbers-start">
								First number
							</label>
							<input
								className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								id="pdf-numbers-start"
								min={1}
								onChange={(event) => {
									setStartAt(event.target.value);
									setResult(null);
								}}
								type="number"
								value={startAt}
							/>
						</div>
					</div>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]">
						<input checked={skipFirst} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setSkipFirst(event.target.checked)} type="checkbox" />
						Leave the first page clean (cover)
					</label>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Numbers", value: skipFirst ? `${start + 1}–${total}` : `${start}–${total}` },
							{ label: "Preview", value: sample },
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy || (!header.trim() && !footer.trim())} onClick={apply} type="button">
						{busy ? "Numbering…" : "Add headers and numbers"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{result.note}</p>
				</div>
			) : null}
			{pageCount !== null ? (
				<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
