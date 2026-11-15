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
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="inline-flex max-w-full self-start items-center gap-2 border border-[#d9e1d2] bg-[#f0f3ec] px-2.5 py-[7px] text-[11px] leading-[1.45] text-[#4d6250]">
				<LockKeyhole className="shrink-0" size={14} aria-hidden="true" /><span>Everything is counted locally in your browser.</span>
			</div>
			<TextAreaField id="word-counter-input" label="Your text" value={text} onChange={setText} placeholder="Paste or write something here…" rows={11} showCharacterCount={false} />
			<section aria-label="Live text statistics" aria-live="polite" aria-atomic="true">
				<dl className="grid grid-cols-4 border border-line bg-[#f5f3ec] max-[760px]:grid-cols-2">
					{metrics.map((metric, index) => <div className={`flex min-h-[87px] flex-col justify-between gap-3 border-r border-line p-[13px_15px] max-[760px]:min-h-20 max-[760px]:p-[11px] ${index === metrics.length - 1 ? "max-[760px]:border-r-0" : ""} ${index < 2 ? "max-[760px]:border-b" : ""}`} key={metric.label}>
						<dt className="text-[11px] text-muted">{metric.label}</dt><dd className="m-0 text-xl font-semibold tracking-[-.04em] max-[520px]:text-lg">{metric.value}</dd>
					</div>)}
				</dl>
			</section>
			<p className="-mt-3 mb-0 text-[11px] text-muted">Reading time is an estimate based on 200 words per minute.</p>
		</div>
	);
};

export default WordCounter;
