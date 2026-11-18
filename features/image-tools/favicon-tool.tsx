"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckboxField, ErrorNote, hintClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	ACCEPTED_IMAGE_TYPES,
	blobToBytes,
	canvasToBlob,
	describeBytes,
	FileDownloadLink,
	FileField,
	isSupportedImage,
	loadImage,
	MAX_IMAGE_BYTES,
	useObjectUrl,
} from "@/features/image-tools/image-file-shared";
import { buildIco, faviconHtmlSnippet, ICO_FILE_NAME, ICO_ICON_SIZES, iconSummary, PNG_ICON_SIZES, webManifestSnippet } from "@/features/image-tools/favicon-utils";
import { stripExtension } from "@/features/image-tools/crop-utils";

type GeneratedIcon = { size: number; blob: Blob; fileName: string };

const drawIcon = (image: HTMLImageElement, size: number, fit: boolean) => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas image processing is not available in this browser.");
	context.imageSmoothingQuality = "high";
	const scale = fit ? Math.min(size / image.naturalWidth, size / image.naturalHeight) : Math.max(size / image.naturalWidth, size / image.naturalHeight);
	const width = Math.round(image.naturalWidth * scale);
	const height = Math.round(image.naturalHeight * scale);
	context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
	return canvas;
};

export const FaviconTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [fit, setFit] = useState(false);
	const [icons, setIcons] = useState<GeneratedIcon[]>([]);
	const [ico, setIco] = useState<Blob | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);
	const icoUrl = useObjectUrl(ico);

	const chooseFile = (nextFile: File | null) => {
		setError("");
		setIcons([]);
		setIco(null);
		setFile(null);
		if (!nextFile) return;
		if (!isSupportedImage(nextFile)) {
			setError("Choose a PNG, JPEG, WebP, GIF, AVIF, or BMP image.");
			return;
		}
		if (nextFile.size > MAX_IMAGE_BYTES) {
			setError("Choose an image smaller than 25 MB.");
			return;
		}
		setFile(nextFile);
	};

	const generate = async () => {
		if (!file || !previewUrl) return;
		setBusy(true);
		setError("");
		setIcons([]);
		setIco(null);
		try {
			const image = await loadImage(previewUrl);
			const baseName = stripExtension(file.name);
			const sizes = [...PNG_ICON_SIZES, ...ICO_ICON_SIZES].sort((a, b) => a - b);
			const generated: { size: number; blob: Blob; bytes: Uint8Array }[] = [];
			for (const size of sizes) {
				const canvas = drawIcon(image, size, fit);
				const blob = await canvasToBlob(canvas, "image/png");
				generated.push({ size, blob, bytes: await blobToBytes(blob) });
			}
			setIcons(
				generated
					.filter((icon) => PNG_ICON_SIZES.includes(icon.size))
					.map((icon) => ({ size: icon.size, blob: icon.blob, fileName: `${baseName}-${icon.size}x${icon.size}.png` })),
			);
			const icoBytes = buildIco(generated.filter((icon) => ICO_ICON_SIZES.includes(icon.size)).map((icon) => ({ size: icon.size, bytes: icon.bytes })));
			setIco(new Blob([icoBytes.slice().buffer], { type: "image/x-icon" }));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not build the icon set.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_IMAGE_TYPES}
				hint="A square image works best. Everything here runs on this device; nothing is uploaded."
				id="favicon-file"
				label="Source image"
				onFile={chooseFile}
			/>
			{file && previewUrl ? (
				<div className="flex flex-wrap items-center gap-4 border border-line bg-[#f8f7f3] p-3">
					<Image alt={`Source image: ${file.name}`} className="h-24 w-24 object-contain" height={96} src={previewUrl} unoptimized width={96} />
					<p className="m-0 text-xs leading-relaxed text-muted">
						{file.name}
						<br />
						{describeBytes(file.size)}
					</p>
				</div>
			) : null}
			<CheckboxField checked={fit} hint="Off fills the square and crops the edges; on keeps the whole image with transparent padding." id="favicon-fit" label="Fit the image inside the square" onChange={setFit} />
			<button
				className="min-h-10 cursor-pointer self-start border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				disabled={!file || busy}
				onClick={() => void generate()}
				type="button"
			>
				{busy ? "Building icons…" : "Generate icon set"}
			</button>
			<ErrorNote message={error} />
			{ico && icoUrl ? (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Icon files</h2>
						<FileDownloadLink fileName={ICO_FILE_NAME} label={`Download ${ICO_FILE_NAME}`} url={icoUrl} />
					</div>
					<StatGrid
						items={[
							{ label: "ICO sizes", value: ICO_ICON_SIZES.map((size) => `${size}px`).join(", ") },
							{ label: "ICO file", value: describeBytes(ico.size) },
							{ label: "PNG sizes", value: PNG_ICON_SIZES.map((size) => `${size}px`).join(", ") },
							{ label: "PNG count", value: String(icons.length) },
						]}
					/>
					<div className="flex flex-wrap gap-3">
						{icons.map((icon) => (
							<ResultIcon key={icon.size} icon={icon} />
						))}
					</div>
					<ResultBlock fileName="icons.html" title="Link tags" value={faviconHtmlSnippet()} rows={6} />
					<ResultBlock fileName="site.webmanifest" title="Web app manifest" value={webManifestSnippet()} rows={10} />
					<p className={hintClassName}>
						Save {ICO_FILE_NAME} at your site root, the PNGs beside it, and copy the link tags into your page head. Sizes generated:{" "}
						{iconSummary(icons.map((icon) => ({ size: icon.size, bytes: icon.blob })))}
					</p>
				</section>
			) : null}
			<p className={hintClassName}>
				The .ico stores {ICO_ICON_SIZES.join(", ")} px PNGs, which every current browser reads. Add the link tags to your page head and the manifest
				if you want an installable web app.
			</p>
		</ToolPanel>
	);
};

const ResultIcon = ({ icon }: { icon: GeneratedIcon }) => {
	const url = useObjectUrl(icon.blob);
	return (
		<div className="flex items-center gap-3 border border-line bg-[#fbfaf7] p-2">
			{url ? <Image alt={`${icon.size} pixel icon`} className="h-10 w-10 object-contain" height={40} src={url} unoptimized width={40} /> : null}
			<div className="flex flex-col gap-1">
				<span className="text-[11px] font-semibold">
					{icon.size} × {icon.size}
				</span>
				{url ? <FileDownloadLink fileName={icon.fileName} label="Download" url={url} /> : null}
			</div>
		</div>
	);
};
