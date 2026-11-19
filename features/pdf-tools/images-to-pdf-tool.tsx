"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { buttonClassName, ErrorNote, hintClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { ACCEPTED_IMAGE_TYPES, describeBytes, FileDownloadLink, MultiFileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { MAX_IMAGE_BYTES, toEmbeddable } from "@/features/pdf-tools/image-embed";
import { imagesToPdf, type PagePreset } from "@/features/pdf-tools/pdf-engine";
import { pdfOutputName } from "@/features/pdf-tools/pdf-utils";

type Entry = { id: string; file: File; problem: string; url: string };

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

export const ImagesToPdfTool = () => {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [preset, setPreset] = useState<PagePreset>("fit");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
	const entriesRef = useRef<Entry[]>([]);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	useEffect(() => {
		entriesRef.current = entries;
	}, [entries]);

	/** Object URLs are made when the files arrive and released when they leave the list. */
	useEffect(
		() => () => {
			for (const entry of entriesRef.current) URL.revokeObjectURL(entry.url);
		},
		[],
	);

	const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);

	const chooseFiles = (files: File[]) => {
		setResult(null);
		if (!files.length) return;
		for (const entry of entries) URL.revokeObjectURL(entry.url);
		const pending: Entry[] = files.map((file) => ({ id: `image-${nextId++}`, file, problem: check(file), url: URL.createObjectURL(file) }));
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
								<span className="flex h-14 w-14 shrink-0 items-center justify-center border border-line bg-white">
									{/* eslint-disable-next-line @next/next/no-img-element -- a preview of the picked file */}
									<img alt={`Preview of ${entry.file.name}`} className="max-h-12 w-auto" src={entry.url} />
								</span>
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
										URL.revokeObjectURL(entry.url);
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
