"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo, rotatePages } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, parsePageRange, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Turn = 90 | 180 | 270;

const TURNS: { id: Turn; label: string }[] = [
	{ id: 90, label: "90° clockwise" },
	{ id: 180, label: "180°" },
	{ id: 270, label: "90° anticlockwise" },
];

export const PdfRotateTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [turn, setTurn] = useState<Turn>(90);
	const [range, setRange] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	/** Which pages the turn applies to, or the reason there are none. */
	const planned = (() => {
		if (pageCount === null) return { pages: [] as number[], error: "" };
		if (!range.trim()) return { pages: Array.from({ length: pageCount }, (_page, index) => index + 1), error: "" };
		try {
			return { pages: [...new Set(parsePageRange(range, pageCount))].sort((left, right) => left - right), error: "" };
		} catch (caught) {
			return { pages: [] as number[], error: caught instanceof Error ? caught.message : "Those pages could not be read." };
		}
	})();

	const rotate = async () => {
		if (!file) return;
		if (planned.error) {
			setError(planned.error);
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await rotatePages(await readFileBytes(file), { angle: turn, pages: planned.pages });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "rotated"),
				note: `${planned.pages.length === pageCount ? `All ${pageWord(pageCount ?? 0)}` : `${planned.pages.length} of ${pageCount} ${pageWord(pageCount ?? 0)}`} turned ${turn}°`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be turned.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="A sideways scan turns upright. The page is turned in the page tree, so the content is not redrawn and text, links, and vectors keep their quality."
				id="pdf-rotate-file"
				label="PDF to turn"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div>
						<span className={labelClassName}>Turn</span>
						<div className="mt-2 flex flex-wrap gap-2">
							{TURNS.map((option) => (
								<button
									aria-pressed={turn === option.id}
									className={`${primaryButtonClassName} ${turn === option.id ? "" : "border-line bg-surface text-ink hover:border-[#5f6259]"}`}
									key={option.id}
									onClick={() => {
										setTurn(option.id);
										setResult(null);
									}}
									type="button"
								>
									{option.label}
								</button>
							))}
						</div>
					</div>
					<div>
						<label className={labelClassName} htmlFor="pdf-rotate-pages">
							Pages
						</label>
						<input
							aria-describedby="pdf-rotate-pages-hint"
							className={fieldClassName}
							id="pdf-rotate-pages"
							onChange={(event) => {
								setRange(event.target.value);
								setResult(null);
							}}
							placeholder="All pages"
							type="text"
							value={range}
						/>
						<p className={hintClassName} id="pdf-rotate-pages-hint">
							Leave this empty to turn every page, or pick some with 1-3, 5, 9-12. Each turn adds to the rotation a page already has.
						</p>
						{planned.error ? <p className="mt-2 text-xs text-[#8a3f30]">{planned.error}</p> : null}
					</div>
					<StatGrid
						items={[
							{ label: "Pages in", value: String(pageCount) },
							{ label: "Pages turning", value: planned.error ? "—" : String(planned.pages.length) },
							{ label: "Turn", value: `${turn}°` },
							{ label: "Now", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy || Boolean(planned.error)} onClick={rotate} type="button">
						{busy ? "Turning…" : "Turn the pages"}
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
