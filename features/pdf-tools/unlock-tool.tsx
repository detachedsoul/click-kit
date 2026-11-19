"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileDownloadLink, FileField, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { imagesToPdf, readFileBytes } from "@/features/pdf-tools/pdf-engine";
import { pdfPageCount, renderPageImages } from "@/features/pdf-tools/pdf-render";
import { ACCEPTED_PDF_TYPES, pageWord, pdfOutputName, validatePdfFile } from "@/features/pdf-tools/pdf-utils";

const DPI_CHOICES = [
	{ value: "144", label: "Balanced — 144 dpi" },
	{ value: "200", label: "Sharp — 200 dpi" },
	{ value: "96", label: "Smaller file — 96 dpi" },
];

const friendlyUnlockError = (caught: unknown) => {
	const message = caught instanceof Error ? caught.message : "";
	if (/password/iu.test(message)) return "That password does not open this file. Check the spelling and capital letters.";
	if (/not a readable|InvalidPDF|No PDF header|parse/iu.test(message)) return "That file is not a readable PDF — it may be damaged or renamed.";
	return message || "This PDF could not be opened.";
};

export const PdfUnlockTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [password, setPassword] = useState("");
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [dpi, setDpi] = useState("144");
	const [busy, setBusy] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [error, setError] = useState("");
	const [result, setResult] = useState<{ blob: Blob; name: string; note: string } | null>(null);
	const resultUrl = useObjectUrl(result?.blob ?? null);

	const chooseFile = (chosen: File | null) => {
		setResult(null);
		setError("");
		setPageCount(null);
		setPassword("");
		setFile(chosen);
		if (!chosen) return;
		const problem = validatePdfFile(chosen);
		if (problem) setError(problem);
	};

	const checkPassword = async () => {
		if (!file) return;
		setBusy(true);
		setError("");
		setResult(null);
		setPageCount(null);
		try {
			const count = await pdfPageCount(await readFileBytes(file), password);
			setPageCount(count);
		} catch (caught) {
			setError(friendlyUnlockError(caught));
		} finally {
			setBusy(false);
		}
	};

	const rebuild = async () => {
		if (!file || pageCount === null) return;
		setBusy(true);
		setError("");
		setResult(null);
		setProgress({ done: 0, total: pageCount });
		try {
			const bytes = await readFileBytes(file);
			const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
			const drawn = await renderPageImages(bytes, pages, { password, scale: Number(dpi) / 72, type: "image/jpeg", quality: 0.9 });
			setProgress({ done: drawn.length, total: pageCount });
			const pictures = await Promise.all(drawn.map(async ({ blob }) => ({ bytes: new Uint8Array(await blob.arrayBuffer()), type: "image/jpeg" as const })));
			const out = await imagesToPdf(pictures, "fit", 0, { dpi: Number(dpi) });
			setResult({
				blob: new Blob([out.slice().buffer], { type: "application/pdf" }),
				name: pdfOutputName(file.name, "unlocked"),
				note: `${pageWord(pageCount)} in a copy that opens without a password`,
			});
		} catch (caught) {
			setError(friendlyUnlockError(caught));
		} finally {
			setBusy(false);
		}
	};

	return (
		<ToolPanel>
			<FileField
				accept={ACCEPTED_PDF_TYPES}
				hint="Use a file you are allowed to open. The password never leaves your device — it is only used here, in the browser."
				id="pdf-unlock-file"
				label="Password-protected PDF"
				onFile={chooseFile}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{file && !error.includes("Choose a PDF") ? (
				<>
					<div>
						<label className={labelClassName} htmlFor="pdf-unlock-password">
							Password
						</label>
						<input
							className="mt-2 min-h-11 w-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							id="pdf-unlock-password"
							onChange={(event) => {
								setPassword(event.target.value);
								setPageCount(null);
								setResult(null);
							}}
							placeholder="The password that opens this file"
							type="password"
							value={password}
						/>
						<p className={`${hintClassName} mt-2`}>Some files open with no password at all, only a restriction on copying. Leave this empty to try.</p>
					</div>
					<button className={buttonClassName} disabled={busy} onClick={checkPassword} type="button">
						{busy && pageCount === null ? "Checking…" : "Check the password"}
					</button>
					{pageCount !== null ? (
						<>
							<div>
								<label className={labelClassName} htmlFor="pdf-unlock-dpi">
									Picture quality for the copy
								</label>
								<select className={`${selectClassName} mt-2`} id="pdf-unlock-dpi" onChange={(event) => setDpi(event.target.value)} value={dpi}>
									{DPI_CHOICES.map((choice) => (
										<option key={choice.value} value={choice.value}>
											{choice.label}
										</option>
									))}
								</select>
								<p className={`${hintClassName} mt-2`}>
									A file that will not open without its password cannot keep its original text, so each page is redrawn as a picture. The words stay visible; they stop being selectable.
								</p>
							</div>
							<StatGrid
								items={[
									{ label: "Pages", value: String(pageCount) },
									{ label: "Opens with", value: password ? "That password" : "No password" },
									{ label: "Drawing", value: `${progress.done}/${pageCount}` },
									{ label: "Now", value: describeBytes(file.size) },
								]}
							/>
							<button className={primaryButtonClassName} disabled={busy} onClick={rebuild} type="button">
								{busy ? `Redrawing ${progress.done} of ${progress.total}…` : "Make an unlocked copy"}
							</button>
						</>
					) : null}
				</>
			) : null}
			{result ? (
				<div className="flex flex-wrap items-center gap-3 border border-line bg-[#f8f7f3] p-3">
					<FileDownloadLink fileName={result.name} label={`Download ${result.name}`} url={resultUrl} />
					<p className="m-0 text-xs text-muted">{result.note}</p>
				</div>
			) : null}
		</ToolPanel>
	);
};
