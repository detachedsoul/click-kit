"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, SegmentedControl, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { htmlToMarkdown, textOfHtml } from "@/features/converter-tools/html-markdown";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

type Output = "markdown" | "text";

const SAMPLE = `<h1>Shopping list</h1>
<p>Two things matter this week: <strong>bread</strong> and a <a href="https://example.com/market">market run</a>.</p>
<ul>
	<li>Brown bread</li>
	<li>Tomatoes</li>
</ul>
<blockquote>Buy the good tomatoes.</blockquote>`;

export const HtmlToMarkdownTool = () => {
	const [source, setSource] = useState(SAMPLE);
	const [output, setOutput] = useState<Output>("markdown");
	const [keepLinks, setKeepLinks] = useState(true);
	const [keepImages, setKeepImages] = useState(true);

	const result = useMemo(() => {
		const trimmed = source.trim();
		if (!trimmed) return { value: "", error: "" };
		try {
			const value = output === "markdown" ? htmlToMarkdown(trimmed, { keepLinks, keepImages }) : textOfHtml(trimmed);
			return { value, error: value ? "" : "That markup has no readable content — check that you pasted the page body." };
		} catch {
			return { value: "", error: "That markup could not be read. Try pasting the page's body rather than the whole site." };
		}
	}, [source, output, keepLinks, keepImages]);

	return (
		<ToolPanel>
			<TextAreaField
				hint="Paste a full page or just a fragment. Scripts, styles, and the page head are dropped; common text structure, links, and image references become Markdown. CSS, exact visual layout, and bundled image files are not preserved."
				id="html-markdown-input"
				label="HTML input"
				onChange={setSource}
				placeholder="Paste HTML…"
				rows={12}
				value={source}
			/>
			<SegmentedControl<Output>
				label="Convert to"
				onChange={setOutput}
				options={[
					{ id: "markdown", label: "Markdown" },
					{ id: "text", label: "Plain text" },
				]}
				value={output}
			/>
			{output === "markdown" ? (
				<fieldset className="m-0 flex flex-wrap gap-4 border border-line bg-[#fbfaf7] px-3 py-2">
					<legend className="px-1 text-[10px] uppercase tracking-[.08em] text-[#5f6259]">Keep</legend>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]">
						<input checked={keepLinks} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setKeepLinks(event.target.checked)} type="checkbox" />
						Links
					</label>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]">
						<input checked={keepImages} className="h-4 w-4 accent-[#2f4539]" onChange={(event) => setKeepImages(event.target.checked)} type="checkbox" />
						Images
					</label>
				</fieldset>
			) : null}
			<StatGrid
				items={[
					{ label: "Input", value: `${source.trim().length.toLocaleString()} chars` },
					{ label: "Output", value: `${result.value.length.toLocaleString()} chars` },
					{ label: "Lines", value: String(result.value ? result.value.split("\n").length : 0) },
					{ label: "Format", value: output === "markdown" ? "Markdown" : "Plain text" },
				]}
			/>
			<ErrorNote message={result.error} />
			{!result.error ? (
				<ResultBlock
					fileName={output === "markdown" ? "converted.md" : "converted.txt"}
					title={output === "markdown" ? "Markdown output" : "Text output"}
					value={result.value}
				/>
			) : null}
			<p className={hintClassName}>Everything happens in this tab; nothing is uploaded.</p>
		</ToolPanel>
	);
};
