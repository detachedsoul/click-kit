"use client";

import { useMemo, useRef, useState } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { countGraphemes } from "@/features/text-tools/text-utils";
import { createSlug, decodeHtmlEntities, decodeUrlComponent, encodeHtmlEntities, encodeUrlComponent, findAndReplaceText, generateLoremIpsum, inspectUnicodeText, reverseGraphemes, sortTextLines, splitTextMatches } from "@/features/text-tools/extra-text-utils";
import { CheckboxField } from "@/features/developer-tools/tool-ui";

const ToolLayout = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">{children}</div>;
const ResultPanel = ({ label, value }: { label: string; value: string }) => <section className="flex flex-col gap-[11px] border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold tracking-[-.02em]">{label}</h2><CopyTextButton text={value} /></div><TextAreaField id={`${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-result`} label="Result" value={value} onChange={() => undefined} placeholder="Your result will appear here." rows={7} readOnly /></section>;

type FindReplaceSegment = { text: string; isMatch: boolean; matchIndex?: number };

type FindReplaceInputProps = {
	text: string;
	onChange: (value: string) => void;
	segments: FindReplaceSegment[];
	matchCount: number;
	activeMatchIndex: number;
	onActiveMatchChange: (index: number) => void;
};

const FindReplaceInput = ({ text, onChange, segments, matchCount, activeMatchIndex, onActiveMatchChange }: FindReplaceInputProps) => {
	const highlightLayerRef = useRef<HTMLPreElement>(null);
	const textAreaRef = useRef<HTMLTextAreaElement>(null);
	const placeholder = "Paste or type the text to update…";
	const navigateMatch = (direction: -1 | 1) => {
		if (matchCount === 0) return;
		const nextIndex = (activeMatchIndex + direction + matchCount) % matchCount;
		onActiveMatchChange(nextIndex);
		const matchElement = highlightLayerRef.current?.querySelector<HTMLElement>(`[data-match-index="${nextIndex}"]`);
		matchElement?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
		if (textAreaRef.current && highlightLayerRef.current) {
			textAreaRef.current.scrollTop = highlightLayerRef.current.scrollTop;
			textAreaRef.current.scrollLeft = highlightLayerRef.current.scrollLeft;
		}
	};
	return <div className="min-w-0">
		<div className="mb-2 flex items-baseline justify-between gap-3"><label className="text-xs font-semibold text-[#3c3d37]" htmlFor="find-replace-input">Text</label><span className="font-mono text-[10px] text-[#5f6259]">{countGraphemes(text).toLocaleString()} characters</span></div>
		<div className="relative min-h-[182px] max-[520px]:min-h-[150px]">
			<pre ref={highlightLayerRef} className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words border border-field bg-surface px-4 py-[15px] pr-[30px] text-sm leading-[1.72] text-ink max-[520px]:px-[11px] max-[520px]:py-[11px] max-[520px]:pr-[25px] max-[520px]:text-xs" aria-hidden="true">{text ? segments.map((segment, index) => segment.isMatch ? <mark className={segment.matchIndex === activeMatchIndex ? "bg-[#efc86e] text-ink underline decoration-[#72500f] decoration-2 underline-offset-2 ring-1 ring-[#72500f]" : "bg-[#f2d797] text-ink underline decoration-[#9e6f17] decoration-2 underline-offset-2"} data-active-match={segment.matchIndex === activeMatchIndex} data-match-index={segment.matchIndex} key={`${index}-${segment.text}`}>{segment.text}</mark> : <span key={`${index}-${segment.text}`}>{segment.text}</span>) : <span className="text-[#5f6259]">{placeholder}</span>}</pre>
			<textarea
				ref={textAreaRef}
				id="find-replace-input"
				className="relative z-10 block min-h-[182px] w-full resize-y border border-field bg-transparent px-4 py-[15px] pr-[30px] text-sm leading-[1.72] text-transparent caret-ink outline-2 outline-offset-2 outline-transparent transition-[border-color,outline-color] selection:bg-accent/20 selection:text-transparent focus:border-accent focus:outline-accent placeholder:text-transparent max-[520px]:min-h-[150px] max-[520px]:px-[11px] max-[520px]:py-[11px] max-[520px]:pr-[25px] max-[520px]:text-xs"
				value={text}
				onChange={(event) => onChange(event.target.value)}
				placeholder=""
				rows={9}
				onScroll={(event) => {
					if (highlightLayerRef.current) {
						highlightLayerRef.current.scrollTop = event.currentTarget.scrollTop;
						highlightLayerRef.current.scrollLeft = event.currentTarget.scrollLeft;
					}
				}}
			/>
		</div>
		<div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-muted" aria-live="polite">{matchCount > 0 ? `Match ${activeMatchIndex + 1} of ${matchCount}` : "No matches"}</span><div className="flex gap-2" role="group" aria-label="Search match navigation"><button className="min-h-8 cursor-pointer border border-line bg-surface px-2.5 text-[11px] text-[#54554e] hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={() => navigateMatch(-1)} disabled={matchCount === 0} aria-label="Previous match">Previous</button><button className="min-h-8 cursor-pointer border border-line bg-surface px-2.5 text-[11px] text-[#54554e] hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={() => navigateMatch(1)} disabled={matchCount === 0} aria-label="Next match">Next</button></div></div>
		<p className="mb-0 mt-[7px] text-[11px] leading-[1.5] text-muted">Matches are highlighted in the text above as you type.</p>
	</div>;
};

const FindReplaceTool = () => {
	const [text, setText] = useState("");
	const [search, setSearch] = useState("");
	const [replacement, setReplacement] = useState("");
	const [useRegex, setUseRegex] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [wholeWord, setWholeWord] = useState(false);
	const [activeMatchIndex, setActiveMatchIndex] = useState(0);
	const result = useMemo(() => {
		try {
			return { ...findAndReplaceText(text, search, replacement, { useRegex, caseSensitive, wholeWord }), error: "" };
		} catch (error) {
			return { text, matches: 0, error: error instanceof Error ? error.message : "Invalid search pattern." };
		}
	}, [text, search, replacement, useRegex, caseSensitive, wholeWord]);
	const highlightedSegments = useMemo(() => {
		try {
			return splitTextMatches(text, search, { useRegex, caseSensitive, wholeWord });
		} catch {
			return [{ text, isMatch: false }];
		}
	}, [text, search, useRegex, caseSensitive, wholeWord]);
	const indexedSegments = useMemo(() => {
		let matchIndex = 0;
		return highlightedSegments.map((segment) => segment.isMatch ? { ...segment, matchIndex: matchIndex++ } : segment);
	}, [highlightedSegments]);
	const currentMatchIndex = result.matches > 0 ? Math.min(activeMatchIndex, result.matches - 1) : 0;
	return <ToolLayout>
		<div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1"><label className="text-xs font-semibold text-[#3c3d37]">Find<input className="mt-2 block h-10 w-full border border-line bg-surface px-3 text-sm outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" value={search} onChange={(event) => { setSearch(event.target.value); setActiveMatchIndex(0); }} /></label><label className="text-xs font-semibold text-[#3c3d37]">Replace with<input className="mt-2 block h-10 w-full border border-line bg-surface px-3 text-sm outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" value={replacement} onChange={(event) => setReplacement(event.target.value)} /></label></div>
		<fieldset className="flex flex-wrap gap-x-5 gap-y-3 border border-line bg-[#f8f7f3] px-4 py-3"><legend className="px-1 text-xs font-semibold">Match options</legend>{[{ label: "Regular expression", value: useRegex, change: setUseRegex }, { label: "Match case", value: caseSensitive, change: setCaseSensitive }, { label: "Whole word", value: wholeWord, change: setWholeWord }].map((option) => <CheckboxField checked={option.value} key={option.label} label={option.label} onChange={(next) => { option.change(next); setActiveMatchIndex(0); }} />)}</fieldset>
		<FindReplaceInput text={text} onChange={(value) => { setText(value); setActiveMatchIndex(0); }} segments={indexedSegments} matchCount={result.matches} activeMatchIndex={currentMatchIndex} onActiveMatchChange={setActiveMatchIndex} />
		<p className="m-0 text-xs text-muted" role="status">{result.error || `${result.matches} match${result.matches === 1 ? "" : "es"} found. Replacement preview is below.`}</p>
		<ResultPanel label="Updated text" value={result.text} />
	</ToolLayout>;
};
export { FindReplaceTool };

const LineSorterTool = () => {
	const [text, setText] = useState("");
	const [descending, setDescending] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [removeDuplicates, setRemoveDuplicates] = useState(false);
	const [removeBlankLines, setRemoveBlankLines] = useState(false);
	const result = useMemo(() => sortTextLines(text, { descending, caseSensitive, removeDuplicates, removeBlankLines }), [text, descending, caseSensitive, removeDuplicates, removeBlankLines]);
	return <ToolLayout><TextAreaField id="line-sort-input" label="Lines to sort" value={text} onChange={setText} placeholder="Paste a list, one item per line…" /><fieldset className="grid grid-cols-2 gap-x-5 gap-y-3 border border-line bg-[#f8f7f3] px-4 py-3 max-[520px]:grid-cols-1"><legend className="px-1 text-xs font-semibold">Sorting options</legend>{[{ label: "Descending order", value: descending, change: setDescending }, { label: "Match case", value: caseSensitive, change: setCaseSensitive }, { label: "Remove duplicate lines", value: removeDuplicates, change: setRemoveDuplicates }, { label: "Remove blank lines", value: removeBlankLines, change: setRemoveBlankLines }].map((option) => <CheckboxField checked={option.value} key={option.label} label={option.label} onChange={option.change} />)}</fieldset><ResultPanel label="Sorted lines" value={result} /></ToolLayout>;
};
export { LineSorterTool };

const SlugGeneratorTool = () => {
	const [text, setText] = useState("");
	return <ToolLayout><TextAreaField id="slug-input" label="Title or phrase" value={text} onChange={setText} placeholder="For example: A Guide to Better Writing" rows={5} hint="Accents are normalized; letters from other writing systems are kept." /><ResultPanel label="URL-friendly slug" value={createSlug(text)} /></ToolLayout>;
};
export { SlugGeneratorTool };

const HtmlEntityTool = () => {
	const [text, setText] = useState("");
	const [direction, setDirection] = useState<"encode" | "decode">("encode");
	const result = direction === "encode" ? encodeHtmlEntities(text) : decodeHtmlEntities(text);
	return <ToolLayout><div className="flex flex-wrap gap-2" role="group" aria-label="HTML entity action">{(["encode", "decode"] as const).map((action) => <button className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === action ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#5f6259]"}`} key={action} type="button" aria-pressed={direction === action} onClick={() => setDirection(action)}>{action === "encode" ? "Encode entities" : "Decode entities"}</button>)}</div><TextAreaField id="html-entity-input" label="Text or entities" value={text} onChange={setText} placeholder="Enter text containing <, >, &, or HTML entities…" /><ResultPanel label={direction === "encode" ? "Encoded text" : "Decoded text"} value={result} /></ToolLayout>;
};
export { HtmlEntityTool };

const UrlEncoderTool = () => {
	const [text, setText] = useState("");
	const [direction, setDirection] = useState<"encode" | "decode">("encode");
	const result = useMemo(() => {
		try {
			return { text: direction === "encode" ? encodeUrlComponent(text) : decodeUrlComponent(text), error: "" };
		} catch {
			return { text: "", error: "This contains an invalid percent-encoded sequence. Check the input and try again." };
		}
	}, [text, direction]);
	return <ToolLayout><div className="flex flex-wrap gap-2" role="group" aria-label="URL encoding action">{(["encode", "decode"] as const).map((action) => <button className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === action ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#5f6259]"}`} key={action} type="button" aria-pressed={direction === action} onClick={() => setDirection(action)}>{action === "encode" ? "Encode component" : "Decode component"}</button>)}</div><TextAreaField id="url-encode-input" label="Text or URL component" value={text} onChange={setText} placeholder="Enter text to safely use inside a URL…" /><p className="m-0 text-xs leading-relaxed text-muted">Encodes a URL component, not a full URL. Existing URL separators such as ? and & are encoded too.</p>{result.error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p>}<ResultPanel label={direction === "encode" ? "Encoded component" : "Decoded text"} value={result.text} /></ToolLayout>;
};
export { UrlEncoderTool };

const TextReverserTool = () => {
	const [text, setText] = useState("");
	return <ToolLayout><TextAreaField id="reverse-input" label="Text to reverse" value={text} onChange={setText} placeholder="Type or paste text…" hint="Characters are reversed without splitting emoji or combined accents." /><ResultPanel label="Reversed text" value={reverseGraphemes(text)} /></ToolLayout>;
};
export { TextReverserTool };

const LoremGeneratorTool = () => {
	const [paragraphs, setParagraphs] = useState(2);
	const [wordsPerParagraph, setWordsPerParagraph] = useState(45);
	const result = useMemo(() => generateLoremIpsum(paragraphs, wordsPerParagraph), [paragraphs, wordsPerParagraph]);
	return <ToolLayout><div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1"><label className="text-xs font-semibold text-[#3c3d37]">Paragraphs<input className="mt-2 block h-10 w-full border border-line bg-surface px-3 text-sm outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" type="number" min={1} max={20} value={paragraphs} onChange={(event) => setParagraphs(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} /></label><label className="text-xs font-semibold text-[#3c3d37]">Words per paragraph<input className="mt-2 block h-10 w-full border border-line bg-surface px-3 text-sm outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" type="number" min={5} max={200} value={wordsPerParagraph} onChange={(event) => setWordsPerParagraph(Math.min(200, Math.max(5, Number(event.target.value) || 5)))} /></label></div><ResultPanel label="Placeholder text" value={result} /></ToolLayout>;
};
export { LoremGeneratorTool };

const UnicodeInspectorTool = () => {
	const [text, setText] = useState("");
	const characters = useMemo(() => inspectUnicodeText(text), [text]);
	const copiedValues = characters.map(({ codePoint }) => codePoint).join(" ");
	return <ToolLayout><TextAreaField id="unicode-input" label="Text to inspect" value={text} onChange={setText} placeholder="Paste text, symbols, emoji, or accented characters…" rows={5} hint="Shows Unicode code points. A visible symbol may contain multiple code points." /><div className="overflow-x-auto border border-line"><table className="w-full min-w-[420px] border-collapse text-left text-xs"><thead className="bg-[#f3f2ec] text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-3 py-2.5">Character</th><th className="px-3 py-2.5">Code point</th><th className="px-3 py-2.5">Decimal</th></tr></thead><tbody>{characters.map(({ character, codePoint, decimal }, index) => <tr className="border-t border-line" key={`${codePoint}-${index}`}><td className="px-3 py-2 font-serif text-lg">{character.trim() ? character : "␠"}</td><td className="px-3 py-2 font-mono">{codePoint}</td><td className="px-3 py-2 font-mono">{decimal}</td></tr>)}</tbody></table>{characters.length === 0 && <p className="m-0 p-4 text-xs text-muted">Enter text to inspect its Unicode code points.</p>}</div><div className="flex justify-end"><CopyTextButton text={copiedValues} /></div></ToolLayout>;
};
export { UnicodeInspectorTool };
