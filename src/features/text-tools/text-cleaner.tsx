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
		<div className="text-tool-workspace">
			<div className="tool-note"><LockKeyhole size={14} aria-hidden="true" /><span>Text is cleaned locally in your browser. Line endings are normalized to LF.</span></div>
			<TextAreaField
				id="text-cleaner-input"
				label="Text to clean"
				value={text}
				onChange={setText}
				placeholder="Paste text with extra spaces, tabs, or blank lines…"
				rows={9}
			/>
			<fieldset className="cleaner-options">
				<legend>Cleaning options</legend>
				{cleaningChoices.map((choice) => <label className="cleaner-option" key={choice.id} htmlFor={`cleaner-${choice.id}`}>
					<input
						id={`cleaner-${choice.id}`}
						type="checkbox"
						checked={options[choice.id]}
						onChange={() => toggleOption(choice.id)}
					/>
					<span><strong>{choice.label}</strong><small>{choice.description}</small></span>
				</label>)}
			</fieldset>
			<section className="text-output" aria-labelledby="cleaner-result-label">
				<div className="text-output-heading"><h2 id="cleaner-result-label">Cleaned text</h2><CopyTextButton text={cleanedText} /></div>
				<TextAreaField
					id="text-cleaner-output"
					label="Result"
					value={cleanedText}
					onChange={() => undefined}
					placeholder="The cleaned version will appear here."
					rows={9}
					readOnly
				/>
			</section>
		</div>
	);
};

export default TextCleaner;
