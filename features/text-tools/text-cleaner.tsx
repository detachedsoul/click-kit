"use client";

import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { cleanText, DEFAULT_CLEAN_TEXT_OPTIONS, type CleanTextOptions } from "@/features/text-tools/text-utils";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";

const cleaningChoices: { id: keyof CleanTextOptions; label: string; description: string }[] = [
	{ id: "trimLineWhitespace", label: "Trim line edges", description: "Remove spaces at the start and end of each line." },
	{ id: "collapseHorizontalWhitespace", label: "Collapse repeated spaces", description: "Turn runs of spaces or tabs into one space." },
	{ id: "removeBlankLines", label: "Remove blank lines", description: "Delete empty lines while keeping the remaining text order." },
];

const TextCleaner = () => {
	const [text, setText] = useState("");
	const [options, setOptions] = useState<CleanTextOptions>({ ...DEFAULT_CLEAN_TEXT_OPTIONS });
	const cleanedText = useMemo(() => cleanText(text, options), [text, options]);

	const toggleOption = (option: keyof CleanTextOptions) => {
		setOptions((currentOptions) => ({ ...currentOptions, [option]: !currentOptions[option] }));
	};

	return (
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="inline-flex max-w-full self-start items-center gap-2 border border-[#d9e1d2] bg-[#f0f3ec] px-2.5 py-[7px] text-[11px] leading-[1.45] text-[#4d6250]">
				<LockKeyhole className="shrink-0" size={14} aria-hidden="true" /><span>Text is cleaned locally in your browser. Line endings are normalized to LF.</span>
			</div>
			<TextAreaField id="text-cleaner-input" label="Text to clean" value={text} onChange={setText} placeholder="Paste text with extra spaces, tabs, or blank lines…" rows={9} />
			<fieldset className="m-0 grid min-w-0 grid-cols-3 border border-line bg-[#f8f7f3] p-0 max-[760px]:grid-cols-1">
				<legend className="mb-0 ml-[13px] px-1 text-xs font-semibold text-[#3c3d37]">Cleaning options</legend>
				{cleaningChoices.map((choice, index) => <label className={`flex min-w-0 cursor-pointer items-start gap-2.5 p-[13px] max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-line ${index === 2 ? "max-[760px]:border-b-0" : ""} ${index < 2 ? "border-r border-line" : ""}`} key={choice.id} htmlFor={`cleaner-${choice.id}`}>
					<input className="mt-px size-[15px] shrink-0 accent-accent-dark" id={`cleaner-${choice.id}`} type="checkbox" checked={options[choice.id]} onChange={() => toggleOption(choice.id)} />
					<span className="flex flex-col gap-1"><strong className="text-[11px] font-semibold text-[#40413b]">{choice.label}</strong><small className="text-[10px] leading-[1.45] text-muted">{choice.description}</small></span>
				</label>)}
			</fieldset>
			<section className="flex flex-col gap-[11px] border-t border-line pt-[18px]" aria-labelledby="cleaner-result-label">
				<div className="flex items-center justify-between gap-3"><h2 id="cleaner-result-label" className="m-0 text-sm font-semibold tracking-[-.02em]">Cleaned text</h2><CopyTextButton text={cleanedText} /></div>
				<TextAreaField id="text-cleaner-output" label="Result" value={cleanedText} onChange={() => undefined} placeholder="The cleaned version will appear here." rows={9} readOnly />
			</section>
		</div>
	);
};

export default TextCleaner;
