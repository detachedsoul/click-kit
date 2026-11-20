"use client";

import { useState } from "react";
import { buttonClassName, ErrorNote, hintClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { describeBytes, FileField } from "@/features/image-tools/image-file-shared";
import { deckToMarkdown, deckToText, deckWordCount, type PptFormat, readPptx } from "@/features/converter-tools/pptx";

type Output = { markdown: string; text: string; slides: number; skipped: number; words: number };

const MAX_BYTES = 60 * 1024 * 1024;

export const PptxTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [format, setFormat] = useState<PptFormat>("markdown");
	const [output, setOutput] = useState<Output | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const read = async (chosen: File | null) => {
		setError("");
		setOutput(null);
		setFile(chosen);
		if (!chosen) return;
		setBusy(true);
		try {
			if (chosen.size > MAX_BYTES) throw new Error("Keep the deck under 60 MB.");
			if (!/\.pptx$/iu.test(chosen.name)) throw new Error("That is not a .pptx file. The older .ppt format and Google Slides' own links will not work — export the deck as PowerPoint first.");
			const deck = await readPptx(new Uint8Array(await chosen.arrayBuffer()));
			const markdown = deckToMarkdown(deck);
			if (!markdown) throw new Error("This deck has no words in it — it may be pictures only.");
			setOutput({ markdown, text: deckToText(deck), slides: deck.slides.length, skipped: deck.skipped, words: deckWordCount(deck) });
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : "";
			if (/zip|central directory|not a zip/iu.test(message)) setError("That file could not be opened. A .pptx is a zip of XML files — check it is not a renamed .ppt or a damaged download.");
			else setError(message || "This deck could not be read.");
		} finally {
			setBusy(false);
		}
	};

	const value = output ? (format === "markdown" ? output.markdown : output.text) : "";
	const fileName = `${file?.name.replace(/\.pptx$/iu, "") || "deck"}.${format === "markdown" ? "md" : "txt"}`;

	return (
		<ToolPanel>
			<FileField
				accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
				hint="Titles become headings, each line on a slide becomes a bullet, and speaker notes come out as quotes. Layout, theme, and pictures are left behind."
				id="pptx-file"
				label="PowerPoint deck (.pptx)"
				onFile={(chosen) => void read(chosen)}
			/>
			<SegmentedControl<PptFormat>
				label="Write out as"
				onChange={setFormat}
				options={[
					{ id: "markdown", label: "Markdown" },
					{ id: "text", label: "Plain text" },
				]}
				value={format}
			/>
			{error ? <ErrorNote message={error} /> : null}
			{busy ? <p className={hintClassName}>Reading the deck…</p> : null}
			{output ? (
				<>
					<StatGrid
						items={[
							{ label: "Slides", value: String(output.slides) },
							{ label: "With words", value: String(output.slides - output.skipped) },
							{ label: "Words", value: String(output.words) },
							{ label: "File size", value: describeBytes(file?.size ?? 0) },
						]}
					/>
					{output.skipped ? <p className={hintClassName}>{output.skipped} slide{output.skipped === 1 ? "" : "s"} had no words on them and come out as an empty heading.</p> : null}
					<ResultBlock fileName={fileName} rows={14} title="Converted deck" value={value} />
				</>
			) : (
				<p className={hintClassName}>Choose a deck and its words appear here. Nothing is uploaded — the file never leaves this tab.</p>
			)}
			{file ? (
				<button className={buttonClassName} onClick={() => void read(null)} type="button">
					Choose another deck
				</button>
			) : null}
		</ToolPanel>
	);
};
