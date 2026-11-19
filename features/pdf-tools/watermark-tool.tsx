"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { MAX_IMAGE_BYTES, toEmbeddable, type EmbeddableImage } from "@/features/pdf-tools/image-embed";
import { addImageWatermark, addWatermark, readFileBytes, readPdfInfo } from "@/features/pdf-tools/pdf-engine";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

type Style = "single" | "tiled";
type Stamp = "text" | "image";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif";

const LOGO_SIZES = [
	{ value: "0.15", label: "Small — 15% of the width" },
	{ value: "0.3", label: "Medium — 30%" },
	{ value: "0.5", label: "Large — 50%" },
	{ value: "0.8", label: "Most of the page — 80%" },
];

const LOGO_OPACITIES = [
	{ value: "0.1", label: "Faint" },
	{ value: "0.3", label: "Subtle" },
	{ value: "0.6", label: "Clear" },
	{ value: "1", label: "Solid" },
];

const COLOURS = [
	{ id: "grey", label: "Grey" },
	{ id: "red", label: "Red" },
	{ id: "blue", label: "Blue" },
] as const;

const OPACITIES = [
	{ value: "0.08", label: "Barely there" },
	{ value: "0.16", label: "Subtle" },
	{ value: "0.3", label: "Strong" },
	{ value: "0.5", label: "Very strong" },
];

export const PdfWatermarkTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [text, setText] = useState("DRAFT");
	const [style, setStyle] = useState<Style>("single");
	const [colour, setColour] = useState<"grey" | "red" | "blue">("grey");
	const [opacity, setOpacity] = useState("0.16");
	const [mode, setMode] = useState<Stamp>("text");
	const [logo, setLogo] = useState<{ image: EmbeddableImage; name: string; size: number } | null>(null);
	const [logoSize, setLogoSize] = useState("0.3");
	const [logoOpacity, setLogoOpacity] = useState("0.3");
	const logoUrl = useObjectUrl(logo ? new Blob([logo.image.bytes.slice().buffer], { type: logo.image.type }) : null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const chooseLogo = async (chosen: File | null) => {
		setResult(null);
		setError("");
		if (!chosen) {
			setLogo(null);
			return;
		}
		if (!chosen.type.startsWith("image/")) {
			setError("Choose a PNG, JPEG, WebP, or GIF picture.");
			return;
		}
		if (chosen.size > MAX_IMAGE_BYTES) {
			setError("Keep the logo under 25 MB.");
			return;
		}
		try {
			const image = await toEmbeddable(chosen);
			setLogo({ image, name: chosen.name, size: chosen.size });
		} catch (caught) {
			setLogo(null);
			setError(caught instanceof Error ? caught.message : "That picture could not be read.");
		}
	};

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

	const stamp = async () => {
		if (!file) return;
		if (mode === "image") {
			if (!logo) {
				setError("Choose a picture to stamp with.");
				return;
			}
			setBusy(true);
			setError("");
			setResult(null);
			try {
				const out = await addImageWatermark(await readFileBytes(file), {
					image: logo.image,
					widthRatio: Number(logoSize),
					opacity: Number(logoOpacity),
				});
				setResult({
					blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
					name: pdfOutputName(file.name, "stamped"),
					note: `${logo.name} on ${pageWord(pageCount ?? 0)}`,
				});
			} catch (caught) {
				setError(caught instanceof Error ? caught.message : "This PDF could not be stamped.");
			} finally {
				setBusy(false);
			}
			return;
		}
		if (!text.trim()) {
			setError("Type the words to stamp on the pages.");
			return;
		}
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const out = await addWatermark(await readFileBytes(file), {
				text,
				opacity: Number(opacity),
				color: colour,
				tiled: style === "tiled",
			});
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "stamped"),
				note: `“${text.trim()}” on ${pageWord(pageCount ?? 0)}`,
			});
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			setError(/WinAnsi|encode/iu.test(message) ? "The built-in stamp font only covers Latin letters, digits, and common punctuation. Try shorter wording." : message || "This PDF could not be stamped.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="The stamp goes on in its own layer, so the pages underneath keep their own fonts, images, and links."
				id="pdf-watermark-file"
				label="PDF to stamp"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{pageCount !== null ? (
				<>
					<SegmentedControl<Stamp>
						label="Stamp with"
						onChange={(value) => {
							setMode(value);
							setResult(null);
						}}
						options={[
							{ id: "text", label: "Words" },
							{ id: "image", label: "A picture" },
						]}
						value={mode}
					/>
					{mode === "image" ? (
						<>
							<FileField
								accept={IMAGE_TYPES}
								hint="A logo, a crest, or a signature. PNG keeps any transparency; other formats are prepared once in your browser."
								id="pdf-watermark-logo"
								label="Picture to stamp"
								onFile={(chosen) => void chooseLogo(chosen)}
							/>
							{logo ? (
								<div className="flex flex-wrap items-center gap-3 border border-line bg-[#fbfaf7] p-2">
									{/* eslint-disable-next-line @next/next/no-img-element -- the user's own picture, shown for confirmation */}
									<img alt={`Stamp picture ${logo.name}`} className="max-h-20 w-auto" src={logoUrl ?? ""} />
									<p className="m-0 text-xs text-muted">
										{logo.name} · {describeBytes(logo.size)}
									</p>
									<button
										className={buttonClassName}
										onClick={() => {
											setLogo(null);
											setResult(null);
										}}
										type="button"
									>
										Remove picture
									</button>
								</div>
							) : null}
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<label className={labelClassName} htmlFor="pdf-watermark-logo-size">
										Picture size
									</label>
									<select
										className={`${selectClassName} mt-2`}
										id="pdf-watermark-logo-size"
										onChange={(event) => {
											setLogoSize(event.target.value);
											setResult(null);
										}}
										value={logoSize}
									>
										{LOGO_SIZES.map((item) => (
											<option key={item.value} value={item.value}>
												{item.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-watermark-logo-opacity">
										Strength
									</label>
									<select
										className={`${selectClassName} mt-2`}
										id="pdf-watermark-logo-opacity"
										onChange={(event) => {
											setLogoOpacity(event.target.value);
											setResult(null);
										}}
										value={logoOpacity}
									>
										{LOGO_OPACITIES.map((item) => (
											<option key={item.value} value={item.value}>
												{item.label}
											</option>
										))}
									</select>
								</div>
							</div>
						</>
					) : (
								<>
							<div>
								<label className={labelClassName} htmlFor="pdf-watermark-text">
									Words to stamp
								</label>
								<input
									className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
									id="pdf-watermark-text"
									maxLength={60}
									onChange={(event) => {
										setText(event.target.value);
										setResult(null);
									}}
									placeholder="DRAFT"
									type="text"
									value={text}
								/>
								<p className={`${hintClassName} mt-2`}>Something short reads best: “DRAFT”, “CONFIDENTIAL”, or a name.</p>
							</div>
							<SegmentedControl
								label="Layout"
								onChange={(value) => {
									setStyle(value);
									setResult(null);
								}}
								options={[
									{ id: "single", label: "One in the middle" },
									{ id: "tiled", label: "Repeated across" },
								]}
								value={style}
							/>
							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<label className={labelClassName} htmlFor="pdf-watermark-colour">
										Colour
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-watermark-colour" onChange={(event) => setColour(event.target.value as "grey" | "red" | "blue")} value={colour}>
										{COLOURS.map((item) => (
											<option key={item.id} value={item.id}>
												{item.label}
											</option>
										))}
									</select>
								</div>
								<div>
									<label className={labelClassName} htmlFor="pdf-watermark-opacity">
										Strength
									</label>
									<select className={`${selectClassName} mt-2`} id="pdf-watermark-opacity" onChange={(event) => setOpacity(event.target.value)} value={opacity}>
										{OPACITIES.map((item) => (
											<option key={item.value} value={item.value}>
												{item.label}
											</option>
										))}
									</select>
								</div>
							</div>
								</>
					)}
					<StatGrid
						items={[
							{ label: "Pages", value: String(pageCount) },
							{
								label: "Stamp",
								value: mode === "image" ? logo?.name ?? "No picture yet" : text.trim() || "—",
							},
							{
								label: "Layout",
								value: mode === "image" ? `${Math.round(Number(logoSize) * 100)}% of the width` : style === "tiled" ? "Repeated" : "Centred",
							},
							{ label: "Size", value: file ? describeBytes(file.size) : "—" },
						]}
					/>
					<button className={primaryButtonClassName} disabled={busy || (mode === "image" ? !logo : !text.trim())} onClick={stamp} type="button">
						{busy ? "Stamping…" : "Stamp the PDF"}
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
