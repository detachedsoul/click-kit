"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { readFileBytes, readPdfInfo, rewritePages } from "@/features/pdf-tools/pdf-engine";
import { renderPageThumbnail } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Page = { source: number; turn: number; removed: boolean; thumb: string };

export const MAX_PREVIEWS = 60;

/** Moves one page to a new position, leaving the rest in order. */
export const movePage = <T,>(list: T[], from: number, to: number): T[] => {
	if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
	const next = [...list];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
};

const degreesLabel = (turn: number) => `${((turn % 360) + 360) % 360}°`;

export const PdfOrganiseTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pages, setPages] = useState<Page[]>([]);
	const [previews, setPreviews] = useState(0);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [dragging, setDragging] = useState<number | null>(null);
	const [over, setOver] = useState<number | null>(null);
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const alive = useRef(true);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	useEffect(
		() => () => {
			alive.current = false;
		},
		[],
	);

	const kept = pages.filter((page) => !page.removed);

	const chooseFile = async (chosen: File | null) => {
		setResult(null);
		setError("");
		setPages([]);
		setPreviews(0);
		setFile(chosen);
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) {
			setError(problem);
			return;
		}
		try {
			const bytes = await readFileBytes(chosen);
			const info = await readPdfInfo(bytes);
			const loaded: Page[] = Array.from({ length: info.pageCount }, (_, index) => ({ source: index + 1, turn: 0, removed: false, thumb: "" }));
			setPages(loaded);
			for (const page of loaded.slice(0, MAX_PREVIEWS)) {
				try {
					const thumb = await renderPageThumbnail(bytes, page.source, 160);
					if (!alive.current) return;
					setPages((current) => current.map((item) => (item.source === page.source ? { ...item, thumb } : item)));
					setPreviews((count) => count + 1);
				} catch {
					// A page that will not draw still has working controls.
					if (!alive.current) return;
					setPreviews((count) => count + 1);
				}
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be read.");
		}
	};

	const update = useCallback((source: number, change: Partial<Page>) => {
		setResult(null);
		setPages((current) => current.map((page) => (page.source === source ? { ...page, ...change } : page)));
	}, []);

	const move = (index: number, direction: -1 | 1) => {
		setResult(null);
		setPages((current) => {
			const target = index + direction;
			if (target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	};

	/** Drop a dragged card on another to put the page there. */
	const dropAt = (target: number) => {
		if (dragging === null) return;
		setResult(null);
		setPages((current) => movePage(current, dragging, target));
		setDragging(null);
		setOver(null);
	};

	const rotateAll = (turn: number) => {
		setResult(null);
		setPages((current) => current.map((page) => (page.removed ? page : { ...page, turn: page.turn + turn })));
	};

	const apply = async () => {
		if (!file || kept.length === 0) return;
		setBusy(true);
		setError("");
		try {
			const bytes = await readFileBytes(file);
			const rotate: Record<number, number> = {};
			for (const page of kept) if (page.turn) rotate[page.source] = ((page.turn % 360) + 360) % 360;
			const out = await rewritePages(bytes, { keep: kept.map((page) => page.source), rotate });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "arranged"),
				note: `${pageWord(kept.length)} kept${pages.length - kept.length > 0 ? `, ${pages.length - kept.length} removed` : ""}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This PDF could not be rearranged.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Drag a page card to a new place, or use the arrow buttons. Rotate and remove as you like: nothing is redrawn — the pages themselves are copied over."
				id="pdf-organise-file"
				label="PDF to arrange"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pages.length > 0 ? (
				<>
					<StatGrid
						items={[
							{ label: "Pages", value: String(pages.length) },
							{ label: "Keeping", value: String(kept.length) },
							{ label: "Previews", value: pages.length > MAX_PREVIEWS ? `${previews}/${MAX_PREVIEWS}` : `${previews}/${pages.length}` },
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<div className="flex flex-wrap gap-2">
						<button className={buttonClassName} onClick={() => rotateAll(-90)} type="button">
							<RotateCcw aria-hidden="true" size={14} /> Rotate all left
						</button>
						<button className={buttonClassName} onClick={() => rotateAll(90)} type="button">
							<RotateCw aria-hidden="true" size={14} /> Rotate all right
						</button>
						<button
							className={buttonClassName}
							onClick={() => {
								setResult(null);
								setPages((current) => current.map((page) => ({ ...page, removed: false })));
							}}
							type="button"
						>
							<Undo2 aria-hidden="true" size={14} /> Restore removed
						</button>
					</div>
					<ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
						{pages.map((page, index) => (
							<li
								className={`border bg-[#fbfaf7] p-2 ${
									dragging === index ? "border-accent opacity-60" : over === index ? "border-accent ring-2 ring-accent" : "border-line"
								} ${page.removed ? "opacity-50" : ""}`}
								draggable={!busy}
								key={page.source}
								onDragEnd={() => {
									setDragging(null);
									setOver(null);
								}}
								onDragOver={(event) => {
									event.preventDefault();
									if (dragging !== null && dragging !== index) setOver(index);
								}}
								onDragStart={(event) => {
									setDragging(index);
									setOver(null);
									// Firefox needs some data on the drag to start at all.
									event.dataTransfer?.setData("text/plain", String(index));
									if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
								}}
								onDrop={(event) => {
									event.preventDefault();
									dropAt(index);
								}}
							>
								<div className="flex min-h-40 items-center justify-center bg-white">
									{page.thumb ? (
										// eslint-disable-next-line @next/next/no-img-element -- a rendered preview, not a layout image
										<img alt={`Page ${page.source}${page.turn ? `, turned ${degreesLabel(page.turn)}` : ""}`} className="max-h-40 w-auto" src={page.thumb} style={{ transform: `rotate(${page.turn}deg)` }} />
									) : (
										<p className="m-0 text-[11px] text-muted">{index < MAX_PREVIEWS ? "Rendering…" : "No preview"}</p>
									)}
								</div>
								<p className="m-0 mt-2 flex cursor-grab items-center gap-1 text-[11px] font-semibold text-[#3c3d37]" title="Drag this card to move the page">
									<GripVertical aria-hidden="true" size={12} />
									Page {page.source}
									{page.turn ? ` · ${degreesLabel(page.turn)}` : ""}
									{page.removed ? " · removed" : ""}
								</p>
								<div className="mt-1 flex flex-wrap gap-1">
									<button aria-label={`Move page ${page.source} left`} className={buttonClassName} disabled={index === 0} onClick={() => move(index, -1)} type="button">
										<ChevronLeft aria-hidden="true" size={14} />
									</button>
									<button aria-label={`Move page ${page.source} right`} className={buttonClassName} disabled={index === pages.length - 1} onClick={() => move(index, 1)} type="button">
										<ChevronRight aria-hidden="true" size={14} />
									</button>
									<button aria-label={`Rotate page ${page.source}`} className={buttonClassName} onClick={() => update(page.source, { turn: page.turn + 90 })} type="button">
										<RotateCw aria-hidden="true" size={14} />
									</button>
									<button
										aria-label={page.removed ? `Keep page ${page.source}` : `Remove page ${page.source}`}
										className={buttonClassName}
										onClick={() => update(page.source, { removed: !page.removed })}
										type="button"
									>
										{page.removed ? <Undo2 aria-hidden="true" size={14} /> : <Trash2 aria-hidden="true" size={14} />}
									</button>
								</div>
							</li>
						))}
					</ul>
					<p className={hintClassName}>
						Drag cards to reorder, or use the arrows; page order here is the order in the saved file. {pages.length > MAX_PREVIEWS ? `Only the first ${MAX_PREVIEWS} pages get a preview; every page can still be moved, turned, or removed.` : ""}
					</p>
					<button className={primaryButtonClassName} disabled={busy || kept.length === 0} onClick={apply} type="button">
						{busy ? "Saving…" : "Save rearranged PDF"}
					</button>
					{result ? (
						<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
							<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
							<p className="m-0 text-xs text-muted">{result.note}</p>
						</div>
					) : null}
					{kept.length === 0 ? <ErrorNote message="Keep at least one page." /> : null}
					<button className={buttonClassName} onClick={() => chooseFile(null)} type="button">
						Choose another PDF
					</button>
				</>
			) : null}
		</ToolPanel>
	);
};
