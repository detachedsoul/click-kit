"use client";

import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { countText } from "@/features/text-tools/text-utils";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

const WordCounter = () => {
	const [text, setText] = useState("");
	const statistics = useMemo(() => countText(text), [text]);
	let readingTime = "—";
	if (statistics.words > 0) {
		readingTime = `About ${statistics.readingMinutes} min`;
		if (statistics.words < 200) readingTime = "Under 1 min";
	}
	const metrics = [
		{ label: "Words", value: statistics.words.toLocaleString() },
		{ label: "Characters", value: statistics.charactersWithSpaces.toLocaleString() },
		{ label: "Characters · no spaces", value: statistics.charactersWithoutSpaces.toLocaleString() },
		{ label: "Reading time", value: readingTime },
	];

	return (
		<div className="text-tool-workspace">
			<div className="tool-note"><LockKeyhole size={14} aria-hidden="true" /><span>Everything is counted locally in your browser.</span></div>
			<TextAreaField
				id="word-counter-input"
				label="Your text"
				value={text}
				onChange={setText}
				placeholder="Paste or write something here…"
				rows={11}
				showCharacterCount={false}
			/>
			<section aria-label="Live text statistics" aria-live="polite" aria-atomic="true">
				<dl className="text-metrics">
					{metrics.map((metric) => <div className="text-metric" key={metric.label}>
						<dt>{metric.label}</dt><dd>{metric.value}</dd>
					</div>)}
				</dl>
			</section>
			<p className="tool-footnote">Reading time is an estimate based on 200 words per minute.</p>
		</div>
	);
};

export default WordCounter;
