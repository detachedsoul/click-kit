"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { comparisonToMarkdown, comparePages, describeComparison, type PageChange, summarise } from "@/features/pdf-tools/pdf-diff";
import { extractPdfText } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfBaseName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const MAX_SHOWN_PAGES = 25;
const MAX_SHOWN_LINES = 40;

type Side = { file: File | null; pages: number | null; problem: string };

const EMPTY_SIDE: Side = { file: null, pages: null, problem: "" };

const linesOf = (text: string) =>
	text
		.split(/\r?\n/gu)
		.map((line) => line.replace(/\s+/gu, " ").trim())
		.filter(Boolean);

export const PdfCompareTool = () => {
	const [first, setFirst] = useState<Side>(EMPTY_SIDE);
	const [second, setSecond] = useState<Side>(EMPTY_SIDE);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [changes, setChanges] = useState<PageChange[] | null>(null);
	const report = changes && first.file && second.file ? comparisonToMarkdown(changes, first.file.name, second.file.name) : null;
	const reportUrl = useObjectUrl(report ? new Blob([report], { type: "text/markdown;charset=utf-8" }) : null);

	const choose = async (chosen: File | null, which: "first" | "second") => {
		const set = which === "first" ? setFirst : setSecond;
		setError("");
		setChanges(null);
		set({ file: chosen, pages: null, problem: "" });
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			set({ file: chosen, pages: null, problem });
			return;
		}
		try {
			const info = await readPdfInfo(await readFileBytes(chosen));
			set({ file: chosen, pages: info.pageCount, problem: "" });
		} catch (caught) {
			set({ file: chosen, pages: null, problem: caught instanceof Error ? caught.message : "This PDF could not be read." });
		}
	};

	const compare = async () => {
		if (!first.file || !second.file) return;
		setBusy(true);
		setError("");
		setChanges(null);
		try {
			const left = await readFileBytes(first.file);
			const right = await readFileBytes(second.file);
			// One document at a time: two pdf.js workers at once in a tab that is already
			// holding two files is more memory than a comparison needs.
			const leftText = await extractPdfText(left);
			const rightText = await extractPdfText(right);
			setChanges(
				comparePages(
					leftText.sort((a, b) => a.page - b.page).map((page) => linesOf(page.text)),
					rightText.sort((a, b) => a.page - b.page).map((page) => linesOf(page.text)),
				),
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These documents could not be compared.");
		} finally {
			setBusy(false);
		}
	};

	const summary = changes ? summarise(changes) : null;
	const interesting = changes?.filter((change) => change.status !== "same") ?? [];
	const ready = Boolean(first.file && second.file && !first.problem && !second.problem);

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<FileField accept={ACCEPTED_PDF_TYPES} hint="The copy you started from." id="pdf-compare-first" label="First PDF (the original)" onFile={(chosen) => void choose(chosen, "first")} />
				<FileField accept={ACCEPTED_PDF_TYPES} hint="The copy you were sent back." id="pdf-compare-second" label="Second PDF (the newer one)" onFile={(chosen) => void choose(chosen, "second")} />
			</div>
			{first.problem ? <ErrorNote message={first.problem} /> : null}
			{second.problem ? <ErrorNote message={second.problem} /> : null}
			{error ? <ErrorNote message={error} /> : null}
			{first.file && second.file ? (
				<StatGrid
					items={[
						{ label: "First", value: first.pages === null ? "…" : pageWord(first.pages) },
						{ label: "Second", value: second.pages === null ? "…" : pageWord(second.pages) },
						{ label: "First size", value: describeBytes(first.file.size) },
						{ label: "Second size", value: describeBytes(second.file.size) },
					]}
				/>
			) : null}
			<button className={primaryButtonClassName} disabled={!ready || busy} onClick={() => void compare()} type="button">
				{busy ? "Reading both documents…" : "Compare the words"}
			</button>
			<p className={hintClassName}>
				Text only, page by page: pictures, colours, and margins are ignored, because what usually changes in a contract or a report is the wording. A page that only gained a logo reads as unchanged.
			</p>
			{summary ? (
				<>
					<div className="border border-line bg-[#f8f7f3] p-4">
						<p className="m-0 text-sm font-semibold text-ink" role="status">
							{describeComparison(summary)}
						</p>
					</div>
					<StatGrid
						items={[
							{ label: "Pages", value: String(summary.total) },
							{ label: "Changed", value: String(summary.changed) },
							{ label: "Added", value: String(summary.added) },
							{ label: "Removed", value: String(summary.removed) },
						]}
					/>
					{interesting.length === 0 ? (
						<p className={hintClassName}>Nothing to show. The two files read identically.</p>
					) : (
						<div className="flex flex-col gap-4">
							{interesting.slice(0, MAX_SHOWN_PAGES).map((change) => (
								<section className="border border-line" key={change.page}>
									<h3 className="m-0 border-b border-line bg-[#fbfaf7] px-3 py-2 text-xs font-semibold text-ink">
										Page {change.page} — {change.status}
									</h3>
									<ul className="m-0 flex list-none flex-col gap-1 p-3 font-mono text-[12px] leading-relaxed">
										{change.lines
											.filter((line) => line.kind !== "same")
											.slice(0, MAX_SHOWN_LINES)
											.map((line, index) => (
												<li className={line.kind === "added" ? "text-[#2f4539]" : "text-[#8a3f30]"} key={`${change.page}-${index}`}>
													<span aria-hidden="true">{line.kind === "added" ? "+ " : "− "}</span>
													<span className="sr-only">{line.kind === "added" ? "added: " : "removed: "}</span>
													{line.text}
												</li>
											))}
										{change.lines.filter((line) => line.kind !== "same").length > MAX_SHOWN_LINES ? <li className="text-muted">… and more on this page; the report has all of it.</li> : null}
									</ul>
								</section>
							))}
							{interesting.length > MAX_SHOWN_PAGES ? <p className={hintClassName}>{interesting.length - MAX_SHOWN_PAGES} more changed pages are in the report but not on this screen.</p> : null}
							<div className="flex flex-wrap items-center gap-3">
								<FileDownloadLink fileName={`${pdfBaseName(first.file?.name ?? "first")}-compared.md`} label="Download the report" url={reportUrl} />
							</div>
						</div>
					)}
				</>
			) : null}
			{first.file || second.file ? (
				<button
					className={buttonClassName}
					onClick={() => {
						setFirst(EMPTY_SIDE);
						setSecond(EMPTY_SIDE);
						setChanges(null);
						setError("");
					}}
					type="button"
				>
					Start again
				</button>
			) : null}
		</ToolPanel>
	);
};
