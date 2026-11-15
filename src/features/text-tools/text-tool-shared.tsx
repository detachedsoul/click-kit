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
	<div className="text-area-field">
		<div className="text-area-label-row">
			<label htmlFor={id}>{label}</label>
			{!readOnly && showCharacterCount && <span className="text-area-count">{countGraphemes(value).toLocaleString()} characters</span>}
		</div>
		<textarea
			id={id}
			className="text-area-input"
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			rows={rows}
			readOnly={readOnly}
		/>
		{hint && <p className="text-area-hint">{hint}</p>}
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
		<div className="copy-control">
			<button className="quiet-button copy-button" type="button" onClick={handleCopy} disabled={!text}>
				<Icon size={14} aria-hidden="true" /> {label}
			</button>
			<span className="visually-hidden" role="status" aria-live="polite">
				{copyStatus === "copied" ? "Copied to clipboard." : copyStatus === "error" ? "Could not copy. Select and copy the text manually." : ""}
			</span>
		</div>
	);
};
