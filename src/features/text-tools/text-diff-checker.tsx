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
		<div className="text-tool-workspace">
			<div className="tool-note"><LockKeyhole size={14} aria-hidden="true" /><span>Both passages are compared locally. Very large comparisons are capped to keep the page responsive.</span></div>
			<div className="text-diff-inputs">
				<TextAreaField
					id="text-diff-original"
					label="Original text"
					value={originalText}
					onChange={updateOriginal}
					placeholder="Paste the original passage…"
					rows={9}
				/>
				<TextAreaField
					id="text-diff-revised"
					label="Revised text"
					value={revisedText}
					onChange={updateRevised}
					placeholder="Paste the updated passage…"
					rows={9}
				/>
			</div>
			<div className="diff-action-row">
				<p>Changes are matched by text chunks; line breaks and punctuation are included.</p>
				<button className="primary-button" type="button" onClick={compareTexts}>
					Compare passages <ArrowRight size={15} aria-hidden="true" />
				</button>
			</div>
			{errorMessage && <p className="tool-error" role="alert">{errorMessage}</p>}
			{comparison && !comparisonIsCurrent && <p className="tool-stale-note" role="status">The passages changed. Compare again to refresh the result.</p>}
			{comparisonIsCurrent && comparison && <section className="diff-result" aria-labelledby="diff-result-heading">
				<div className="diff-result-summary" role="status" aria-live="polite">
					<h2 id="diff-result-heading">Comparison</h2>
					{comparison.result.added === 0 && comparison.result.removed === 0
						? <p>The passages are identical.</p>
						: <p><strong>{comparison.result.added}</strong> additions <span aria-hidden="true">·</span> <strong>{comparison.result.removed}</strong> removals</p>}
				</div>
				<div className="diff-result-grid">
					<DiffPane title="Original" side="original" result={comparison.result} />
					<DiffPane title="Revised" side="revised" result={comparison.result} />
				</div>
			</section>}
			{!comparison && !errorMessage && <p className="diff-empty-state">Enter two passages and compare them. Empty passages are valid, too.</p>}
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

	return <section className={`diff-pane diff-pane-${side}`} aria-label={`${title} passage with changes highlighted`}>
		<h3>{title}</h3>
		<p className="diff-content">
			{visibleSegments.length === 0
				? <span className="diff-empty-text">No text</span>
				: visibleSegments.map((segment, index) => {
					if (segment.kind === "removed") return <del key={`${segment.kind}-${index}`}>{segment.text}</del>;
					if (segment.kind === "added") return <ins key={`${segment.kind}-${index}`}>{segment.text}</ins>;
					return <span key={`${segment.kind}-${index}`}>{segment.text}</span>;
				})}
		</p>
	</section>;
};

export default TextDiffChecker;
