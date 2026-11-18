"use client";

import { SelectField } from "@/components/select-field";

import { useMemo, useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { analyzeReadability, createMarkdownTable, renderSafeMarkdown } from "@/features/text-tools/extra-text-utils";

const ToolLayout = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">{children}</div>;

const ReadabilityCheckerTool = () => {
	const [text, setText] = useState("");
	const stats = useMemo(() => analyzeReadability(text), [text]);
	const level = stats.readingEase === null ? "Add a few complete sentences to estimate readability." : stats.readingEase >= 90 ? "Very easy" : stats.readingEase >= 70 ? "Fairly easy" : stats.readingEase >= 60 ? "Plain English" : stats.readingEase >= 30 ? "Difficult" : "Very difficult";
	return <ToolLayout><TextAreaField id="readability-input" label="Text to analyze" value={text} onChange={setText} placeholder="Paste a few sentences for a readability estimate…" hint="Uses the English Flesch formulas and an approximate syllable count. Results are guidance, not a grade or guarantee." /><div className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-4">{[{ label: "Words", value: stats.words.toLocaleString() }, { label: "Sentences", value: stats.sentences.toLocaleString() }, { label: "Reading ease", value: stats.readingEase?.toFixed(1) ?? "—" }, { label: "US grade estimate", value: stats.gradeLevel?.toFixed(1) ?? "—" }].map((metric) => <div className="border-b border-r border-line bg-[#f8f7f3] p-4" key={metric.label}><p className="m-0 font-mono text-[10px] uppercase tracking-wide text-muted">{metric.label}</p><p className="mb-0 mt-2 font-serif text-[31px] leading-none">{metric.value}</p></div>)}</div><p className="m-0 border-l-2 border-accent bg-[#f8f6ef] px-3 py-2.5 text-xs text-[#54554e]" role="status">{level}</p></ToolLayout>;
};
export { ReadabilityCheckerTool };

const MarkdownPreviewTool = () => {
	const [markdown, setMarkdown] = useState("# A small title\n\nWrite **bold** text, `code`, and lists.\n\n- First item\n- Second item\n\n[ClickKit](https://example.com)");
	const renderedMarkdown = useMemo(() => renderSafeMarkdown(markdown), [markdown]);
	return <ToolLayout><div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1"><div><TextAreaField id="markdown-input" label="Markdown" value={markdown} onChange={setMarkdown} placeholder="# Start writing Markdown…" rows={16} hint="Supports headings, paragraphs, bold, italic, inline code, links, unordered lists, rules, and fenced code blocks. Raw HTML is shown as text." /></div><section aria-label="Markdown preview"><h2 className="mb-2 text-xs font-semibold text-[#3c3d37]">Preview</h2><div className="min-h-[182px] overflow-auto border border-[#d9d7cd] bg-surface p-4 text-sm leading-[1.72] [&_a]:text-accent-dark [&_a]:underline [&_code]:bg-[#f0efe9] [&_code]:px-1 [&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:font-serif [&_h1]:text-3xl [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-serif [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:bg-[#f3f2ec] [&_pre]:p-3 [&_ul]:my-3" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} /></section></div><p className="m-0 text-[11px] leading-relaxed text-muted">Preview is rendered locally. HTML is escaped; only safe HTTP(S) links are made clickable.</p></ToolLayout>;
};
export { MarkdownPreviewTool };

const MarkdownTableGeneratorTool = () => {
	const [source, setSource] = useState("Name\tRole\nAri\tDesigner\nSam\tEngineer");
	const [delimiter, setDelimiter] = useState<"tab" | "comma">("tab");
	const table = useMemo(() => createMarkdownTable(source, delimiter), [source, delimiter]);
	return <ToolLayout><div className="flex flex-wrap items-center gap-3"><label className="text-xs font-semibold" htmlFor="markdown-table-delimiter">Input is separated by</label><SelectField containerClassName="relative inline-flex" className="mt-0 h-9 cursor-pointer text-xs" id="markdown-table-delimiter" value={delimiter} onChange={(event) => setDelimiter(event.target.value as "tab" | "comma")}><option value="tab">Tabs</option><option value="comma">Commas (CSV)</option></SelectField></div><TextAreaField id="markdown-table-input" label="Rows to convert" value={source} onChange={setSource} placeholder="Paste tab-separated or comma-separated rows…" rows={8} hint="The first row becomes the table header. For comma-separated input, cells containing commas should be quoted." /><section className="flex flex-col gap-3 border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold">Markdown table</h2><CopyTextButton text={table} /></div><pre className="m-0 overflow-x-auto border border-line bg-[#f6f5f0] p-4 font-mono text-xs leading-relaxed">{table || "Your table will appear here."}</pre></section></ToolLayout>;
};
export { MarkdownTableGeneratorTool };
