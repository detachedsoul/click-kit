"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eraser, Highlighter, Image as ImageIcon, PenLine, Trash2, Undo2 } from "lucide-react";
import { buttonClassName, choiceButtonClassName, ErrorNote, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { applyEdits, EDIT_BOX_DEFAULT, type EditFont, type EditKind, type EditWeight, type PdfEdit, pageSizes, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { renderPageThumbnail } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfFileName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

export const MAX_EDIT_PREVIEWS = 40;

const FONTS: { id: EditFont; label: string }[] = [
	{ id: "helvetica", label: "Helvetica" },
	{ id: "times", label: "Times" },
	{ id: "courier", label: "Courier" },
];

const WEIGHTS: { id: EditWeight; label: string }[] = [
	{ id: "regular", label: "Regular" },
	{ id: "bold", label: "Bold" },
];

const SIZES = ["9", "11", "13", "16", "20", "28"];

/** Backgrounds to offer as buttons; anything else can be picked with the colour well. */
const BACKGROUNDS: { id: string; label: string; value: string | null }[] = [
	{ id: "none", label: "No background", value: null },
	{ id: "white", label: "White background", value: "#ffffff" },
	{ id: "lemon", label: "Lemon background", value: "#fdf3c4" },
	{ id: "black", label: "Black background", value: "#111111" },
];

/** Each tool carries the one line that explains it, so the choice is never a guess. */
const KINDS: { id: EditKind; label: string; blurb: string }[] = [
	{ id: "text", label: "Text note", blurb: "Click the page and type straight onto it. No background unless you ask for one." },
	{ id: "highlight", label: "Highlight", blurb: "A see-through band over a phrase you want to come back to." },
	{ id: "cover", label: "Cover box", blurb: "Paints white over something. It hides it — it does not remove it from the file." },
	{ id: "image", label: "Picture", blurb: "A signature, a logo, or a photo, placed where you click." },
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
	if (edit.kind === "image") return `Picture on page ${edit.page} at ${place}`;
	return `Note “${(edit.text ?? "").trim()}” on page ${edit.page} at ${place}`;
};

/** The instruction under the page, in the words of the tool that is loaded. */
const instruction = (kind: EditKind) => {
	if (kind === "text") return "Click the page where the words should begin, then type. Enter places them, Escape drops them.";
	if (kind === "highlight") return "Click where the band should begin. Drag it to move it, or pull the corner to make it wider.";
	if (kind === "image") return "Click where the picture should sit. Drag it to move it; its width is set below.";
	return "Click where the white box should begin. It covers what is underneath rather than deleting it.";
};

type Spot = { x: number; y: number };

/** A note being typed on the page. `index` is the mark it re-opens, or null for a new one. */
type Draft = { page: number; x: number; y: number; text: string; index: number | null };

/** A placed mark plus the object URL used to show a picture on screen (never stored in the PDF). */
type Mark = PdfEdit & { preview?: string };

type Picture = { bytes: Uint8Array; format: "jpeg" | "png"; name: string; url: string };

export const PdfEditorTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [sizes, setSizes] = useState<{ height: number; width: number }[]>([]);
	const [thumbs, setThumbs] = useState<string[]>([]);
	const [preview, setPreview] = useState("");
	const [scale, setScale] = useState(1);
	const [page, setPage] = useState(1);
	const [kind, setKind] = useState<EditKind>("text");
	const [font, setFont] = useState<EditFont>("helvetica");
	const [weight, setWeight] = useState<EditWeight>("regular");
	const [size, setSize] = useState("13");
	const [colour, setColour] = useState("#1b1b1b");
	const [background, setBackground] = useState<string | null>(null);
	const [picture, setPicture] = useState<Picture | null>(null);
	const [pictureWidth, setPictureWidth] = useState("30");
	const [pictureOpacity, setPictureOpacity] = useState("100");
	const [edits, setEdits] = useState<Mark[]>([]);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [hover, setHover] = useState<Spot | null>(null);
	const [drag, setDrag] = useState<{ index: number; dx: number; dy: number } | null>(null);
	const [resize, setResize] = useState<{ index: number; startX: number; startY: number; width: number; height: number } | null>(null);
	const [customName, setCustomName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; defaultName: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const alive = useRef(true);
	const pageRef = useRef<HTMLImageElement | null>(null);
	const draftRef = useRef<Draft | null>(null);
	const editsRef = useRef<Mark[]>([]);
	const picturesRef = useRef<string[]>([]);
	const fileName = result ? pdfFileName(customName, result.defaultName) : "";

	useEffect(
		() => () => {
			alive.current = false;
			for (const url of picturesRef.current) URL.revokeObjectURL(url);
		},
		[],
	);

	/** The list of marks, kept in a ref as well so a click can read what it has just committed. */
	const storeEdits = (next: (list: Mark[]) => Mark[]) => {
		const list = next(editsRef.current);
		editsRef.current = list;
		setEdits(list);
	};

	const openDraft = (next: Draft) => {
		draftRef.current = next;
		setDraft(next);
		setResult(null);
		setError("");
	};

	const closeDraft = () => {
		draftRef.current = null;
		setDraft(null);
	};

	const pageWidth = sizes[page - 1]?.width ?? 0;

	useEffect(() => {
		// The rendered page decides how big a point is on screen; onLoad misses a cached image.
		const width = pageRef.current?.clientWidth ?? 0;
		if (width && pageWidth) setScale(width / pageWidth);
	}, [preview, pageWidth]);

	const reset = () => {
		closeDraft();
		storeEdits(() => []);
		setResult(null);
		setError("");
		setThumbs([]);
		setPreview("");
		setPageCount(null);
		setSizes([]);
		setBytes(null);
		setPage(1);
		setHover(null);
		setDrag(null);
		setResize(null);
		setCustomName("");
	};

	/** The typed words and how they are set: size, weight, ink, and an optional background. */
	const wordsOnPage = (current: Draft): Mark => ({
		background,
		color: colour,
		font,
		kind: "text",
		page: current.page,
		size: Number(size),
		text: current.text.trim(),
		weight,
		x: current.x,
		y: current.y,
	});

	/** Turn the open box into a mark: nothing typed means nothing left behind. Returns the marks. */
	const commitDraft = (): Mark[] => {
		const current = draftRef.current;
		if (!current) return editsRef.current;
		closeDraft();
		if (!current.text.trim()) {
			// Re-opening a note and emptying it takes that note away.
			if (current.index !== null) storeEdits((list) => list.filter((_item, at) => at !== current.index));
			return editsRef.current;
		}
		const edit = wordsOnPage(current);
		storeEdits((list) => (current.index === null ? [...list, edit] : list.map((item, at) => (at === current.index ? edit : item))));
		setResult(null);
		return editsRef.current;
	};

	const changeDraft = (words: string) => {
		const current = draftRef.current;
		if (!current) return;
		const next = { ...current, text: words };
		draftRef.current = next;
		setDraft(next);
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
			const [info, boxes] = await Promise.all([readPdfInfo(source), pageSizes(source)]);
			if (!alive.current) return;
			setBytes(source);
			setPageCount(info.pageCount);
			setSizes(boxes);
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

	const choosePicture = async (chosen: File | null) => {
		if (!chosen) {
			setPicture(null);
			return;
		}
		const format = chosen.type === "image/jpeg" || /\.jpe?g$/iu.test(chosen.name) ? "jpeg" : chosen.type === "image/png" || /\.png$/iu.test(chosen.name) ? "png" : null;
		if (!format) {
			setError("A picture has to be a PNG or a JPEG — those are the two formats a PDF can hold.");
			return;
		}
		try {
			const source = await readFileBytes(chosen);
			const url = URL.createObjectURL(chosen);
			picturesRef.current.push(url);
			setPicture({ bytes: source, format, name: chosen.name, url });
			setKind("image");
			setError("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "That picture could not be read.");
		}
	};

	const selectPage = (pageNumber: number) => {
		commitDraft();
		setPage(pageNumber);
		setHover(null);
		setDrag(null);
		setResize(null);
		if (bytes) void showPage(bytes, pageNumber);
	};

	/** Clicking the page: words open a box right there, the rest drop their shape at once. */
	const addMark = (spot: Spot) => {
		if (kind === "text") {
			openDraft({ index: null, page, text: "", x: spot.x, y: spot.y });
			return;
		}
		commitDraft();
		setResult(null);
		setError("");
		if (kind === "image") {
			if (!picture) {
				setError("Choose a picture first — the Picture button takes a PNG or a JPEG.");
				return;
			}
			const width = Math.min(Math.max(Number(pictureWidth) / 100 || 0.3, 0.05), 1);
			const opacity = Math.min(Math.max(Number(pictureOpacity) / 100 || 1, 0.05), 1);
			const edit: Mark = { kind: "image", opacity, page, picture: { bytes: picture.bytes, format: picture.format }, preview: picture.url, width, x: spot.x, y: spot.y };
			storeEdits((current) => [...current, edit]);
			return;
		}
		storeEdits((current) => [...current, { kind, page, ...spot, ...EDIT_BOX_DEFAULT }]);
	};

	const place = (event: React.MouseEvent<HTMLImageElement>) => {
		addMark(clickFraction(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
	};

	const pageSpot = (clientX: number, clientY: number) => {
		const rect = pageRef.current?.getBoundingClientRect();
		return rect ? clickFraction(rect, clientX, clientY) : null;
	};

	const trackHover = (event: React.MouseEvent<HTMLImageElement>) => {
		setHover(clickFraction(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
	};

	const startDrag = (event: React.MouseEvent, index: number, edit: Mark) => {
		event.preventDefault();
		event.stopPropagation();
		const spot = pageSpot(event.clientX, event.clientY);
		if (!spot) return;
		setDrag({ dx: spot.x - edit.x, dy: spot.y - edit.y, index });
	};

	const startResize = (event: React.MouseEvent, index: number, edit: Mark) => {
		event.preventDefault();
		event.stopPropagation();
		const spot = pageSpot(event.clientX, event.clientY);
		if (!spot) return;
		setResize({ height: edit.height ?? EDIT_BOX_DEFAULT.height, index, startX: spot.x, startY: spot.y, width: edit.width ?? EDIT_BOX_DEFAULT.width });
	};

	const followPointer = (event: React.MouseEvent) => {
		if (drag) {
			const spot = pageSpot(event.clientX, event.clientY);
			if (!spot) return;
			storeEdits((list) => list.map((item, at) => (at === drag.index ? { ...item, x: clamp(spot.x - drag.dx), y: clamp(spot.y - drag.dy) } : item)));
			return;
		}
		if (resize) {
			const spot = pageSpot(event.clientX, event.clientY);
			if (!spot) return;
			const width = Math.min(Math.max(resize.width + (spot.x - resize.startX), 0.02), 1);
			const height = Math.min(Math.max(resize.height + (spot.y - resize.startY), 0.01), 1);
			storeEdits((list) => list.map((item, at) => (at === resize.index ? { ...item, height, width } : item)));
		}
	};

	const endPointer = () => {
		setDrag(null);
		setResize(null);
	};

	/** Clicking a note already on the page opens it again where it stands. */
	const editNote = (index: number, edit: Mark) => {
		if (drag) return;
		setKind("text");
		setColour(edit.color ?? "#1b1b1b");
		setBackground(edit.background ?? null);
		setFont(edit.font ?? "helvetica");
		setWeight(edit.weight ?? "regular");
		setSize(String(edit.size ?? 13));
		openDraft({ index, page: edit.page, text: edit.text ?? "", x: edit.x, y: edit.y });
	};

	const save = async () => {
		if (!file) return;
		const marks = commitDraft();
		if (!marks.length) {
			setError("Add a note, a highlight, a cover box, or a picture first.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const source = await readFileBytes(file);
			const out = await applyEdits(source, marks);
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
	const onScreenSize = (points: number) => Math.round(Math.min(44, Math.max(11, points * (pageWidth && scale ? scale : 1))));
	const typeSize = onScreenSize(Number(size));
	const editingHere = draft && draft.page === page ? draft : null;

	const markIcon = (edit: Mark) => (edit.kind === "text" ? <PenLine aria-hidden="true" size={11} /> : edit.kind === "highlight" ? <Highlighter aria-hidden="true" size={11} /> : edit.kind === "image" ? <ImageIcon aria-hidden="true" size={11} /> : <Eraser aria-hidden="true" size={11} />);

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Three steps: pick a mark, work on the page, save. Notes are typed straight onto the page, pictures are placed where you click, and every page underneath is copied through as it stands, so the document keeps its own fonts, links, and artwork."
				id="pdf-edit-file"
				label="PDF to edit"
				onFile={(chosen) => void chooseFile(chosen)}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					{thumbs.length ? (
						<section className="flex flex-col gap-2 border border-line bg-[#fbfaf7] p-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="m-0 text-xs font-semibold text-ink">
									Page {page} of {total}
								</p>
								<div className="flex items-center gap-1">
									<button aria-label="Previous page" className={`${buttonClassName} px-2`} disabled={page <= 1} onClick={() => selectPage(Math.max(1, page - 1))} type="button">
										<ArrowLeft aria-hidden="true" size={13} />
									</button>
									<button aria-label="Next page" className={`${buttonClassName} px-2`} disabled={page >= total} onClick={() => selectPage(Math.min(total, page + 1))} type="button">
										<ArrowRight aria-hidden="true" size={13} />
									</button>
								</div>
							</div>
							<ul className="m-0 flex list-none flex-wrap gap-2 p-0">
								{thumbs.map((thumb, index) => {
									const pageNumber = index + 1;
									return (
										<li key={pageNumber}>
											<button
												aria-label={`Go to page ${pageNumber}`}
												aria-pressed={page === pageNumber}
												className={`flex w-16 cursor-pointer flex-col items-center gap-1 border p-1 text-[11px] ${page === pageNumber ? "border-accent ring-2 ring-accent" : "border-line bg-white hover:border-[#5f6259]"}`}
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

					<section className="flex flex-col gap-3">
						<div className="flex items-baseline gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
								1
							</span>
							<h2 className="m-0 text-sm font-semibold text-ink">Choose a mark</h2>
						</div>
						<div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Add">
							{KINDS.map((entry) => {
								const Icon = entry.id === "text" ? PenLine : entry.id === "highlight" ? Highlighter : entry.id === "image" ? ImageIcon : Eraser;
								const chosen = kind === entry.id;
								return (
									<div className="flex flex-col gap-2" key={entry.id}>
										<button
											aria-pressed={chosen}
											className={`${choiceButtonClassName(chosen)} flex w-full items-center justify-start gap-2 px-3 py-2 text-left`}
											onClick={() => {
												commitDraft();
												setKind(entry.id);
												setError("");
											}}
											type="button"
										>
											<Icon aria-hidden="true" className="shrink-0" size={14} />
											<span className="text-xs font-semibold leading-none">{entry.label}</span>
										</button>
										<p className={`m-0 text-[11px] leading-snug ${chosen ? "text-ink" : "text-muted"}`}>{entry.blurb}</p>
									</div>
								);
							})}
						</div>
						{kind === "text" ? (
							<div className="grid gap-3 border border-line bg-[#fbfaf7] p-3 sm:grid-cols-2 lg:grid-cols-4">
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
									<label className={labelClassName} htmlFor="pdf-edit-weight">
										Weight
									</label>
									<select className={`${selectClassName} mt-1`} id="pdf-edit-weight" onChange={(event) => setWeight(event.target.value as EditWeight)} value={weight}>
										{WEIGHTS.map((item) => (
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
										Text colour
									</label>
									<input className="mt-1 h-9 w-full cursor-pointer border border-field bg-surface p-1" id="pdf-edit-colour" onChange={(event) => setColour(event.target.value)} type="color" value={colour} />
								</div>
								<div className="sm:col-span-2 lg:col-span-4">
									<span className={labelClassName}>Background</span>
									<div className="mt-1 flex flex-wrap items-center gap-2">
										{BACKGROUNDS.map((entry) => (
											<button aria-pressed={background === entry.value} className={choiceButtonClassName(background === entry.value)} key={entry.id} onClick={() => setBackground(entry.value)} type="button">
												{entry.label}
											</button>
										))}
										<input aria-label="Any other background colour" className="h-9 w-16 cursor-pointer border border-field bg-surface p-1" onChange={(event) => setBackground(event.target.value)} type="color" value={background ?? "#ffffff"} />
									</div>
									<p className={`${hintClassName} mt-1`}>{background ? "The words sit on a filled box, drawn behind them." : "No background: the words sit straight on the page."}</p>
								</div>
							</div>
						) : kind === "image" ? (
							<div className="grid gap-3 border border-line bg-[#fbfaf7] p-3 sm:grid-cols-2">
								<div className="sm:col-span-2">
									<FileField accept="image/png,image/jpeg" hint="A signature, a logo, or a photo. The picture is read in this tab and embedded in the saved PDF; nothing is uploaded." id="pdf-edit-picture" label="Picture to place" onFile={(chosen) => void choosePicture(chosen)} />
									{picture ? <p className={`${hintClassName} mt-2`}>{picture.name} is ready — click the page to place it.</p> : null}
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-edit-picture-width">
										Width on the page ({pictureWidth}%)
									</label>
									<input className="mt-2 w-full cursor-pointer" id="pdf-edit-picture-width" max={100} min={5} onChange={(event) => setPictureWidth(event.target.value)} type="range" value={pictureWidth} />
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-edit-picture-opacity">
										Strength ({pictureOpacity}%)
									</label>
									<input className="mt-2 w-full cursor-pointer" id="pdf-edit-picture-opacity" max={100} min={5} onChange={(event) => setPictureOpacity(event.target.value)} type="range" value={pictureOpacity} />
								</div>
							</div>
						) : (
							<p className={hintClassName}>{kind === "highlight" ? "The band is drawn see-through, so the words underneath stay readable." : "It hides what is there rather than removing it from the file — nothing in a PDF can be taken out this way."}</p>
						)}
					</section>

					<section className="flex flex-col gap-3">
						<div className="flex items-baseline gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
								2
							</span>
							<h2 className="m-0 text-sm font-semibold text-ink">Work on the page</h2>
						</div>
						<p className={hintClassName}>{instruction(kind)}</p>
						<div
							className="relative self-start border border-line bg-white shadow-sm"
							onMouseLeave={() => {
								endPointer();
								setHover(null);
							}}
							onMouseMove={followPointer}
							onMouseUp={endPointer}
						>
							{preview ? (
								// eslint-disable-next-line @next/next/no-img-element -- the rendered page you are marking up
								<img
									alt={`Page ${page} of ${file?.name ?? "the PDF"}`}
									aria-label={`Place a ${active.label.toLowerCase()} on page ${page}`}
									className={`block max-h-[560px] w-auto max-w-full select-none ${kind === "text" ? "cursor-text" : "cursor-crosshair"}`}
									draggable={false}
									onClick={place}
									onKeyDown={(event) => {
										if (event.key !== "Enter" && event.key !== " ") return;
										event.preventDefault();
										addMark({ x: 0.5, y: 0.5 });
									}}
									onLoad={(event) => {
										const width = event.currentTarget.clientWidth;
										if (width && pageWidth) setScale(width / pageWidth);
									}}
									onMouseMove={trackHover}
									ref={pageRef}
									role="button"
									src={preview}
									tabIndex={0}
								/>
							) : (
								<p className="m-0 p-6 text-xs text-muted">Rendering page {page}…</p>
							)}
							{hover && !editingHere && !drag ? (
								kind === "text" ? (
									<span aria-hidden="true" className="pointer-events-none absolute z-10 block max-w-[70%] truncate rounded-sm border border-dashed border-accent px-1 text-muted" style={{ background: background ?? "transparent", fontSize: `${Math.min(typeSize, 18)}px`, left: `${hover.x * 100}%`, top: `${hover.y * 100}%`, transform: "translateY(-0.8em)" }}>
										Type here
									</span>
								) : (
									<span
										aria-hidden="true"
										className={`pointer-events-none absolute z-10 block ${kind === "highlight" ? "bg-[#f5d76e]/50 ring-1 ring-[#d9b53e]" : kind === "image" ? "border border-dashed border-accent bg-accent/10" : "border border-dashed border-[#b64b31] bg-white/70"}`}
										style={{ height: `${EDIT_BOX_DEFAULT.height * 100}%`, left: `${hover.x * 100}%`, top: `${hover.y * 100}%`, width: `${(kind === "image" ? Number(pictureWidth) / 100 || 0.3 : EDIT_BOX_DEFAULT.width) * 100}%` }}
									/>
								)
							) : null}

							{onThisPage.map(({ edit, index }) => {
								const placeAt = { left: `${edit.x * 100}%`, top: `${edit.y * 100}%` };
								if (edit.kind === "text") {
									if (draft?.index === index && editingHere) return null;
									return (
										<button
											aria-label={`Edit ${describeEdit(edit)}`}
											className={`absolute z-10 max-w-[70%] cursor-text truncate rounded-sm border border-transparent text-left leading-tight hover:border-accent ${edit.background ? "px-1" : ""}`}
											key={`note-${index}`}
											onClick={() => editNote(index, edit)}
											onMouseDown={(event) => startDrag(event, index, edit)}
											style={{ ...placeAt, background: edit.background ?? "transparent", color: edit.color ?? "#1b1b1b", fontSize: `${onScreenSize(edit.size ?? 13)}px`, fontWeight: edit.weight === "bold" ? 700 : 400, transform: "translateY(-0.8em)" }}
											type="button"
										>
											{edit.text}
										</button>
									);
								}
								if (edit.kind === "image") {
									return (
										<span className="absolute z-10 cursor-move" key={`picture-${index}`} onMouseDown={(event) => startDrag(event, index, edit)} style={{ ...placeAt, width: `${(edit.width ?? 0.3) * 100}%` }}>
											{edit.preview ? (
												// eslint-disable-next-line @next/next/no-img-element -- the picture as it will be placed
												<img alt="" aria-hidden="true" className="pointer-events-none block w-full select-none" draggable={false} src={edit.preview} style={{ opacity: edit.opacity ?? 1 }} />
											) : (
												<span aria-hidden="true" className="block h-10 w-full border border-dashed border-accent bg-accent/10" />
											)}
										</span>
									);
								}
								return (
									<span
										aria-hidden="true"
										className={`absolute z-10 cursor-move ${edit.kind === "highlight" ? "bg-[#f5d76e]/60 ring-1 ring-[#d9b53e]/70" : "border border-dashed border-[#b64b31] bg-white"}`}
										key={`shape-${index}`}
										onMouseDown={(event) => startDrag(event, index, edit)}
										style={{ ...placeAt, height: `${(edit.height ?? EDIT_BOX_DEFAULT.height) * 100}%`, width: `${(edit.width ?? EDIT_BOX_DEFAULT.width) * 100}%` }}
									>
										<span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-nwse-resize border border-white bg-accent" data-handle="resize" onMouseDown={(event) => startResize(event, index, edit)} />
									</span>
								);
							})}

							{editingHere ? (
								<input
									aria-label="Type on the page"
									autoFocus
									className="absolute z-20 min-w-40 rounded-sm border border-dashed border-accent px-1 py-0.5 shadow-sm outline-none placeholder:text-muted"
									onBlur={commitDraft}
									onChange={(event) => changeDraft(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											commitDraft();
										}
										if (event.key === "Escape") {
											event.preventDefault();
											closeDraft();
										}
									}}
									placeholder="Type here"
									style={{ background: background ?? "transparent", color: colour, fontSize: `${typeSize}px`, fontWeight: weight === "bold" ? 700 : 400, left: `${editingHere.x * 100}%`, maxWidth: `${Math.max(16, Math.round((1 - editingHere.x) * 100))}%`, top: `${editingHere.y * 100}%`, transform: "translateY(-0.8em)" }}
									type="text"
									value={editingHere.text}
								/>
							) : null}
						</div>
						{onThisPage.length ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs text-muted">On this page:</span>
								{onThisPage.map(({ edit, index }) => (
									<span className="inline-flex items-center gap-1 border border-line bg-[#fbfaf7] py-1 pl-2 pr-1 text-[11px] text-ink" key={`chip-${index}`}>
										{markIcon(edit)}
										{describeEdit(edit).replace(` on page ${edit.page}`, "")}
										<button aria-label={`Remove ${describeEdit(edit)} from the page`} className="cursor-pointer border-0 bg-transparent p-0 text-[#8a3f30] hover:underline" onClick={() => storeEdits((current) => current.filter((_item, at) => at !== index))} type="button">
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
						<div className="flex items-baseline gap-2">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white" aria-hidden="true">
								3
							</span>
							<h2 className="m-0 text-sm font-semibold text-ink">Save</h2>
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
										{markIcon(edit)}
										<span className="min-w-0 flex-1 text-xs text-ink">{describeEdit(edit)}</span>
										{edit.kind === "image" ? (
											<input
												aria-label={`Width of the picture on page ${edit.page}`}
												className="w-24 cursor-pointer"
												max={100}
												min={5}
												onChange={(event) => storeEdits((list) => list.map((item, at) => (at === index ? { ...item, width: Number(event.target.value) / 100 } : item)))}
												type="range"
												value={Math.round((edit.width ?? 0.3) * 100)}
											/>
										) : null}
										{edit.kind === "text" ? (
											<button className={buttonClassName} onClick={() => editNote(index, edit)} type="button">
												Edit
											</button>
										) : null}
										{edit.page !== page ? (
											<button className={buttonClassName} onClick={() => selectPage(edit.page)} type="button">
												Show
											</button>
										) : null}
										<button aria-label={`Remove ${describeEdit(edit)}`} className={`${buttonClassName} px-2`} onClick={() => storeEdits((current) => current.filter((_item, at) => at !== index))} type="button">
											<Trash2 aria-hidden="true" size={13} />
										</button>
									</li>
								))}
							</ul>
						) : null}
						<div className="flex flex-wrap items-center gap-2">
							<button className={primaryButtonClassName} disabled={busy || (!edits.length && !draft)} onClick={() => void save()} onMouseDown={commitDraft} type="button">
								{busy ? "Saving…" : "Save the edited PDF"}
							</button>
							<button className={buttonClassName} disabled={!edits.length} onClick={() => storeEdits((current) => current.slice(0, -1))} type="button">
								<Undo2 aria-hidden="true" size={13} /> Undo last
							</button>
							<button className={buttonClassName} disabled={!edits.length} onClick={() => storeEdits(() => [])} type="button">
								Clear all marks
							</button>
						</div>
						<p className={hintClassName}>
							{edits.length
								? `${edits.length} mark${edits.length === 1 ? "" : "s"} ready. The finished file keeps every page exactly as it was, with your marks drawn on top.`
								: "Nothing to save yet — the button comes alive once there is at least one mark."}
						</p>
					</section>
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
