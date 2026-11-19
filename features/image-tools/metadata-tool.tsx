"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { ErrorNote, hintClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, fileToBytes, FileField, loadImage, useObjectUrl } from "@/features/image-tools/image-file-shared";
import { parseExif, type ExifSummary } from "@/features/image-tools/exif-utils";
import { ratioLabel } from "@/features/image-tools/crop-utils";

type Facts = {
	width: number;
	height: number;
	type: string;
	size: number;
	modified: string;
};

const summaryText = (file: File, facts: Facts | null, exif: ExifSummary | null) => {
	const lines = [
		`File: ${file.name}`,
		`Size: ${describeBytes(file.size)} (${file.size.toLocaleString()} bytes)`,
		`Type: ${file.type || "unknown"}`,
		facts ? `Dimensions: ${facts.width} × ${facts.height} px (${ratioLabel(facts)})` : "Dimensions: not decodable as an image",
		facts ? `Megapixels: ${((facts.width * facts.height) / 1_000_000).toFixed(2)} MP` : "",
		...(exif?.fields ?? []).map((field) => `${field.label}: ${field.value}`),
	];
	return lines.filter(Boolean).join("\n");
};

export const MetadataTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [facts, setFacts] = useState<Facts | null>(null);
	const [exif, setExif] = useState<ExifSummary | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const previewUrl = useObjectUrl(file);

	const chooseFile = async (nextFile: File | null) => {
		setError("");
		setFacts(null);
		setExif(null);
		setFile(null);
		if (!nextFile) return;
		setBusy(true);
		try {
			const bytes = await fileToBytes(nextFile, 256 * 1024);
			setExif(parseExif(bytes));
			let dimensions: { width: number; height: number } | null = null;
			if (nextFile.type.startsWith("image/")) {
				const objectUrl = URL.createObjectURL(nextFile);
				try {
					const image = await loadImage(objectUrl);
					dimensions = { width: image.naturalWidth, height: image.naturalHeight };
				} finally {
					URL.revokeObjectURL(objectUrl);
				}
			}
			setFacts({
				width: dimensions?.width ?? 0,
				height: dimensions?.height ?? 0,
				type: nextFile.type || "unknown",
				size: nextFile.size,
				modified: new Date(nextFile.lastModified).toISOString().slice(0, 19).replace("T", " "),
			});
			setFile(nextFile);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not read this file.");
		} finally {
			setBusy(false);
		}
	};

	const hasDimensions = Boolean(facts && facts.width > 0 && facts.height > 0);

	return (
		<ToolPanel>
			<FileField
				hint="Pick any image or file. The first 256 kB are read locally to find EXIF data; nothing leaves your device."
				id="metadata-file"
				label="File"
				onFile={(next) => void chooseFile(next)}
			/>
			{busy ? (
				<p className="m-0 text-xs text-muted" role="status">
					Reading metadata…
				</p>
			) : null}
			<ErrorNote message={error} />
			{file && facts ? (
				<>
					<StatGrid
						items={[
							{ label: "Name", value: file.name },
							{ label: "Size", value: `${describeBytes(facts.size)} · ${facts.size.toLocaleString()} bytes` },
							{ label: "MIME type", value: facts.type },
							{ label: "Modified", value: `${facts.modified} UTC` },
							...(hasDimensions
								? [
										{ label: "Dimensions", value: `${facts.width} × ${facts.height} px` },
										{ label: "Aspect ratio", value: ratioLabel(facts) },
										{ label: "Megapixels", value: `${((facts.width * facts.height) / 1_000_000).toFixed(2)} MP` },
										{ label: "Preview", value: previewUrl ? "Shown above" : "—" },
									]
								: []),
						]}
					/>
					{previewUrl && hasDimensions && facts ? (
						<div className="flex flex-wrap items-center gap-4 border border-line bg-[#f8f7f3] p-3">
							<Image
								alt={`Preview of ${file.name}`}
								className="max-h-32 max-w-40 object-contain"
								height={facts.height}
								src={previewUrl}
								unoptimized
								width={facts.width}
							/>
							<p className="m-0 text-xs leading-relaxed text-muted">Preview only; the bytes that produced it never left this tab.</p>
						</div>
					) : null}
					{exif && exif.fields.length > 0 ? (
						<>
							<StatGrid items={exif.fields.map((field) => ({ label: field.label, value: field.value }))} />
							{exif.gps ? (
								<p className="m-0 border border-[#e5d9bd] bg-[#faf4e6] px-3 py-2 text-[11px] leading-relaxed text-[#6b5a2e]">
									This photo carries GPS coordinates ({exif.gps.latitude.toFixed(6)}, {exif.gps.longitude.toFixed(6)}). Strip EXIF before sharing it
									publicly.
								</p>
							) : null}
						</>
					) : (
						<p className={hintClassName}>
							No EXIF block found. Screenshots and images re-saved by chat apps usually lose camera details, GPS, and timestamps.
						</p>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<CopyTextButton text={summaryText(file, facts, exif)} />
						<span className="text-[11px] text-muted">Copy a plain-text summary of everything above.</span>
					</div>
					<ResultBlock fileName="metadata.txt" title="Metadata summary" value={summaryText(file, facts, exif)} rows={10} />
				</>
			) : null}
			<p className={hintClassName}>
				EXIF is read straight from the JPEG markers: camera, lens, exposure triangle, orientation, and GPS if the camera wrote them. Other formats
				show their file facts only.
			</p>
		</ToolPanel>
	);
};
