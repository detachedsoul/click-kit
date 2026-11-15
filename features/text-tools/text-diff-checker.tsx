"use client";

import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { diffText, type TextDiffResult } from "@/features/text-tools/text-utils";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

type Comparison = {
	originalText: string;
	revisedText: string;
	result: TextDiffResult;
};

const TextDiffChecker = () => {
	const [originalText, setOriginalText] = useState("");
	const [revisedText, setRevisedText] = useState("");
	const [comparison, setComparison] = useState<Comparison | null>(null);
	const [errorMessage, setErrorMessage] = useState("");
	const comparisonIsCurrent = comparison?.originalText === originalText && comparison.revisedText === revisedText;

	const compareTexts = () => {
		try {
			setComparison({ originalText, revisedText, result: diffText(originalText, revisedText) });
			setErrorMessage("");
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "These passages could not be compared.");
			setComparison(null);
		}
	};

	const updateOriginal = (nextText: string) => {
		setOriginalText(nextText);
		setErrorMessage("");
	};

	const updateRevised = (nextText: string) => {
		setRevisedText(nextText);
		setErrorMessage("");
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5 max-[520px]:pb-4">
				<div>
					<p className="mb-1.5 font-mono text-[10px] uppercase tracking-[.08em] text-accent-dark">Text comparison</p>
					<h2 className="m-0 font-serif text-[30px] font-normal leading-none tracking-[-.025em] max-[520px]:text-[26px]">Two versions, one clear view.</h2>
				</div>
				<div className="inline-flex items-center gap-2 border border-[#d9e1d2] bg-[#f0f3ec] px-2.5 py-[7px] text-[11px] leading-[1.45] text-[#4d6250]">
					<LockKeyhole className="shrink-0" size={14} aria-hidden="true" /><span>No character limit. Your text stays on this device.</span>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-[14px] max-[760px]:grid-cols-1">
				<section className="min-w-0 border border-line bg-[#f8f7f3] p-[13px]" aria-label="Original passage editor">
					<div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center bg-[#e9e4d8] font-mono text-[10px] text-[#5c5a4f]">01</span><span className="font-mono text-[10px] uppercase tracking-[.06em] text-[#77786f]">Before</span></div>
					<TextAreaField id="text-diff-original" label="Original text" value={originalText} onChange={updateOriginal} placeholder="Paste the original passage…" rows={9} />
				</section>
				<section className="min-w-0 border border-line bg-[#f8f7f3] p-[13px]" aria-label="Revised passage editor">
					<div className="mb-3 flex items-center gap-2"><span className="grid size-6 place-items-center bg-[#dce7d7] font-mono text-[10px] text-[#405a3b]">02</span><span className="font-mono text-[10px] uppercase tracking-[.06em] text-[#577053]">After</span></div>
					<TextAreaField id="text-diff-revised" label="Revised text" value={revisedText} onChange={updateRevised} placeholder="Paste the updated passage…" rows={9} />
				</section>
			</div>
			<div className="flex items-center justify-between gap-[18px] max-[520px]:items-stretch max-[520px]:flex-col">
				<p className="m-0 text-[11px] leading-[1.5] text-muted">Changes are matched by text chunks; line breaks and punctuation are included.</p>
				<button className="inline-flex min-h-10 shrink-0 items-center justify-center gap-[9px] border border-forest bg-forest px-[14px] text-xs text-white transition-colors hover:bg-[#354d44] max-[520px]:w-full" type="button" onClick={compareTexts}>
					Compare passages <ArrowRight size={15} aria-hidden="true" />
				</button>
			</div>
			{errorMessage && <p className="-mt-[9px] mb-0 border-l-[3px] border-accent-dark bg-[#fbefea] px-3 py-[9px] text-xs leading-[1.5] text-[#71301f]" role="alert">{errorMessage}</p>}
			{comparison && !comparisonIsCurrent && <p className="-mt-[9px] mb-0 text-xs text-[#6e5e27]" role="status">The passages changed. Compare again to refresh the result.</p>}
			{comparisonIsCurrent && comparison && <section className="border-t border-line pt-[18px]" aria-labelledby="diff-result-heading">
				<div className="mb-[13px] flex items-baseline justify-between gap-[15px] max-[520px]:flex-col max-[520px]:items-start max-[520px]:gap-[7px]" role="status" aria-live="polite">
					<h2 id="diff-result-heading" className="m-0 text-sm font-semibold tracking-[-.02em]">Comparison</h2>
					{comparison.result.added === 0 && comparison.result.removed === 0
						? <p className="m-0 text-xs text-[#686961]">The passages are identical.</p>
						: <p className="m-0 text-xs text-[#686961]"><strong className="font-bold text-ink">{comparison.result.added}</strong> additions <span aria-hidden="true">·</span> <strong className="font-bold text-ink">{comparison.result.removed}</strong> removals</p>}
				</div>
				<div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
					<DiffPane title="Original" side="original" result={comparison.result} />
					<DiffPane title="Revised" side="revised" result={comparison.result} />
				</div>
			</section>}
			{!comparison && !errorMessage && <p className="-mt-1.5 mb-0 text-xs text-muted">Enter two passages and compare them. Empty passages are valid, too.</p>}
		</div>
	);
};

type DiffPaneProps = {
	title: string;
	side: "original" | "revised";
	result: TextDiffResult;
};

const DiffPane = ({ title, side, result }: DiffPaneProps) => {
	const visibleKinds = side === "original" ? ["same", "removed"] : ["same", "added"];
	const visibleSegments = result.segments.filter((segment) => visibleKinds.includes(segment.kind));

	return <section className="min-w-0 border border-line bg-surface" aria-label={`${title} passage with changes highlighted`}>
		<h3 className="m-0 border-b border-line px-3 py-2.5 text-[11px] font-semibold text-[#54554e]">{title}</h3>
		<p className="m-0 max-h-[390px] min-h-28 overflow-auto whitespace-pre-wrap break-words p-[13px] font-mono text-xs leading-[1.8] text-[#383933]">
			{visibleSegments.length === 0
				? <span className="font-sans italic text-[#92928a]">No text</span>
				: visibleSegments.map((segment, index) => {
					if (segment.kind === "removed") return <del className="bg-[#f5ded7] text-[#762d1d] decoration-1" key={`${segment.kind}-${index}`}>{segment.text}</del>;
					if (segment.kind === "added") return <ins className="bg-[#dcebd8] text-[#284c25] decoration-1" key={`${segment.kind}-${index}`}>{segment.text}</ins>;
					return <span key={`${segment.kind}-${index}`}>{segment.text}</span>;
				})}
		</p>
	</section>;
};

export default TextDiffChecker;
