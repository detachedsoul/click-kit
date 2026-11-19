"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { ACCEPTED_IMAGE_TYPES, blobToBytes, canvasToBlob, describeBytes, FileDownloadLink, loadImage, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { imagesToPdf, type PagePreset } from "@/features/pdf-tools/pdf-engine";
import { pdfOutputName } from "@/features/pdf-tools/pdf-utils";

type Entry = { id: string; file: File; problem: string };

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

let nextId = 0;

const PRESETS: { id: PagePreset; label: string }[] = [
	{ id: "fit", label: "Exactly the picture's size" },
	{ id: "a4", label: "A4 paper" },
	{ id: "letter", label: "US Letter paper" },
];

const check = (file: File) => {
	if (!file.type.startsWith("image/")) return "Choose an image file.";
	if (file.size > MAX_IMAGE_BYTES) return "Keep each image under 25 MB.";
	return "";
};

/** pdf-lib understands PNG and JPEG directly; anything else is drawn onto a canvas first. */
const toEmbeddable = async (file: File): Promise<{ bytes: Uint8Array; type: "image/png" | "image/jpeg" }> => {
	if (file.type === "image/jpeg") return { bytes: new Uint8Array(await file.arrayBuffer()), type: "image/jpeg" };
	if (file.type === "image/png") return { bytes: new Uint8Array(await file.arrayBuffer()), type: "image/png" };
	const url = URL.createObjectURL(file);
	try {
		const image = await loadImage(url);
		const canvas = document.createElement("canvas");
		canvas.width = image.naturalWidth || image.width;
		canvas.height = image.naturalHeight || image.height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("This browser cannot prepare that image.");
		context.drawImage(image, 0, 0);
		return { bytes: await blobToBytes(await canvasToBlob(canvas, "image/png", 1)), type: "image/png" };
	} finally {
		URL.revokeObjectURL(url);
	}
};

export const ImagesToPdfTool = () => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [preset, setPreset] = useState<PagePreset>("fit");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);
	const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);

	const chooseFiles = (files: File[]) => {
		setResult(null);
		if (!files.length) return;
		const pending = files.map((file) => ({ id: `image-${nextId++}`, file, problem: check(file) }));
		const problem = pending.find((entry) => entry.problem);
		setError(problem?.problem ? `${problem.file.name}: ${problem.problem}` : "");
		setEntries(pending);
	};

	const move = (index: number, direction: -1 | 1) => {
		setResult(null);
		setEntries((current) => {
			const target = index + direction;
			if (target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});
	};

	const build = async () => {
		setBusy(true);
		setError("");
		setResult(null);
		try {
			const images = [];
			for (const entry of entries) images.push(await toEmbeddable(entry.file));
			const out = await imagesToPdf(images, preset);
			const name = pdfOutputName(entries[0].file.name.replace(/\.[a-z0-9]+$/iu, ""), "images");
			setResult({ blob: new Blob([out.slice().buffer], { type: "application/pdf" }), name });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "These images could not be put into a PDF.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<MultiFileField
				accept={ACCEPTED_IMAGE_TYPES}
				hint="JPEG and PNG files are embedded exactly as they are; other formats are prepared once in your browser."
				id="images-to-pdf-files"
				label="Images, in page order"
				onFiles={chooseFiles}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{entries.length > 0 ? (
				<>
					<div>
						<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="images-to-pdf-preset">
							Page size
						</label>
						<select className={`${selectClassName} mt-2`} id="images-to-pdf-preset" onChange={(event) => setPreset(event.target.value as PagePreset)} value={preset}>
							{PRESETS.map((item) => (
								<option key={item.id} value={item.id}>
									{item.label}
								</option>
							))}
						</select>
						<p className={`${hintClassName} mt-2`}>Paper sizes keep a small margin, never stretch a picture, and turn sideways for wide ones.</p>
					</div>
					<StatGrid
						items={[
							{ label: "Images", value: String(entries.length) },
							{ label: "Pages", value: String(entries.length) },
							{ label: "Total size", value: describeBytes(totalBytes) },
							{ label: "Page size", value: PRESETS.find((item) => item.id === preset)?.label ?? "Fit" },
						]}
					/>
					<ul className="m-0 list-none space-y-2 p-0">
						{entries.map((entry, index) => (
							<li className="flex flex-wrap items-center gap-2 border border-line bg-[#fbfaf7] p-2" key={entry.id}>
								<span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink" title={entry.file.name}>
									{index + 1}. {entry.file.name}
								</span>
								<span className="text-[11px] text-muted">{describeBytes(entry.file.size)}</span>
								<button aria-label={`Move ${entry.file.name} up`} className={buttonClassName} disabled={index === 0} onClick={() => move(index, -1)} type="button">
									<ArrowUp aria-hidden="true" size={13} />
								</button>
								<button aria-label={`Move ${entry.file.name} down`} className={buttonClassName} disabled={index === entries.length - 1} onClick={() => move(index, 1)} type="button">
									<ArrowDown aria-hidden="true" size={13} />
								</button>
								<button
									aria-label={`Remove ${entry.file.name}`}
									className={buttonClassName}
									onClick={() => {
										setResult(null);
										setEntries((current) => current.filter((item) => item.id !== entry.id));
									}}
									type="button"
								>
									<X aria-hidden="true" size={13} />
								</button>
							</li>
						))}
					</ul>
					<button className={primaryButtonClassName} disabled={busy || entries.some((entry) => entry.problem)} onClick={build} type="button">
						{busy ? "Building…" : "Create PDF"}
					</button>
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{describeBytes(result.blob.size)}</p>
				</div>
			) : null}
		</ToolPanel>
	);
};
