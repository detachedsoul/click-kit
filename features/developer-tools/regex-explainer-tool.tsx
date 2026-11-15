"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { CheckboxField, ToolPanel } from "@/features/developer-tools/tool-ui";
import { explainRegexFlags, findCommonRegexIssues, parseRegex, type RegexNode, type RegexToken } from "@/features/developer-tools/regex-explainer-utils";

type RegexMatch = { text: string; index: number; captures: Array<string | undefined> };

const matchingWorker = `onmessage = ({ data }) => {\n  try {\n    const flags = data.flags.includes('g') ? data.flags : data.flags + 'g';\n    const expression = new RegExp(data.pattern, flags);\n    const matches = [];\n    let match;\n    while ((match = expression.exec(data.text)) && matches.length < 100) {\n      matches.push({ text: match[0], index: match.index, captures: match.slice(1) });\n    }\n    postMessage({ matches });\n  } catch (error) { postMessage({ error: error instanceof Error ? error.message : 'The browser could not run this expression.' }); }\n};`;

const runRegexInWorker = (pattern: string, text: string, flags: string) => new Promise<RegexMatch[]>((resolve, reject) => {
	if (typeof Worker === "undefined" || typeof URL.createObjectURL !== "function") {
		reject(new Error("This browser does not support the isolated regex worker needed to protect the page from slow expressions."));
		return;
	}
	let worker: Worker;
	let workerUrl = "";
	try {
		workerUrl = URL.createObjectURL(new Blob([matchingWorker], { type: "text/javascript" }));
		worker = new Worker(workerUrl);
	} catch {
		if (workerUrl) URL.revokeObjectURL(workerUrl);
		reject(new Error("The browser blocked the isolated regex worker. Check its content security policy, then try another pattern."));
		return;
	}
	const timeout = window.setTimeout(() => {
		worker.terminate();
		URL.revokeObjectURL(workerUrl);
		reject(new Error("This expression took too long to run and was stopped. Try a simpler pattern or shorter sample text."));
	}, 700);
	worker.onmessage = (event: MessageEvent<{ matches?: RegexMatch[]; error?: string }>) => {
		window.clearTimeout(timeout);
		worker.terminate();
		URL.revokeObjectURL(workerUrl);
		if (event.data.error) reject(new Error(event.data.error));
		else resolve(event.data.matches ?? []);
	};
	worker.onerror = () => {
		window.clearTimeout(timeout);
		worker.terminate();
		URL.revokeObjectURL(workerUrl);
		reject(new Error("The browser could not run this expression in its isolated worker."));
	};
	worker.postMessage({ pattern, text, flags });
});

const nodeColor = (node: RegexNode) => node.kind === "group" ? "border-[#5d7257] bg-[#e8eee4]" : node.kind === "quantifier" ? "border-[#a57b36] bg-[#f7eedb]" : node.kind === "alternation" ? "border-[#78628c] bg-[#eee9f3]" : "border-line bg-[#f8f7f3]";

const ExpressionNode = ({ node, depth = 0 }: { node: RegexNode; depth?: number }) => (
	<li className="min-w-0 list-none">
		<div className={`flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 border px-3 py-2 ${nodeColor(node)}`} style={{ marginLeft: depth ? 12 : 0 }}>
			<strong className="text-[11px]">{node.label}</strong>
			{node.raw && <code className="break-all font-mono text-[11px]">{node.raw}</code>}
			<span className="text-[11px] leading-relaxed text-muted">{node.explanation}</span>
		</div>
		{node.children.length > 0 && <ul className="m-0 flex flex-col gap-1 border-l border-line py-1 pl-2">{node.children.map((child) => <ExpressionNode depth={depth + 1} key={child.id} node={child} />)}</ul>}
	</li>
);

const TokenCard = ({ token }: { token: RegexToken }) => (
	<li className={`flex min-w-0 flex-col gap-1 border p-2.5 ${token.groupNumber ? "border-[#5d7257] bg-[#e8eee4]" : "border-line bg-surface"}`}>
		<code className="break-all font-mono text-xs">{token.raw || "(empty)"}</code>
		<span className="text-[10px] leading-relaxed text-muted">{token.explanation}{token.groupNumber ? ` In capture group ${token.groupNumber}.` : ""}</span>
	</li>
);

const samplePattern = "^(?<name>[A-Za-z]+)\\s+([\\w.+-]+@[\\w-]+\\.[A-Za-z]{2,})$";
const sampleText = "Ari ari@example.com\nClickKit hello@clickkit.dev\nNot an email address";

export const RegexExplainerTool = () => {
	const [pattern, setPattern] = useState(samplePattern);
	const [source, setSource] = useState(sampleText);
	const [flags, setFlags] = useState<string[]>(["i", "m"]);
	const [matches, setMatches] = useState<RegexMatch[]>([]);
	const [matchError, setMatchError] = useState("");
	const [analyzed, setAnalyzed] = useState(false);
	const parsed = useMemo(() => {
		try {
			const result = parseRegex(pattern);
			new RegExp(pattern, [...new Set(flags)].join(""));
			return { result, error: "" };
		} catch (error) {
			return { result: null, error: error instanceof Error ? error.message : "This expression could not be parsed." };
		}
	}, [pattern, flags]);
	const issues = useMemo(() => findCommonRegexIssues(pattern), [pattern]);
	const flagExplanations = useMemo(() => explainRegexFlags(flags), [flags]);
	const parseResult = parsed.result;
	const updatePattern = (value: string) => { setPattern(value); setAnalyzed(false); setMatches([]); setMatchError(""); };
	const analyzeMatches = async () => {
		setAnalyzed(true);
		setMatches([]);
		setMatchError("");
		if (parsed.error) { setMatchError(parsed.error); return; }
		if (source.length > 30_000) { setMatchError("Keep the sample text under 30,000 characters for a quick, isolated test."); return; }
		try { setMatches(await runRegexInWorker(pattern, source, flags.join(""))); }
		catch (error) { setMatchError(error instanceof Error ? error.message : "The browser could not test this expression."); }
	};
	const toggleFlag = (flag: string, checked: boolean) => {
		setFlags((current) => checked ? [...current, flag] : current.filter((item) => item !== flag));
		setAnalyzed(false);
	};
	return <ToolPanel>
		<div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,.9fr)] gap-5 max-[760px]:grid-cols-1">
			<div className="flex flex-col gap-4">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="regex-explainer-pattern">Regular expression<input className="mt-2 block h-11 w-full border border-field bg-surface px-3 font-mono text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="regex-explainer-pattern" value={pattern} onChange={(event) => updatePattern(event.target.value)} placeholder="For example: ^\\w+@\\w+\\.com$" /></label>
				<fieldset className="flex flex-wrap gap-x-4 gap-y-2 border border-line bg-[#f8f7f3] px-4 py-3"><legend className="px-1 text-xs font-semibold">Browser regex flags</legend>{[["i", "Ignore case"], ["m", "Multiline"], ["s", "Dot matches newline"], ["u", "Unicode"], ["y", "Sticky"]].map(([flag, label]) => <CheckboxField checked={flags.includes(flag)} key={flag} label={label} onChange={(checked) => toggleFlag(flag, checked)} />)}</fieldset>
			</div>
			<TextAreaField id="regex-explainer-text" label="Example text" value={source} onChange={(value) => { setSource(value); setAnalyzed(false); }} placeholder="Enter sample text to test against…" rows={7} hint="Text stays in your browser. Match execution is isolated in a short-lived worker." />
		</div>
			{parsed.error || !parseResult ? <p className="m-0 border-l-2 border-[#a34d37] bg-[#fbf1ee] p-3 text-xs leading-relaxed text-[#8a3f30]" role="alert">{parsed.error || "This expression could not be parsed."}</p> : <>
			<section className="flex flex-col gap-3" aria-label="Parsed expression">
				<div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-sm font-semibold">Parsed expression</h2><span className="text-[10px] text-muted">{parseResult.tokens.length} tokens · {parseResult.groups.length} capture groups</span></div>
				<div className="flex flex-wrap gap-1 border border-line bg-[#f8f7f3] p-3" aria-label="Tokenized pattern">{parseResult.tokens.map((token) => <span className={`border px-1.5 py-1 font-mono text-xs ${token.groupNumber ? "border-[#5d7257] bg-[#e8eee4]" : "border-line bg-surface"}`} key={token.id} title={token.explanation}>{token.raw}</span>)}</div>
				{parseResult.groups.length > 0 && <p className="m-0 text-[11px] text-muted">Green tokens belong to capture groups: {parseResult.groups.map((group) => `#${group.number} ${group.label}`).join(" · ")}.</p>}
			</section>
			<section className="flex flex-col gap-3" aria-label="Token explanations"><h2 className="m-0 text-sm font-semibold">What each token means</h2><ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 p-0">{parseResult.tokens.map((token) => <TokenCard key={token.id} token={token} />)}</ul></section>
			<section className="flex flex-col gap-3" aria-label="Expression tree"><h2 className="m-0 text-sm font-semibold">Expression tree</h2><ul className="m-0 flex flex-col gap-1 p-0"><ExpressionNode node={parseResult.tree} /></ul></section>
		</>}
		{issues.length > 0 && <section className="flex flex-col gap-2 border-l-2 border-[#a57b36] bg-[#fbf6eb] p-4" aria-label="Common regex mistakes"><h2 className="m-0 text-sm font-semibold">Things to double-check</h2><ul className="m-0 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-muted">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></section>}
		<section className="flex flex-col gap-3 border-t border-line pt-4" aria-label="Matching examples">
			<div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="m-0 text-sm font-semibold">Try matching examples</h2><p className="mb-0 mt-1 text-[11px] text-muted">{flagExplanations.join(" ") || "Global matching is enabled automatically to show all results."}</p></div><button className="min-h-9 cursor-pointer bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="button" onClick={analyzeMatches} disabled={Boolean(parsed.error)}>{analyzed ? "Analyze again" : "Analyze matches"}</button></div>
			{matchError && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{matchError}</p>}
			{analyzed && !matchError && <div aria-live="polite" className="flex flex-col gap-2"><p className="m-0 text-xs font-semibold">{matches.length} match{matches.length === 1 ? "" : "es"}{matches.length === 100 ? " (showing the first 100)" : ""}</p>{matches.length ? <ol className="m-0 max-h-64 space-y-2 overflow-auto pl-5 font-mono text-xs">{matches.map((match, index) => <li className="break-all" key={`${match.index}-${index}`}><mark className="bg-[#f2d797]">{match.text || "(empty match)"}</mark><span className="ml-2 text-muted">at character {match.index + 1}</span>{match.captures.map((capture, captureIndex) => <p className="mb-0 mt-1 text-muted" key={`${captureIndex}-${capture}`}>Group {captureIndex + 1}: {capture ?? "(no match)"}</p>)}</li>)}</ol> : <p className="m-0 text-xs text-muted">No matches found in the sample text.</p>}</div>}
		</section>
		<p className="m-0 text-[11px] leading-relaxed text-muted">This explainer uses your browser’s native JavaScript regular-expression engine. Its simplified parser covers common JavaScript regex syntax; browser validation is authoritative for syntax it does not explain. Matching stops after 700 ms to help protect the page from expensive patterns.</p>
	</ToolPanel>;
};
