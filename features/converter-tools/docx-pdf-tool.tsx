"use client";

import { useRef, useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { rasterPagesToPdf, type RasterPage } from "@/features/converter-tools/word-pdf-visual";
import { docxToPdfTextOnly } from "@/features/converter-tools/word-pdf";

type PageSize = "a4" | "letter";
type PdfMode = "visual" | "text";
type Output = { blob: Blob; mode: PdfMode; name: string; pageCount: number; wordCount?: number };

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_CAPTURE_PIXELS = 10_000_000;
const MAX_CAPTURE_SCALE = 3;
const ACCEPT = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const waitForImagesAndFonts = async (root: HTMLElement) => {
	await Promise.all(Array.from(root.querySelectorAll("img"), (image) => image.decode?.().catch(() => undefined) ?? Promise.resolve()));
	await document.fonts?.ready;
};

const canvasPng = (canvas: HTMLCanvasElement) =>
	new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The browser could not capture a rendered page."))), "image/png");
	});

export const DocxPdfTool = () => {
	const renderRef = useRef<HTMLDivElement>(null);
	const stylesRef = useRef<HTMLDivElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [mode, setMode] = useState<PdfMode>("visual");
	const [pageSize, setPageSize] = useState<PageSize>("a4");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState("");
	const [output, setOutput] = useState<Output | null>(null);
	const url = useObjectUrl(output?.blob ?? null);

	const convert = async (chosen: File, selectedMode: PdfMode, size: PageSize) => {
		setBusy(true);
		setError("");
		setProgress("");
		setOutput(null);
		setFile(chosen);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the Word file under 30 MB.");
			const bytes = new Uint8Array(await chosen.arrayBuffer());
			const base = chosen.name.replace(/\.docx$/iu, "") || "document";
			if (selectedMode === "text") {
				const result = await docxToPdfTextOnly(bytes, { pageSize: size });
				setOutput({ blob: new Blob([result.bytes.slice().buffer], { type: "application/pdf" }), mode: selectedMode, name: `${base}.pdf`, pageCount: result.pageCount, wordCount: result.wordCount });
				return;
			}

			if (!renderRef.current || !stylesRef.current) throw new Error("The page preview could not be initialized. Refresh the page and try again.");
			// Let React reveal the page container after switching from the text-only mode.
			await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
			const { renderAsync } = await import("docx-preview");
			const html2canvas = (await import("html2canvas")).default;
			renderRef.current.replaceChildren();
			stylesRef.current.replaceChildren();
			await renderAsync(bytes.slice().buffer, renderRef.current, stylesRef.current, {
				breakPages: true,
				className: "docx",
				ignoreFonts: false,
				ignoreHeight: false,
				ignoreLastRenderedPageBreak: false,
				ignoreWidth: false,
				renderEndnotes: true,
				renderFooters: true,
				renderFootnotes: true,
				renderHeaders: true,
				useBase64URL: true,
			});
			await waitForImagesAndFonts(renderRef.current);
			const pages = Array.from(renderRef.current.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx"));
			if (!pages.length) throw new Error("The Word file did not contain any pages the browser could render.");
			if (pages.length > MAX_PAGES) throw new Error(`This document has ${pages.length} pages. Split it into files of ${MAX_PAGES} pages or fewer to keep rendering within browser memory limits.`);

			async function* capturePages(): AsyncGenerator<RasterPage> {
				for (const [index, page] of pages.entries()) {
					setProgress(`Capturing page ${index + 1} of ${pages.length}…`);
					const bounds = page.getBoundingClientRect();
					if (bounds.width <= 0 || bounds.height <= 0) throw new Error("A Word page has no visible size. Switch back to Visual layout and try again.");
					const scale = Math.min(MAX_CAPTURE_SCALE, Math.sqrt(MAX_CAPTURE_PIXELS / (bounds.width * bounds.height)));
					const canvas = await html2canvas(page, {
						allowTaint: false,
						backgroundColor: "#ffffff",
						logging: false,
						onclone: (clonedDocument) => {
							const preview = clonedDocument.getElementById("docx-render-preview");
							if (preview) {
								preview.style.height = "auto";
								preview.style.maxHeight = "none";
								preview.style.overflow = "visible";
							}
							// Convert Word's calculated line spacing to resolved browser pixel values
							// before html2canvas rasterizes it. This avoids losing calc/point-based
							// line heights in the PDF while keeping the browser-rendered spacing.
							const clonedPage = clonedDocument.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")[index];
							if (!clonedPage) return;
							const sourceParagraphs = page.querySelectorAll<HTMLElement>("p");
						const clonedParagraphs = clonedPage.querySelectorAll<HTMLElement>("p");
						for (const [paragraphIndex, sourceParagraph] of sourceParagraphs.entries()) {
							const resolvedLineHeight = window.getComputedStyle(sourceParagraph).lineHeight;
							const clonedParagraph = clonedParagraphs[paragraphIndex];
							if (clonedParagraph && resolvedLineHeight && resolvedLineHeight !== "normal") {
								clonedParagraph.style.lineHeight = resolvedLineHeight;
							}
							}
						},
						scale,
						useCORS: true,
						width: Math.ceil(bounds.width),
						height: Math.ceil(bounds.height),
					});
					const png = await canvasPng(canvas);
					canvas.width = 0;
					canvas.height = 0;
					yield { height: bounds.height, png: new Uint8Array(await png.arrayBuffer()), width: bounds.width };
				}
			}

			const result = await rasterPagesToPdf(capturePages());
			setOutput({ blob: new Blob([result.bytes.slice().buffer], { type: "application/pdf" }), mode: selectedMode, name: `${base}.pdf`, pageCount: result.pageCount });
			setProgress("Visual PDF ready.");
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/not a zip|central directory|not a Word document|invalid.*docx/iu.test(message)) setError("That file could not be opened as a Word document. Only .docx files work — the older .doc format does not.");
			else if (/no text/iu.test(message)) setError("This document has no text to convert. Choose Visual layout if it contains pictures or other non-text content.");
			else setError(message || "This document could not be converted.");
		} finally {
			setBusy(false);
		}
	};

	const chooseMode = (next: PdfMode) => {
		setMode(next);
		if (file) void convert(file, next, pageSize);
	};

	return (
		<ToolPanel>
			<SegmentedControl<PdfMode>
				label="PDF type"
				onChange={chooseMode}
				options={[
					{ id: "visual", label: "Visual layout" },
					{ id: "text", label: "Selectable text" },
				]}
				value={mode}
			/>
			<FileField
				accept={ACCEPT}
				disabled={busy}
				hint={mode === "visual"
					? "Renders the Word pages in this browser before making the PDF, including page styling and embedded pictures. This best-match layout is not Microsoft Word itself; fonts available in this browser and unsupported Word features can differ."
					: "Text-only reconstruction: text stays selectable and searchable, but layout, fonts, images, headers, footers, and many Word features are not preserved."}
				id="docx-pdf-file"
				label="Word document (.docx)"
				onFile={(chosen) => {
					if (chosen) void convert(chosen, mode, pageSize);
					else {
						setFile(null);
						setOutput(null);
						setProgress("");
						setError("");
						renderRef.current?.replaceChildren();
						stylesRef.current?.replaceChildren();
					}
				}}
			/>
			{mode === "text" ? (
				<SegmentedControl<PageSize>
					label="Page size for text-only PDF"
					onChange={(next) => {
						setPageSize(next);
						if (file) void convert(file, mode, next);
					}}
					options={[
						{ id: "a4", label: "A4" },
						{ id: "letter", label: "Letter" },
					]}
					value={pageSize}
				/>
			) : null}
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName} role="status">{progress || (mode === "visual" ? "Rendering Word pages…" : "Rebuilding selectable text…")}</p> : null}
			{mode === "visual" ? (
				<section aria-label="Rendered Word preview" className="max-h-[480px] overflow-auto border border-line bg-[#eeede7]" id="docx-render-preview">
					<div ref={stylesRef} />
					<div ref={renderRef} />
				</section>
			) : null}
			{output && url ? (
				<>
					<StatGrid
						items={[
							{ label: "Pages", value: String(output.pageCount) },
							...(output.wordCount === undefined ? [] : [{ label: "Words", value: output.wordCount.toLocaleString() }]),
							{ label: "PDF size", value: describeBytes(output.blob.size) },
							{ label: "Output", value: output.mode === "visual" ? "High-resolution visual pages" : "Selectable text" },
						]}
					/>
					<div className="flex flex-wrap items-center gap-2">
						<FileDownloadLink fileName={output.name} label={`Download ${output.name}`} url={url} />
						<button className={buttonClassName} onClick={() => setOutput(null)} type="button">Clear</button>
					</div>
					<p className={hintClassName}>
						{output.mode === "visual"
							? "Visual layout keeps the browser-rendered page appearance, including pictures. PDF pages are images, so their text is not selectable or searchable; exact Word rendering still depends on the fonts and features your browser supports."
							: "This text-only PDF is searchable, but it does not preserve the Word page layout, fonts, or pictures."}
					</p>
				</>
			) : null}
			{progress && !busy ? <p className={hintClassName} role="status">{progress}</p> : null}
			<button className={primaryButtonClassName} disabled={!file || busy} onClick={() => file && void convert(file, mode, pageSize)} type="button">
				{busy ? "Converting…" : "Convert again"}
			</button>
		</ToolPanel>
	);
};
