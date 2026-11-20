"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eraser, Highlighter, PenLine, Trash2, Undo2 } from "lucide-react";
import { buttonClassName, choiceButtonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
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

/** Each tool carries the one line that explains it, so the choice is never a guess. */
const KINDS: { id: EditKind; label: string; blurb: string }[] = [
	{ id: "text", label: "Text note", blurb: "Type a line and drop it anywhere — a date, an initial, a correction." },
	{ id: "highlight", label: "Highlight", blurb: "A see-through band over a phrase you want to come back to." },
	{ id: "cover", label: "Cover box", blurb: "Paints white over something. It hides it — it does not remove it from the file." },
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

/** The instruction under the page, in the words of the tool that is loaded. */
const instruction = (kind: EditKind) => {
	if (kind === "text") return "Click the spot where the note should sit. Its left edge lands on your click.";
	if (kind === "highlight") return "Click where the band should begin. It runs about a third of the way across and lets the words show through.";
	return "Click where the white box should begin. It covers what is underneath rather than deleting it.";
};

type Spot = { x: number; y: number };

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
	const [hover, setHover] = useState<Spot | null>(null);
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
		setHover(null);
		setCustomName("");
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
		setHover(null);
		if (bytes) void showPage(bytes, pageNumber);
	};

	const addEdit = (spot: Spot) => {
		const edit: PdfEdit = kind === "text" ? { kind, page, ...spot, text: text.trim(), font, size: Number(size), color: colour } : { kind, page, ...spot, ...EDIT_BOX_DEFAULT };
		if (edit.kind === "text" && !edit.text) {
			setError("Type the words for the note first, then click where they should go.");
			return;
		}
		setResult(null);
		setError("");
		setEdits((current) => [...current, edit]);
	};

	const place = (event: React.MouseEvent<HTMLImageElement>) => {
		addEdit(clickFraction(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
	};

	const trackHover = (event: React.MouseEvent<HTMLImageElement>) => {
		setHover(clickFraction(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
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

	const active = KINDS.find((entry) => entry.id === kind) ?? KINDS[0];
	const onThisPage = edits.map((edit, index) => ({ edit, index })).filter((entry) => entry.edit.page === page);
	const total = pageCount ?? 0;

	/** How a placed mark looks on the page: a chip for words, a band, or a white box. */
	const markShape = (edit: PdfEdit) => {
		if (edit.kind === "highlight") {
			return <span className="absolute block rounded-[1px] bg-[#f5d76e]/60 ring-1 ring-[#d9b53e]/70" style={{ left: `${edit.x * 100}%`, top: `${edit.y * 100}%`, width: `${(edit.width ?? EDIT_BOX_DEFAULT.width) * 100}%`, height: `${(edit.height ?? EDIT_BOX_DEFAULT.height) * 100}%` }} />;
		}
		if (edit.kind === "cover") {
			return <span className="absolute block border border-dashed border-[#b64b31] bg-white" style={{ left: `${edit.x * 100}%`, top: `${edit.y * 100}%`, width: `${(edit.width ?? EDIT_BOX_DEFAULT.width) * 100}%`, height: `${(edit.height ?? EDIT_BOX_DEFAULT.height) * 100}%` }} />;
		}
		return (
			<span className="absolute max-w-[60%] truncate rounded-sm bg-[#2f4539]/85 px-1 py-px text-[10px] text-white" style={{ left: `${edit.x * 100}%`, top: `${edit.y * 100}%` }}>
				{edit.text}
			</span>
		);
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Three steps: pick a mark, click the page, save. Every page underneath is copied through as it stands, so the document keeps its own fonts, links, and artwork."
				id="pdf-edit-file"
				label="PDF to edit"
				onFile={(chosen) => void chooseFile(chosen)}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<section className="flex flex-col gap-3">
						<div className="flex items-baseline gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
								1
							</span>
							<h2 className="m-0 text-sm font-semibold text-ink">Choose a mark</h2>
						</div>
						<div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Add">
							{KINDS.map((entry) => {
								const Icon = entry.id === "text" ? PenLine : entry.id === "highlight" ? Highlighter : Eraser;
								const chosen = kind === entry.id;
								return (
									<div className="flex flex-col gap-1" key={entry.id}>
										<button
											aria-pressed={chosen}
											className={`${choiceButtonClassName(chosen)} flex flex-col items-start gap-1 px-3 text-left`}
											onClick={() => {
												setKind(entry.id);
												setError("");
											}}
											type="button"
										>
											<span className="flex items-center gap-2 text-xs font-semibold">
												<Icon aria-hidden="true" size={14} /> {entry.label}
											</span>
										</button>
										<p className={`m-0 text-[11px] leading-snug ${chosen ? "text-ink" : "text-muted"}`}>{entry.blurb}</p>
									</div>
								);
							})}
						</div>
						{kind === "text" ? (
							<div className="grid gap-3 border border-line bg-[#fbfaf7] p-3 sm:grid-cols-2">
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
								<div className="grid grid-cols-3 gap-3 sm:col-span-2">
									<div>
										<label className={labelClassName} htmlFor="pdf-edit-font">
											Font
										</label>
										<select className={`${selectClassName} mt-1`} id="pdf-edit-font" onChange={(event) => setFont(event.target.value as EditFont)} value={font}>
											{FONTS.map((item) => (
												<option key={item.id} value={item.id}>
													{item.label}
												</option>
											))}
										</select>
									</div>
									<div>
										<label className={labelClassName} htmlFor="pdf-edit-size">
											Size
										</label>
										<select className={`${selectClassName} mt-1`} id="pdf-edit-size" onChange={(event) => setSize(event.target.value)} value={size}>
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
										<select className={`${selectClassName} mt-1`} id="pdf-edit-colour" onChange={(event) => setColour(event.target.value as "black" | "red" | "blue")} value={colour}>
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
							<p className={hintClassName}>{kind === "highlight" ? "The band is drawn see-through, so the words underneath stay readable." : "It hides what is there rather than removing it from the file — nothing in a PDF can be taken out this way."}</p>
						)}
					</section>

					<section className="flex flex-col gap-3">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<div className="flex items-baseline gap-2">
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
									2
								</span>
								<h2 className="m-0 text-sm font-semibold text-ink">Click the page</h2>
							</div>
							<p className="m-0 text-xs text-muted">Page {page} of {total}</p>
						</div>
						<p className={hintClassName}>{instruction(kind)}</p>
						<div className="relative self-start border border-line bg-white shadow-sm">
							{preview ? (
								// eslint-disable-next-line @next/next/no-img-element -- the rendered page you are marking up
								<img
									alt={`Page ${page} of ${file?.name ?? "the PDF"}`}
									aria-label={`Place a ${active.label.toLowerCase()} on page ${page}`}
									className="block max-h-[560px] w-auto max-w-full cursor-crosshair select-none"
									draggable={false}
									onClick={place}
									onKeyDown={(event) => {
										if (event.key !== "Enter" && event.key !== " ") return;
										event.preventDefault();
										addEdit({ x: 0.5, y: 0.5 });
									}}
									onMouseLeave={() => setHover(null)}
									onMouseMove={trackHover}
									role="button"
									src={preview}
									tabIndex={0}
								/>
							) : (
								<p className="m-0 p-6 text-xs text-muted">Rendering page {page}…</p>
							)}
							{hover ? (
								kind === "text" ? (
									<span aria-hidden="true" className="pointer-events-none absolute z-10 block -translate-y-1/2 rounded-sm bg-[#2f4539]/40 px-1 py-px text-[10px] text-white" style={{ left: `${hover.x * 100}%`, top: `${hover.y * 100}%` }}>
										{text.trim() || "Note"}
									</span>
								) : (
									<span
										aria-hidden="true"
										className={`pointer-events-none absolute z-10 block ${kind === "highlight" ? "bg-[#f5d76e]/50 ring-1 ring-[#d9b53e]" : "border border-dashed border-[#b64b31] bg-white/70"}`}
										style={{ left: `${hover.x * 100}%`, top: `${hover.y * 100}%`, width: `${EDIT_BOX_DEFAULT.width * 100}%`, height: `${EDIT_BOX_DEFAULT.height * 100}%` }}
									/>
								)
							) : null}
							{onThisPage.map(({ edit, index }) => (
								<span aria-hidden="true" className="pointer-events-none absolute" key={`${edit.page}-${edit.kind}-${index}`}>
									{markShape(edit)}
								</span>
							))}
						</div>
						{onThisPage.length ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs text-muted">On this page:</span>
								{onThisPage.map(({ edit, index }) => (
									<span className="inline-flex items-center gap-1 border border-line bg-[#fbfaf7] py-1 pl-2 pr-1 text-[11px] text-ink" key={`chip-${edit.page}-${index}`}>
										{edit.kind === "text" ? <PenLine aria-hidden="true" size={11} /> : edit.kind === "highlight" ? <Highlighter aria-hidden="true" size={11} /> : <Eraser aria-hidden="true" size={11} />}
										{describeEdit(edit).replace(` on page ${edit.page}`, "")}
										<button aria-label={`Remove ${describeEdit(edit)} from the page`} className="cursor-pointer border-0 bg-transparent p-0 text-[#8a3f30] hover:underline" onClick={() => setEdits((current) => current.filter((_item, at) => at !== index))} type="button">
											<Trash2 aria-hidden="true" size={11} />
										</button>
									</span>
								))}
							</div>
						) : (
							<p className="m-0 text-xs text-muted">No marks yet. Click on the page above to add one.</p>
						)}
					</section>

					<section className="flex flex-col gap-3">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-baseline gap-2">
								<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
									3
								</span>
								<h2 className="m-0 text-sm font-semibold text-ink">Save</h2>
							</div>
							<div className="flex items-center gap-1">
								<button aria-label="Previous page" className={`${buttonClassName} px-2`} disabled={page <= 1} onClick={() => selectPage(Math.max(1, page - 1))} type="button">
									<ArrowLeft aria-hidden="true" size={13} />
								</button>
								<button aria-label="Next page" className={`${buttonClassName} px-2`} disabled={page >= total} onClick={() => selectPage(Math.min(total, page + 1))} type="button">
									<ArrowRight aria-hidden="true" size={13} />
								</button>
							</div>
						</div>
						<StatGrid
							items={[
								{ label: "Pages", value: String(pageCount) },
								{ label: "Marks", value: String(edits.length) },
								{ label: "On this page", value: String(onThisPage.length) },
								{ label: "Size", value: file ? describeBytes(file.size) : "—" },
							]}
						/>
						{edits.length ? (
							<ul className="m-0 flex list-none flex-col gap-2 p-0">
								{edits.map((edit, index) => (
									<li className="flex flex-wrap items-center gap-2 border border-line bg-[#fbfaf7] p-2" key={`${edit.page}-${edit.kind}-${index}`}>
										{edit.kind === "text" ? <PenLine aria-hidden="true" size={13} /> : edit.kind === "highlight" ? <Highlighter aria-hidden="true" size={13} /> : <Eraser aria-hidden="true" size={13} />}
										<span className="min-w-0 flex-1 text-xs text-ink">{describeEdit(edit)}</span>
										{edit.page !== page ? (
											<button className={buttonClassName} onClick={() => selectPage(edit.page)} type="button">
												Show
											</button>
										) : null}
										<button aria-label={`Remove ${describeEdit(edit)}`} className={`${buttonClassName} px-2`} onClick={() => setEdits((current) => current.filter((_item, at) => at !== index))} type="button">
											<Trash2 aria-hidden="true" size={13} />
										</button>
									</li>
								))}
							</ul>
						) : null}
						<div className="flex flex-wrap items-center gap-2">
							<button className={primaryButtonClassName} disabled={busy || !edits.length} onClick={() => void save()} type="button">
								{busy ? "Saving…" : "Save the edited PDF"}
							</button>
							<button className={buttonClassName} disabled={!edits.length} onClick={() => setEdits((current) => current.slice(0, -1))} type="button">
								<Undo2 aria-hidden="true" size={13} /> Undo last
							</button>
							<button className={buttonClassName} disabled={!edits.length} onClick={() => setEdits([])} type="button">
								Clear all marks
							</button>
						</div>
						<p className={hintClassName}>
							{edits.length
								? `${edits.length} mark${edits.length === 1 ? "" : "s"} ready. The finished file keeps every page exactly as it was, with your marks drawn on top.`
								: "Nothing to save yet — the button comes alive once there is at least one mark."}
						</p>
					</section>

					{thumbs.length ? (
						<section className="flex flex-col gap-2">
							<p className={`${hintClassName} mb-0`}>Jump to a page</p>
							<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
								{thumbs.map((thumb, index) => {
									const pageNumber = index + 1;
									return (
										<li key={pageNumber}>
											<button
												aria-label={`Go to page ${pageNumber}`}
												aria-pressed={page === pageNumber}
												className={`flex w-16 cursor-pointer flex-col items-center gap-1 border p-1 text-[11px] ${page === pageNumber ? "border-accent ring-2 ring-accent" : "border-line bg-[#fbfaf7] hover:border-[#5f6259]"}`}
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
						</section>
					) : null}
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
						<input className={fieldClassName} id="pdf-edit-name" maxLength={100} onChange={(event) => setCustomName(event.target.value)} placeholder={result.defaultName} type="text" value={customName} />
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
