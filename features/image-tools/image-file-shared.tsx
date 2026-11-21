"use client";

import Image from "next/image";
import { useEffect, useMemo } from "react";

export const fileInputClassName =
	"mt-2 block min-h-11 w-full cursor-pointer border border-line bg-surface p-2 text-xs text-ink file:mr-3 file:cursor-pointer file:border-0 file:bg-[#eeede7] file:px-3 file:py-2 file:text-xs file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const imageInputClassName = fileInputClassName;

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp";

export const downloadLinkClassName =
	"inline-flex min-h-[34px] cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const FileField = ({
	id,
	label,
	hint,
	accept,
	disabled = false,
	onFile,
}: {
	id: string;
	label: string;
	hint?: string;
	accept?: string;
	disabled?: boolean;
	onFile: (file: File | null) => void;
}) => (
	<div>
		<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor={id}>
			{label}
			<input
				accept={accept}
				className={fileInputClassName}
				disabled={disabled}
				id={id}
				onChange={(event) => onFile(event.target.files?.[0] ?? null)}
				type="file"
			/>
		</label>
		{hint ? <p className="mb-0 mt-2 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
	</div>
);

/** The same field, for tools that take several files at once. */
export const MultiFileField = ({
	id,
	label,
	hint,
	accept,
	disabled = false,
	onFiles,
}: {
	id: string;
	label: string;
	hint?: string;
	accept?: string;
	disabled?: boolean;
	onFiles: (files: File[]) => void;
}) => (
	<div>
		<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor={id}>
			{label}
			<input
				accept={accept}
				className={fileInputClassName}
				disabled={disabled}
				id={id}
				multiple
				onChange={(event) => {
					const files = Array.from(event.currentTarget.files ?? []);
					event.currentTarget.value = "";
					onFiles(files);
				}}
				type="file"
			/>
		</label>
		{hint ? <p className="mb-0 mt-2 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
	</div>
);

/** Load an image element from a URL that is already in the page. */
export const loadImage = (url: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new window.Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("This image could not be decoded in your browser."));
		image.src = url;
	});

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
	new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The browser could not encode this image format."))), type, quality);
	});

export const fileToBytes = async (file: File, limit = Number.MAX_SAFE_INTEGER) => new Uint8Array(await file.slice(0, limit).arrayBuffer());

export const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

export const isSupportedImage = (file: File) => ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/bmp"].includes(file.type);

export const describeBytes = (bytes: number) => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Download link for a blob URL that the tool owns and revokes. */
export const FileDownloadLink = ({ url, fileName, label }: { url: string; fileName: string; label: string }) => (
	<a className={downloadLinkClassName} download={fileName} href={url}>
		{label}
	</a>
);

/** Preview thumbnail plus a short line about the file. */
export const ImagePreview = ({ url, alt, width, height, caption }: { url: string; alt: string; width: number; height: number; caption: string }) => (
	<div className="flex flex-wrap items-center gap-4 border border-line bg-[#f8f7f3] p-3">
		<Image alt={alt} className="max-h-36 max-w-44 object-contain" height={height} src={url} unoptimized width={width} />
		<p className="m-0 text-xs leading-relaxed text-muted">{caption}</p>
	</div>
);

/** An object URL for a blob or file, revoked when it changes or the tool unmounts. */
export const useObjectUrl = (blob: Blob | null) => {
	const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);
	useEffect(
		() => () => {
			if (url) URL.revokeObjectURL(url);
		},
		[url],
	);
	return url;
};
