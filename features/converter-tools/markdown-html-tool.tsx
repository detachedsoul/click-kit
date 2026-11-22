"use client";

import { useMemo, useState } from "react";
import { CheckboxField, CheckboxRow, hintClassName, ResultBlock, SegmentedControl, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { headingCount, markdownToHtml, markdownWordCount, wrapInPage } from "@/features/converter-tools/markdown-html";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

type Output = "fragment" | "page";

const SAMPLE = `# Weekly note

Two things matter this week: **bread** and a [market run](https://example.com/market).
The rest can wait — see the ~~old plan~~ for context.

## Shopping

- Brown bread
- Tomatoes
- *Something green*

1. Check the cupboard
2. Walk to the market

> Buy the good tomatoes.

\`\`\`sh
ls ~/lists
\`\`\`

| Item | Price |
| --- | --- |
| Bread | 2.50 |
| Tomatoes | 1.80 |

---

Written in a text editor, read in a browser.`;

export const MarkdownToHtmlTool = () => {
	const [source, setSource] = useState(SAMPLE);
	const [output, setOutput] = useState<Output>("fragment");
	const [keepLinks, setKeepLinks] = useState(true);
	const [keepImages, setKeepImages] = useState(true);

	const result = useMemo(() => {
		const trimmed = source.trim();
		if (!trimmed) return { value: "", error: "" };
		try {
			const fragment = markdownToHtml(trimmed, { keepLinks, keepImages });
			const value = output === "page" ? wrapInPage(fragment, "Document") : fragment;
			return { value, error: value ? "" : "That markdown has no readable content — check that you pasted the body." };
		} catch {
			return { value: "", error: "That markdown could not be read. Try pasting it again as plain text." };
		}
	}, [source, output, keepLinks, keepImages]);

	const words = markdownWordCount(source);
	const headings = headingCount(source);

	return (
		<ToolPanel>
			<TextAreaField
				hint="Paste Markdown and get HTML for the supported Markdown syntax. This is a semantic text conversion, not a visual copy of the source; unsupported extensions remain text. Everything is escaped first, and unsafe javascript: or data: links are left as plain text."
				id="markdown-html-input"
				label="Markdown input"
				onChange={setSource}
				placeholder="Paste Markdown…"
				rows={12}
				value={source}
			/>
			<SegmentedControl<Output>
				label="Output"
				onChange={setOutput}
				options={[
					{ id: "fragment", label: "Fragment" },
					{ id: "page", label: "Full page" },
				]}
				value={output}
			/>
			<CheckboxRow>
				<CheckboxField checked={keepLinks} id="markdown-html-links" label="Turn links into anchors" onChange={setKeepLinks} />
				<CheckboxField checked={keepImages} id="markdown-html-images" label="Turn images into img tags" onChange={setKeepImages} />
			</CheckboxRow>
			<StatGrid
				items={[
					{ label: "Words", value: String(words) },
					{ label: "Headings", value: String(headings) },
					{ label: "HTML out", value: `${result.value.length.toLocaleString("en-GB")} chars` },
					{ label: "Shape", value: output === "page" ? "Whole page" : "Fragment" },
				]}
			/>
			{result.error ? <p className="m-0 text-xs text-[#8a3f30]">{result.error}</p> : null}
			<ResultBlock fileName={output === "page" ? "document.html" : "fragment.html"} rows={14} title="HTML output" value={result.value} />
			<p className={hintClassName}>
				The HTML is a starting point rather than a published page: it carries no styling, and any raw HTML in the Markdown is shown as text on purpose.
			</p>
		</ToolPanel>
	);
};
