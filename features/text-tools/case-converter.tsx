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
		<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
			<div className="inline-flex max-w-full self-start items-center gap-2 border border-[#d9e1d2] bg-[#f0f3ec] px-2.5 py-[7px] text-[11px] leading-[1.45] text-[#4d6250]">
				<LockKeyhole className="shrink-0" size={14} aria-hidden="true" /><span>Your text stays on this device.</span>
			</div>
			<TextAreaField id="case-converter-input" label="Text to convert" value={text} onChange={setText} placeholder="Paste or write something here…" rows={8} />
			<fieldset className="m-0 min-w-0 border-0 p-0">
				<legend className="mb-[9px] text-xs font-semibold text-[#3c3d37]">Convert to</legend>
				<div className="flex flex-wrap gap-[7px]">
					{caseOptions.map((option) => <button
						className={`min-h-[37px] cursor-pointer border px-[11px] text-[11px] transition-colors max-[520px]:px-2 max-[520px]:text-[10px] ${selectedCase === option.id ? "border-ink bg-ink text-white hover:bg-ink hover:text-white" : "border-line bg-surface text-[#5e5f58] hover:border-[#aaa69a] hover:text-ink"}`}
						key={option.id}
						type="button"
						aria-pressed={selectedCase === option.id}
						onClick={() => setSelectedCase(option.id)}
					>
						{option.label}
					</button>)}
				</div>
			</fieldset>
			<section className="flex flex-col gap-[11px] border-t border-line pt-[18px]" aria-labelledby="case-result-label">
				<div className="flex items-center justify-between gap-3"><h2 id="case-result-label" className="m-0 text-sm font-semibold tracking-[-.02em]">Converted text</h2><CopyTextButton text={convertedText} /></div>
				<TextAreaField id="case-converter-output" label="Result" value={convertedText} onChange={() => undefined} placeholder="Your converted text will appear here." rows={8} readOnly />
			</section>
		</div>
	);
};

export default CaseConverter;
