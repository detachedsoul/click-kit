"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Highlighter, PenLine, Trash2, Undo2 } from "lucide-react";
import { buttonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { applyEdits, EDIT_BOX_DEFAULT, type EditFont, type EditKind, type PdfEdit, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { renderPageThumbnail } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfFileName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

export const MAX_EDIT_PREVIEWS = 40;

const FONTS: { id: EditFont; label: string }[] = [
	{ id: "helvetica", label: "Helvetica" },
	{ id: "times", label: "Times" },
	{ id: "courier", label: "Courier" },
];

const SIZES = ["9", "11", "13", "16", "20", "28"];
const COLOURS = [
	{ id: "black", label: "Black" },
	{ id: "red", label: "Red" },
	{ id: "blue", label: "Blue" },
] as const;

const KINDS: { id: EditKind; label: string }[] = [
	{ id: "text", label: "Text note" },
	{ id: "highlight", label: "Highlight" },
	{ id: "cover", label: "Cover box" },
];

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** Where a click landed on the page, as fractions from the top-left corner. */
export const clickFraction = (rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) => {
	if (!rect.width || !rect.height) return { x: 0.5, y: 0.25 };
	return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
};

/** A line of plain words for the list of marks. */
export const describeEdit = (edit: PdfEdit): string => {
	const place = `${Math.round(edit.x * 100)}% / ${Math.round(edit.y * 100)}%`;
	if (edit.kind === "highlight") return `Highlight on page ${edit.page} at ${place}`;
	if (edit.kind === "cover") return `Cover box on page ${edit.page} at ${place}`;
	return `Note “${(edit.text ?? "").trim()}” on page ${edit.page} at ${place}`;
};

export const PdfEditorTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [thumbs, setThumbs] = useState<string[]>([]);
	const [preview, setPreview] = useState("");
	const [page, setPage] = useState(1);
	const [kind, setKind] = useState<EditKind>("text");
	const [text, setText] = useState("");
	const [font, setFont] = useState<EditFont>("helvetica");
	const [size, setSize] = useState("13");
	const [colour, setColour] = useState<"black" | "red" | "blue">("black");
	const [edits, setEdits] = useState<PdfEdit[]>([]);
	const [customName, setCustomName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const alive = useRef(true);
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	useEffect(
		() => () => {
			alive.current = false;
		},
		[],
	);

	const reset = () => {
		setEdits([]);
		setResult(null);
		setError("");
		setThumbs([]);
		setPreview("");
		setPageCount(null);
		setBytes(null);
		setPage(1);
	};

	const showPage = async (source: Uint8Array, pageNumber: number) => {
		try {
			const shot = await renderPageThumbnail(source, pageNumber, 800);
			if (!alive.current) return;
			setPreview(shot);
		} catch {
			if (!alive.current) return;
			setPreview("");
		}
	};

	const chooseFile = async (chosen: File | null) => {
		reset();
		setFile(chosen);
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const source = await readFileBytes(chosen);
			const info = await readPdfInfo(source);
			if (!alive.current) return;
			setBytes(source);
			setPageCount(info.pageCount);
			setPage(1);
			void showPage(source, 1);
			for (let index = 1; index <= Math.min(info.pageCount, MAX_EDIT_PREVIEWS); index += 1) {
				try {
					const thumb = await renderPageThumbnail(source, index, 120);
					if (!alive.current) return;
					setThumbs((current) => [...current, thumb]);
				} catch {
					if (!alive.current) return;
					setThumbs((current) => [...current, ""]);
				}
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const selectPage = (pageNumber: number) => {
		setPage(pageNumber);
		if (bytes) void showPage(bytes, pageNumber);
	};

	const place = (event: React.MouseEvent<HTMLImageElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const spot = clickFraction(rect, event.clientX, event.clientY);
		const edit: PdfEdit =
			kind === "text"
				? { kind, page, ...spot, text: text.trim(), font, size: Number(size), color: colour }
				: { kind, page, ...spot, ...EDIT_BOX_DEFAULT };
		if (edit.kind === "text" && !edit.text) {
			setError("Type the words for the note first, then click where they should go.");
			return;
		}
		setResult(null);
		setError("");
		setEdits((current) => [...current, edit]);
	};

	const save = async () => {
		if (!file) return;
		if (!edits.length) {
			setError("Add a note, a highlight, or a cover box first.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const source = await readFileBytes(file);
			const out = await applyEdits(source, edits);
			setResult({ blob: new Blob([out.slice().buffer], { type: "application/pdf" }), defaultName: `${file.name.replace(/\.pdf$/iu, "")}-edited` });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be saved with those marks.");
		} finally {
			setBusy(false);
		}
	};

	const onThisPage = edits.filter((edit) => edit.page === page);

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Click on a page to put a note, a highlight, or a cover box there. Every page underneath is copied through as it stands, so the document keeps its own fonts, links, and artwork."
				id="pdf-edit-file"
				label="PDF to edit"
				onFile={(chosen) => void chooseFile(chosen)}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<SegmentedControl<EditKind>
						label="Add"
						onChange={(value) => {
							setKind(value);
							setError("");
						}}
						options={KINDS}
						value={kind}
					/>
					{kind === "text" ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="sm:col-span-2">
								<label className={labelClassName} htmlFor="pdf-edit-text">
									Words for the note
								</label>
								<input
									className={fieldClassName}
									id="pdf-edit-text"
									maxLength={120}
									onChange={(event) => {
										setText(event.target.value);
										setError("");
									}}
									placeholder="Received on 12 May"
									type="text"
									value={text}
								/>
							</div>
							<div>
								<label className={labelClassName} htmlFor="pdf-edit-font">
									Font
								</label>
								<select className={`${selectClassName} mt-2`} id="pdf-edit-font" onChange={(event) => setFont(event.target.value as EditFont)} value={font}>
									{FONTS.map((item) => (
										<option key={item.id} value={item.id}>
											{item.label}
										</option>
									))}
								</select>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className={labelClassName} htmlFor="pdf-edit-size">
										Size
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-edit-size" onChange={(event) => setSize(event.target.value)} value={size}>
										{SIZES.map((item) => (
											<option key={item} value={item}>
												{item} pt
											</option>
										))}
									</select>
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-edit-colour">
										Colour
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-edit-colour" onChange={(event) => setColour(event.target.value as "black" | "red" | "blue")} value={colour}>
										{COLOURS.map((item) => (
											<option key={item.id} value={item.id}>
												{item.label}
											</option>
										))}
									</select>
								</div>
							</div>
						</div>
					) : (
						<p className={hintClassName}>
							{kind === "highlight"
								? "Click where the band should start. It runs a third of the way across the page and is drawn see-through, so the words underneath stay readable."
								: "Click where the box should start. It paints white over that area — it hides what is there rather than removing it from the file."}
						</p>
					)}
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{ label: "Marks", value: String(edits.length) },
							{ label: "On this page", value: String(onThisPage.length) },
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					{thumbs.length ? (
						<div>
							<p className={`${hintClassName} mb-2`}>Pick the page to mark up:</p>
							<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
								{thumbs.map((thumb, index) => {
									const pageNumber = index + 1;
									return (
										<li key={pageNumber}>
											<button
												aria-label={`Go to page ${pageNumber}`}
												aria-pressed={page === pageNumber}
												className={`flex w-16 flex-col items-center gap-1 border p-1 text-[11px] ${page === pageNumber ? "border-accent ring-2 ring-accent" : "border-line bg-[#fbfaf7] hover:border-[#5f6259]"}`}
												onClick={() => selectPage(pageNumber)}
												type="button"
											>
												{thumb ? (
													// eslint-disable-next-line @next/next/no-img-element -- a rendered page preview
													<img alt={`Page ${pageNumber}`} className="max-h-20 w-auto" src={thumb} />
												) : (
													<span className="flex h-20 w-12 items-center justify-center text-muted">…</span>
												)}
												<span className="font-semibold text-[#3c3d37]">{pageNumber}</span>
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					) : null}
					<div>
						<p className={`${hintClassName} mb-2`}>
							Page {page}
							{kind === "text" ? " — click where the note should sit." : " — click where the band should start."}
						</p>
						<div className="relative inline-block max-w-full border border-line bg-white">
							{preview ? (
								// eslint-disable-next-line @next/next/no-img-element -- the page you are marking up
								<img alt={`Page ${page} of ${file?.name ?? "the PDF"}`} className="block max-h-[520px] w-auto max-w-full cursor-crosshair" onClick={place} src={preview} />
							) : (
								<p className="m-0 p-6 text-xs text-muted">Rendering page {page}…</p>
							)}
							{onThisPage.map((edit, index) => (
								<span
									aria-hidden="true"
									className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${edit.kind === "text" ? "bg-[#2f4539]" : edit.kind === "highlight" ? "bg-[#e0b53a]" : "bg-[#b64b31]"}`}
									key={`${edit.page}-${index}`}
									style={{ left: `${edit.x * 100}%`, top: `${edit.y * 100}%` }}
								/>
							))}
						</div>
					</div>
					{edits.length ? (
						<>
							<ul className="m-0 flex list-none flex-col gap-2 p-0">
								{edits.map((edit, index) => (
									<li className="flex flex-wrap items-center gap-2 border border-line bg-[#fbfaf7] p-2" key={`${edit.page}-${edit.kind}-${index}`}>
										{edit.kind === "text" ? <PenLine aria-hidden="true" size={13} /> : edit.kind === "highlight" ? <Highlighter aria-hidden="true" size={13} /> : <Eraser aria-hidden="true" size={13} />}
										<span className="min-w-0 flex-1 text-xs text-ink">{describeEdit(edit)}</span>
										<button aria-label={`Remove ${describeEdit(edit)}`} className={buttonClassName} onClick={() => setEdits((current) => current.filter((_item, at) => at !== index))} type="button">
											<Trash2 aria-hidden="true" size={13} />
										</button>
									</li>
								))}
							</ul>
							<div className="flex flex-wrap gap-2">
								<button className={buttonClassName} onClick={() => setEdits((current) => current.slice(0, -1))} type="button">
									<Undo2 aria-hidden="true" size={13} /> Undo last
								</button>
								<button className={buttonClassName} onClick={() => setEdits([])} type="button">
									Clear all marks
								</button>
							</div>
							<button className={primaryButtonClassName} disabled={busy} onClick={() => void save()} type="button">
								{busy ? "Saving…" : "Save the edited PDF"}
							</button>
						</>
					) : (
						<p className={hintClassName}>No marks yet. Click on the page above to add one.</p>
					)}
				</>
			) : null}
			{result && resultUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Edited PDF</h2>
						<FileDownloadLink fileName={fileName} label={`Download ${fileName}`} url={resultUrl} />
					</div>
					<div>
						<label className={labelClassName} htmlFor="pdf-edit-name">
							Name for the file
						</label>
						<input
							className={fieldClassName}
							id="pdf-edit-name"
							maxLength={100}
							onChange={(event) => setCustomName(event.target.value)}
							placeholder={result.defaultName}
							type="text"
							value={customName}
						/>
					</div>
					<p className="m-0 text-xs text-muted">
						{edits.length} mark{edits.length === 1 ? "" : "s"} across {pageWord(pageCount ?? 0)} · {describeBytes(result.blob.size)}
					</p>
				</section>
			) : null}
			{pageCount !== null ? (
				<button className={buttonClassName} onClick={() => void chooseFile(null)} type="button">
					Choose another PDF
				</button>
			) : null}
		</ToolPanel>
	);
};
