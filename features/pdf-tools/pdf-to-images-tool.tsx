"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { createZip } from "@/features/image-tools/zip-utils";
import { readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { renderPageImages } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, formatPageList, pageWord, parsePageRange, pdfBaseName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Format = "image/png" | "image/jpeg" | "image/webp";

const FORMATS: { id: Format; label: string; extension: string }[] = [
	{ id: "image/png", label: "PNG", extension: "png" },
	{ id: "image/jpeg", label: "JPEG", extension: "jpg" },
	{ id: "image/webp", label: "WebP", extension: "webp" },
];

const SCALES = [
	{ value: "1", label: "Screen — 72 dpi" },
	{ value: "1.5", label: "Sharp — 108 dpi" },
	{ value: "2", label: "Print — 144 dpi" },
	{ value: "3", label: "Large print — 216 dpi" },
];

export const PdfToImagesTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [format, setFormat] = useState<Format>("image/png");
	const [scale, setScale] = useState("2");
	const [quality, setQuality] = useState("0.92");
	const [range, setRange] = useState("");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const [images, setImages] = useState<{ page: number; name: string; blob: Blob; url: string }[]>([]);
	const imagesRef = useRef<{ page: number; name: string; blob: Blob; url: string }[]>([]);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const releaseImages = () => {
		for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
		imagesRef.current = [];
		setImages([]);
	};

	useEffect(() => {
		imagesRef.current = images;
	}, [images]);

	useEffect(
		() => () => {
			for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
		},
		[],
	);

	const selected = (): number[] | string => {
		if (!pageCount) return "Choose a PDF first.";
		if (!range.trim()) return Array.from({ length: pageCount }, (_, index) => index + 1);
		try {
			return parsePageRange(range, pageCount);
		} catch (caught) {
			return caught instanceof Error ? caught.message : "That page range could not be read.";
		}
	};

	const chooseFile = async (chosen: File | null) => {
		setResult(null);
		releaseImages();
		setError("");
		setPageCount(null);
		setFile(chosen);
		setRange("");
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

	const convert = async () => {
		if (!file) return;
		const pages = selected();
		if (typeof pages === "string") {
			setError(pages);
			return;
		}
		const preset = FORMATS.find((item) => item.id === format) ?? FORMATS[0];
		setBusy(true);
		setError("");
		setResult(null);
		releaseImages();
		setProgress({ done: 0, total: pages.length });
		try {
			const bytes = await readFileBytes(file);
			const base = pdfBaseName(file.name);
			const drawn = await renderPageImages(bytes, pages, {
				scale: Number(scale),
				quality: format === "image/png" ? undefined : Number(quality),
				type: format,
			});
			const made: { page: number; name: string; blob: Blob; url: string }[] = [];
			const packed: { name: string; data: Uint8Array }[] = [];
			for (const { page, blob } of drawn) {
				const name = `${base}-page-${page}.${preset.extension}`;
				made.push({ page, name, blob, url: URL.createObjectURL(blob) });
				packed.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
				setProgress({ done: made.length, total: pages.length });
			}
			setImages(made);
			if (packed.length === 1) {
				setResult({ blob: new Blob([packed[0].data.slice().buffer], { type: format }), name: packed[0].name, note: formatPageList(pages) });
			} else {
				const zip = await createZip(packed, { compress: false });
				setResult({ blob: new Blob([zip.slice().buffer], { type: "application/zip" }), name: `${base}-images.zip`, note: `${packed.length} ${preset.label} images` });
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These pages could not be turned into images.");
		} finally {
			setBusy(false);
		}
	};

	const pages = pageCount === null ? null : selected();
	const outputSize = result ? describeBytes(result.blob.size) : "";

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Each page is drawn with its own embedded fonts and vector art, so the result matches the original exactly."
				id="pdf-to-images-file"
				label="PDF to convert"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClassName} htmlFor="pdf-to-images-format">
								Image format
							</label>
							<select
								className={`${selectClassName} mt-2`}
								id="pdf-to-images-format"
								onChange={(event) => {
									setFormat(event.target.value as Format);
									setResult(null);
								}}
								value={format}
							>
								{FORMATS.map((item) => (
									<option key={item.id} value={item.id}>
										{item.label}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClassName} htmlFor="pdf-to-images-scale">
								Size
							</label>
							<select className={`${selectClassName} mt-2`} id="pdf-to-images-scale" onChange={(event) => setScale(event.target.value)} value={scale}>
								{SCALES.map((item) => (
									<option key={item.value} value={item.value}>
										{item.label}
									</option>
								))}
							</select>
						</div>
						{format === "image/png" ? null : (
							<div>
								<label className={labelClassName} htmlFor="pdf-to-images-quality">
									Quality
								</label>
								<select className={`${selectClassName} mt-2`} id="pdf-to-images-quality" onChange={(event) => setQuality(event.target.value)} value={quality}>
									<option value="0.98">Maximum — larger files</option>
									<option value="0.92">Balanced</option>
									<option value="0.8">Smaller files</option>
								</select>
							</div>
						)}
					</div>
					<div>
						<label className={labelClassName} htmlFor="pdf-to-images-range">
							Pages
						</label>
						<input
							className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							id="pdf-to-images-range"
							onChange={(event) => {
								setRange(event.target.value);
								setResult(null);
							}}
							placeholder={`All ${pageWord(pageCount)}`}
							spellCheck={false}
							type="text"
							value={range}
						/>
						<p className={`${hintClassName} mt-2`}>Leave empty for every page, or type ranges such as 1-3, 7.</p>
					</div>
					<StatGrid
						items={[
							{ label: "Pages in PDF", value: String(pageCount) },
							{ label: "To convert", value: pages === null || typeof pages === "string" ? "—" : String(pages.length) },
							{ label: "Format", value: FORMATS.find((item) => item.id === format)?.label ?? "PNG" },
							{ label: "Size", value: result ? outputSize : "—" },
						]}
					/>
					{pages !== null && typeof pages === "string" ? <ErrorNote message={pages} /> : null}
					<button className={primaryButtonClassName} disabled={busy || pages === null || typeof pages === "string" || pages.length === 0} onClick={convert} type="button">
						{busy ? `Drawing ${progress.done} of ${progress.total}…` : "Convert pages to images"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">
						{result.note}
						{images.length > 1 ? " — each page can also be saved on its own below." : ""}
					</p>
				</div>
			) : null}
			{images.length ? (
				<div>
					<h2 className="m-0 text-sm font-semibold">Each page as an image</h2>
					<ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 p-0">
						{images.map((image) => (
							<li className="flex flex-col gap-2 border border-line bg-[#fbfaf7] p-2" key={image.page}>
								<span className="flex min-h-24 items-center justify-center bg-white">
									{/* eslint-disable-next-line @next/next/no-img-element -- the converted page itself */}
									<img alt={`Preview of page ${image.page}`} className="max-h-24 w-auto" src={image.url} />
								</span>
								<p className="m-0 text-center text-[11px] font-semibold text-[#3c3d37]">Page {image.page}</p>
								<FileDownloadLink fileName={image.name} label={`Download page ${image.page}`} url={image.url} />
							</li>
						))}
					</ul>
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
