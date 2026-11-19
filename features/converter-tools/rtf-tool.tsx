"use client";

import { useMemo, useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileField } from "@/features/image-tools/image-file-shared";
import { rtfParagraphCount, rtfToText, rtfWordCount } from "@/features/converter-tools/rtf";

type Format = "markdown" | "text";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ".rtf,application/rtf,text/rtf,text/plain";

const SAMPLE = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Georgia;}{\f1 Courier New;}}
{\colortbl;\red38\green59\blue52;\red182\green75\blue49;}
\f0\fs24 {\b Meeting notes}\par
\par
Everyone agreed on three things:\par
{ \pntext\f0 1.\tab}A shorter agenda.\par
{ \pntext\f0 2.\tab}Notes written {\i during} the meeting, not after.\par
{ \pntext\f0 3.\tab}One owner per action.\par
\par
\f1 Next review: 19 November \endash  bring the numbers.\par
}`;

const baseName = (name: string) => name.replace(/\.rtf$/iu, "") || "document";

export const RtfTool = () => {
	const [source, setSource] = useState("");
	const [name, setName] = useState("document.rtf");
	const [size, setSize] = useState(0);
	const [format, setFormat] = useState<Format>("markdown");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const result = useMemo(() => {
		if (!source) return { text: "", error: "" };
		try {
			const text = rtfToText(source, { format });
			return { text, error: text ? "" : "This document has no writing in it — it may hold only pictures or fields." };
		} catch (caught) {
			return { text: "", error: caught instanceof Error ? caught.message : "This file could not be read as RTF." };
		}
	}, [source, format]);

	const read = async (chosen: File | null) => {
		setError("");
		if (!chosen) {
			setSource("");
			setSize(0);
			return;
		}
		setBusy(true);
		setName(chosen.name);
		setSize(chosen.size);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the file under 5 MB — RTF documents are text, so that is already a very long document.");
			const text = await chosen.text();
			if (!/^\s*\{\\rtf/iu.test(text)) throw new Error("That file does not start with {\\rtf. Save it again as Rich Text Format (.rtf) — an old .doc file will not work.");
			setSource(text);
		} catch (caught) {
			setSource("");
			setError(caught instanceof Error ? caught.message : "That file could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const loadSample = () => {
		setError("");
		setSource(SAMPLE);
		setName("meeting-notes.rtf");
		const bytes = new TextEncoder().encode(SAMPLE).length;
		setSize(bytes);
	};

	return (
		<ToolPanel>
			<FileField accept={ACCEPTED} hint="Read here in the tab. Headings become paragraphs, bold and italic runs are kept, tables become tab-separated lines, and pictures are left out." id="rtf-file" label="Rich Text file (.rtf)" onFile={(chosen) => void read(chosen)} />
			<div className="flex flex-wrap gap-2">
				<button className={buttonClassName} onClick={loadSample} type="button">
					Try a sample document
				</button>
				{source ? (
					<button
						className={buttonClassName}
						onClick={() => {
							setSource("");
							setError("");
						}}
						type="button"
					>
						Clear
					</button>
				) : null}
			</div>
			<SegmentedControl<Format>
				label="Write out as"
				onChange={setFormat}
				options={[
					{ id: "markdown", label: "Markdown" },
					{ id: "text", label: "Plain text" },
				]}
				value={format}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{result.error ? <ErrorNote message={result.error} /> : null}
			{busy ? <p className={hintClassName}>Reading the document…</p> : null}
			{result.text ? (
				<>
					<StatGrid
						items={[
							{ label: "Words", value: String(rtfWordCount(result.text)) },
							{ label: "Paragraphs", value: String(rtfParagraphCount(result.text)) },
							{ label: "Characters", value: result.text.length.toLocaleString("en-GB") },
							{ label: "File size", value: describeBytes(size) },
						]}
					/>
					<ResultBlock fileName={`${baseName(name)}.${format === "markdown" ? "md" : "txt"}`} rows={14} title="Converted text" value={result.text} />
				</>
			) : (
				<p className={hintClassName}>Choose an .rtf file, or load the sample, and the writing inside it appears here.</p>
			)}
			<p className={hintClassName}>
				RTF is older than most of the software that still writes it: fonts, colours, and pictures are dropped, and a few unusual character sets may fall back to plain letters.
			</p>
		</ToolPanel>
	);
};
