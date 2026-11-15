"use client";

import { useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { convertCase, type TextCase } from "@/features/text-tools/text-utils";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";

const caseOptions: { id: TextCase; label: string }[] = [
	{ id: "uppercase", label: "UPPERCASE" },
	{ id: "lowercase", label: "lowercase" },
	{ id: "title", label: "Title case" },
	{ id: "sentence", label: "Sentence case" },
	{ id: "camel", label: "camelCase" },
	{ id: "kebab", label: "kebab-case" },
	{ id: "snake", label: "snake_case" },
];

const CaseConverter = () => {
	const [text, setText] = useState("");
	const [selectedCase, setSelectedCase] = useState<TextCase>("sentence");
	const convertedText = useMemo(() => convertCase(text, selectedCase), [text, selectedCase]);

	return (
		<div className="text-tool-workspace">
			<div className="tool-note"><LockKeyhole size={14} aria-hidden="true" /><span>Your text stays on this device.</span></div>
			<TextAreaField
				id="case-converter-input"
				label="Text to convert"
				value={text}
				onChange={setText}
				placeholder="Paste or write something here…"
				rows={8}
			/>
			<fieldset className="case-selector">
				<legend>Convert to</legend>
				<div className="case-options">
					{caseOptions.map((option) => <button
						className={`case-option${selectedCase === option.id ? " is-selected" : ""}`}
						key={option.id}
						type="button"
						aria-pressed={selectedCase === option.id}
						onClick={() => setSelectedCase(option.id)}
					>
						{option.label}
					</button>)}
				</div>
			</fieldset>
			<section className="text-output" aria-labelledby="case-result-label">
				<div className="text-output-heading"><h2 id="case-result-label">Converted text</h2><CopyTextButton text={convertedText} /></div>
				<TextAreaField
					id="case-converter-output"
					label="Result"
					value={convertedText}
					onChange={() => undefined}
					placeholder="Your converted text will appear here."
					rows={8}
					readOnly
				/>
			</section>
		</div>
	);
};

export default CaseConverter;
