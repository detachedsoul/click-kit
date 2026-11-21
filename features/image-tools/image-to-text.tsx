"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import Image from "next/image";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { FileDownloadLink, FileField, MAX_IMAGE_BYTES, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { clampCrop, makeOcrCanvas, type CropPercent } from "@/features/image-tools/ocr-utils";

const LANGUAGES = [
	{ code: "eng", name: "English" }, { code: "ara", name: "Arabic" }, { code: "chi_sim", name: "Chinese (Simplified)" },
	{ code: "fra", name: "French" }, { code: "deu", name: "German" }, { code: "hin", name: "Hindi" },
	{ code: "ita", name: "Italian" }, { code: "jpn", name: "Japanese" }, { code: "por", name: "Portuguese" }, { code: "spa", name: "Spanish" },
];
const actionClass = "min-h-10 cursor-pointer border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "min-h-10 cursor-pointer border border-line bg-surface px-4 text-xs font-medium text-ink hover:bg-[#f1f0ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const percentInput = "min-h-10 w-full border border-line bg-surface px-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const ImageToText = () => {
	const [file, setFile] = useState<File | null>(null);
	const [language, setLanguage] = useState("eng");
	const [rotation, setRotation] = useState(0);
	const [crop, setCrop] = useState<CropPercent>({ left: 0, top: 0, width: 100, height: 100 });
	const [threshold, setThreshold] = useState<number | null>(null);
	const [text, setText] = useState("");
	const [hasResult, setHasResult] = useState(false);
	const [progress, setProgress] = useState(0);
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [copied, setCopied] = useState(false);
	const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null);
	const imageUrl = useObjectUrl(file);
	const textBlob = hasResult ? new Blob([text], { type: "text/plain;charset=utf-8" }) : null;
	const textUrl = useObjectUrl(textBlob);

	useEffect(() => () => { void workerRef.current?.terminate(); workerRef.current = null; }, []);

	const selectImage = (next: File | null) => {
		setError(""); setText(""); setHasResult(false); setProgress(0); setStatus(""); setCopied(false);
		if (!next) { setFile(null); return; }
		if (!next.type.startsWith("image/")) { setFile(null); setError("Choose an image file or paste a screenshot."); return; }
		if (next.size > MAX_IMAGE_BYTES) { setFile(null); setError("Choose an image smaller than 25 MB."); return; }
		setFile(next); setRotation(0); setCrop({ left: 0, top: 0, width: 100, height: 100 });
	};

	const pasteImage = (event: ClipboardEvent<HTMLDivElement>) => {
		const item = Array.from(event.clipboardData.items).find((entry) => entry.type.startsWith("image/"));
		const pasted = item?.getAsFile();
		if (pasted) { event.preventDefault(); selectImage(new File([pasted], `pasted-screenshot.${pasted.type.split("/")[1] ?? "png"}`, { type: pasted.type })); }
	};

	const extract = async () => {
		if (!file || !imageUrl) return;
		setBusy(true); setError(""); setText(""); setHasResult(false); setProgress(0); setStatus("Preparing image…");
		let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
		try {
			const image = await new Promise<HTMLImageElement>((resolve, reject) => {
				const element = new window.Image();
				element.onload = () => resolve(element);
				element.onerror = () => reject(new Error("This image could not be decoded in your browser."));
				element.src = imageUrl;
			});
			const canvas = makeOcrCanvas(image, rotation, crop, threshold);
			setStatus("Loading OCR engine and language data…");
			const { createWorker, OEM } = await import("tesseract.js");
			worker = await createWorker(language, OEM.LSTM_ONLY, {
				logger: ({ status: message, progress: value }) => {
					setStatus(message);
					if (Number.isFinite(value)) setProgress(Math.round(value * 100));
				},
			});
			workerRef.current = worker;
			const result = await worker.recognize(canvas);
			setText(result.data.text.trim()); setHasResult(true);
			setStatus("Text extraction complete"); setProgress(100);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "OCR could not read this image. Please try another language or image.");
			setStatus("");
		} finally {
			if (worker) { await worker.terminate(); if (workerRef.current === worker) workerRef.current = null; }
			setBusy(false);
		}
	};

	const copyText = async () => {
		try { await navigator.clipboard.writeText(text); setCopied(true); setError(""); }
		catch { setError("Clipboard access is unavailable. Select the extracted text and copy it manually."); }
	};
	const updateCrop = (key: keyof CropPercent, value: number) => setCrop((current) => clampCrop({ ...current, [key]: value }));

	return <ToolPanel>
		<FileField accept="image/*" disabled={busy} hint="Upload a PNG, JPEG, WebP, GIF, BMP, or other browser-readable image (up to 25 MB). Images stay on this device." id="ocr-image" label="Choose an image" onFile={selectImage} />
		<div aria-label="Paste screenshot here" className="border border-dashed border-line bg-[#f8f7f3] p-4 text-center text-xs text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onPaste={pasteImage} tabIndex={0}>
			<p className="mb-0">Paste a screenshot here with Ctrl+V or ⌘V. Click this area first if needed.</p>
		</div>
		<ErrorNote message={error} />
		{file && imageUrl ? <>
			<div className="flex flex-wrap items-end gap-3">
				<label className={labelClassName} htmlFor="ocr-language">Text language<select className={selectClassName} disabled={busy} id="ocr-language" onChange={(event) => setLanguage(event.target.value)} value={language}>{LANGUAGES.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></label>
				<button className={secondaryClass} disabled={busy} onClick={() => setRotation((value) => (value + 90) % 360)} type="button">Rotate 90°</button>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative h-72 w-full max-w-lg"><Image alt={`Preview of ${file.name}, rotated ${rotation} degrees`} className="border border-line object-contain" fill sizes="(max-width: 620px) 100vw, 512px" src={imageUrl} style={{ transform: `rotate(${rotation}deg)` }} unoptimized /></div>
				<span className="text-[11px] text-muted">{file.name} · {(file.size / 1024).toFixed(1)} kB · {rotation}°</span>
			</div>
			<fieldset className="m-0 border border-line p-3"><legend className="px-1 text-xs font-semibold text-[#3c3d37]">Crop area (%)</legend>
				<div className="grid grid-cols-4 gap-2 max-[620px]:grid-cols-2">{([
					["left", "Left"], ["top", "Top"], ["width", "Width"], ["height", "Height"],
				] as const).map(([key, label]) => <label className="text-[11px] text-muted" key={key}>{label}<input aria-label={`Crop ${label.toLowerCase()} percent`} className={percentInput} disabled={busy} max="100" min="0" onChange={(event) => updateCrop(key, Number(event.target.value))} type="number" value={crop[key]} /></label>)}</div>
				<p className="mb-0 mt-2 text-[10px] text-muted">Set left and top offsets and the crop width and height. The crop always stays inside the image.</p>
			</fieldset>
			<CheckboxField checked={threshold !== null} disabled={busy} id="ocr-threshold-enabled" label="Improve contrast with black-and-white thresholding" onChange={(checked) => setThreshold(checked ? 150 : null)} />
			{threshold !== null ? <label className="block text-xs text-muted" htmlFor="ocr-threshold">Threshold<input className="mt-2 w-full accent-forest" id="ocr-threshold" max="240" min="30" onChange={(event) => setThreshold(Number(event.target.value))} type="range" value={threshold} /></label> : null}
			<div className="flex flex-wrap items-center gap-2"><button className={actionClass} disabled={busy} onClick={() => void extract()} type="button">{busy ? "Extracting…" : "Extract text"}</button>{busy ? <span aria-live="polite" className="text-xs text-muted">{status} · {progress}%</span> : null}</div>
		</> : <p className={hintClassName}>Once an image is ready, choose a language, adjust the crop or rotation, and run OCR.</p>}
		{hasResult ? <>
			<StatGrid items={[{ label: "Characters", value: text.length.toLocaleString() }, { label: "Words", value: text.trim() ? String(text.trim().split(/\s+/u).length) : "0" }, { label: "Language", value: LANGUAGES.find(({ code }) => code === language)?.name ?? language }]} />
			{text ? null : <p className={hintClassName}>No readable text was found. Try another crop, contrast setting, or language.</p>}
			<label className={labelClassName} htmlFor="ocr-result">Extracted text<textarea className={`${fieldClassName} min-h-48 resize-y font-mono`} id="ocr-result" onChange={(event) => setText(event.target.value)} value={text} /></label>
			<div className="flex flex-wrap items-center gap-2"><button className={secondaryClass} disabled={!text} onClick={() => void copyText()} type="button">{copied ? "Copied" : "Copy text"}</button>{textUrl ? <FileDownloadLink fileName={`${file?.name.replace(/\.[^.]+$/u, "") || "image"}-text.txt`} label="Download TXT" url={textUrl} /> : null}</div>
		</> : null}
	</ToolPanel>;
};
