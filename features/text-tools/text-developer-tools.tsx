"use client";

import { SelectField } from "@/components/select-field";

import { useMemo, useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { extractTextItems, formatTextDocument } from "@/features/text-tools/extra-text-utils";

const ToolLayout = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">{children}</div>;

const TextExtractorTool = () => {
	const [text, setText] = useState("");
	const [kind, setKind] = useState<"emails" | "urls" | "phones" | "hashtags">("emails");
	const results = useMemo(() => extractTextItems(text, kind), [text, kind]);
	return <ToolLayout><div className="flex flex-wrap items-center gap-3"><label className="text-xs font-semibold" htmlFor="extractor-kind">Extract</label><SelectField containerClassName="relative inline-flex" className="mt-0 h-10 cursor-pointer text-xs" id="extractor-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="emails">Email addresses</option><option value="urls">Web links</option><option value="phones">Phone-like numbers</option><option value="hashtags">Hashtags</option></SelectField></div><TextAreaField id="extractor-input" label="Source text" value={text} onChange={setText} placeholder="Paste a document or message to find matching items…" /><section className="flex flex-col gap-3 border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold">{results.length} unique result{results.length === 1 ? "" : "s"}</h2><CopyTextButton text={results.join("\n")} /></div>{results.length ? <ol className="m-0 max-h-[360px] list-decimal space-y-1 overflow-y-auto border border-line bg-[#f8f7f3] p-4 pl-9 font-mono text-xs">{results.map((result, index) => <li className="break-all pl-1" key={`${result}-${index}`}>{result}</li>)}</ol> : <p className="m-0 border border-dashed border-line p-5 text-center text-xs text-muted">Matching items will appear here.</p>}</section></ToolLayout>;
};
export { TextExtractorTool };

const MarkupFormatterTool = () => {
	const [source, setSource] = useState("");
	const [format, setFormat] = useState<"html" | "xml">("html");
	const [indentation, setIndentation] = useState(2);
	const [result, setResult] = useState("");
	const [error, setError] = useState("");
	const formatDocument = () => {
		try {
			setResult(formatTextDocument(source, format, indentation));
			setError("");
		} catch (formatError) {
			setResult("");
			setError(formatError instanceof Error ? formatError.message : "Could not format this input.");
		}
	};
	const placeholder = format === "xml" ? "<note><title>Example</title></note>" : "<main><h1>Example</h1><p>Markup</p></main>";
	return <ToolLayout><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-semibold" htmlFor="formatter-type">Format<SelectField containerClassName="relative inline-flex" className="mt-0 h-9 cursor-pointer text-xs" id="formatter-type" value={format} onChange={(event) => { setFormat(event.target.value as typeof format); setResult(""); setError(""); }}><option value="html">HTML</option><option value="xml">XML</option></SelectField></label><label className="flex items-center gap-2 text-xs font-semibold" htmlFor="formatter-indent">Indent<SelectField containerClassName="relative inline-flex" className="mt-0 h-9 cursor-pointer text-xs" id="formatter-indent" value={indentation} onChange={(event) => setIndentation(Number(event.target.value))}><option value={2}>2 spaces</option><option value={4}>4 spaces</option></SelectField></label></div><TextAreaField id="formatter-input" label={`${format.toUpperCase()} input`} value={source} onChange={setSource} placeholder={placeholder} rows={11} /><div className="flex flex-wrap items-center gap-3"><button className="min-h-10 cursor-pointer bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] disabled:cursor-not-allowed disabled:bg-[#b8b9b1]" type="button" onClick={formatDocument} disabled={!source.trim()}>Format</button>{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}</div>{result && <section className="flex flex-col gap-3 border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold">Formatted {format.toUpperCase()}</h2><CopyTextButton text={result} /></div><pre className="m-0 max-h-[480px] overflow-auto border border-line bg-[#f6f5f0] p-4 font-mono text-xs leading-relaxed">{result}</pre></section>}<p className="m-0 text-[11px] leading-relaxed text-muted">Formatting happens in this browser. XML is checked for well-formedness; HTML fragments are parsed and normalized by the browser. For JSON, use the dedicated JSON formatter.</p></ToolLayout>;
};
export { MarkupFormatterTool };
