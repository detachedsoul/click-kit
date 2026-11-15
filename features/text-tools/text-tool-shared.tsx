"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { countGraphemes } from "@/features/text-tools/text-utils";

type TextAreaFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	rows?: number;
	hint?: string;
	readOnly?: boolean;
	showCharacterCount?: boolean;
};

export const TextAreaField = ({
	id,
	label,
	value,
	onChange,
	placeholder,
	rows = 9,
	hint,
	readOnly = false,
	showCharacterCount = true,
}: TextAreaFieldProps) => (
	<div className="min-w-0">
		<div className="mb-2 flex items-baseline justify-between gap-3">
			<label className="text-xs font-semibold text-[#3c3d37]" htmlFor={id}>{label}</label>
			{!readOnly && showCharacterCount && <span className="font-mono text-[10px] text-[#92928a]">{countGraphemes(value).toLocaleString()} characters</span>}
		</div>
		<textarea
			id={id}
			className="block min-h-[182px] w-full resize-y border border-[#d9d7cd] bg-surface px-4 py-[15px] text-sm leading-[1.72] text-ink outline-2 outline-offset-2 outline-transparent transition-[border-color,outline-color] placeholder:text-[#96958c] focus:border-accent focus:outline-accent read-only:bg-[#f7f5ef] read-only:text-[#3e4139] max-[520px]:min-h-[150px] max-[520px]:px-[11px] max-[520px]:py-[11px] max-[520px]:text-xs"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			rows={rows}
			readOnly={readOnly}
		/>
		{hint && <p className="mb-0 mt-[7px] text-[11px] leading-[1.5] text-muted">{hint}</p>}
	</div>
);

export const CopyTextButton = ({ text }: { text: string }) => {
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (resetTimer.current) clearTimeout(resetTimer.current);
	}, []);

	const handleCopy = async () => {
		if (!text || !navigator.clipboard?.writeText) {
			setCopyStatus("error");
			return;
		}

		try {
			await navigator.clipboard.writeText(text);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("error");
		}

		if (resetTimer.current) clearTimeout(resetTimer.current);
		resetTimer.current = setTimeout(() => setCopyStatus("idle"), 2200);
	};

	const Icon = copyStatus === "copied" ? Check : copyStatus === "error" ? TriangleAlert : Copy;
	const label = copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy";

	return (
		<div className="flex items-center">
			<button className="inline-flex min-h-[34px] items-center justify-center gap-[7px] border border-line bg-surface px-2.5 text-[11px] text-[#54554e] hover:border-[#aaa69a] hover:text-ink disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]" type="button" onClick={handleCopy} disabled={!text}>
				<Icon size={14} aria-hidden="true" /> {label}
			</button>
			<span className="sr-only" role="status" aria-live="polite">
				{copyStatus === "copied" ? "Copied to clipboard." : copyStatus === "error" ? "Could not copy. Select and copy the text manually." : ""}
			</span>
		</div>
	);
};
