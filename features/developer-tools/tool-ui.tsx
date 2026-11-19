"use client";

import { useId, type ReactNode } from "react";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";

export const ToolPanel = ({ children }: { children: ReactNode }) => (
	<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">{children}</div>
);

export const fieldClassName =
	"mt-2 block h-11 w-full border border-field bg-surface px-3 text-sm text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent disabled:cursor-not-allowed disabled:border-[#e2dfd5] disabled:bg-[#f4f3ef] disabled:text-[#a7a69e]";
export const selectClassName = "select-input";
export const labelClassName = "block text-xs font-semibold text-[#3c3d37]";
export const hintClassName = "m-0 text-[11px] leading-relaxed text-muted";
export const errorClassName = "m-0 whitespace-pre-wrap break-words text-xs text-[#8a3f30]";
export const buttonClassName =
	"min-h-9 cursor-pointer border px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const primaryButtonClassName =
	"inline-flex min-h-10 cursor-pointer items-center justify-center border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const checkboxInputClassName = "checkbox-input";

type CheckboxInputProps = {
	id?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	disabled?: boolean;
};

/** A styled checkbox on its own, for table cells and grids where the label lives elsewhere. */
export const CheckboxInput = ({ id, checked, onChange, label, disabled = false }: CheckboxInputProps) => (
	<input
		aria-label={label}
		checked={checked}
		className={checkboxInputClassName}
		disabled={disabled}
		id={id}
		onChange={(event) => onChange(event.target.checked)}
		type="checkbox"
	/>
);

type CheckboxFieldProps = {
	id?: string;
	label: ReactNode;
	checked: boolean;
	onChange: (checked: boolean) => void;
	hint?: string;
	disabled?: boolean;
	className?: string;
};

/** Checkbox plus label that lines up with the panel's inputs and shares their focus ring. */
export const CheckboxField = ({ id, label, checked, onChange, hint, disabled = false, className = "" }: CheckboxFieldProps) => {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	return (
	<div className={`flex flex-col gap-1.5 ${className}`}>
		<div className="flex items-start gap-2.5">
			<input
				aria-describedby={hint ? `${inputId}-hint` : undefined}
				checked={checked}
				className="checkbox-input"
				disabled={disabled}
				id={inputId}
				onChange={(event) => onChange(event.target.checked)}
				type="checkbox"
			/>
			<label className={`cursor-pointer select-none text-xs font-semibold leading-[18px] text-[#3c3d37] ${disabled ? "cursor-not-allowed opacity-60" : ""}`} htmlFor={inputId}>
				{label}
			</label>
		</div>
		{hint ? (
			<p className={`${hintClassName} pl-[28px]`} id={`${inputId}-hint`}>
				{hint}
			</p>
		) : null}
	</div>
	);
};

/** A row of checkbox options, placed under a panel's field grid so nothing drifts out of line. */
export const CheckboxRow = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
	<div className={`flex flex-wrap items-start gap-x-6 gap-y-2.5 ${className}`.trim()}>{children}</div>
);

export const ErrorNote = ({ message }: { message: string }) =>
	message ? (
		<p className={errorClassName} role="alert">
			{message}
		</p>
	) : null;

export const DownloadLink = ({ fileName, text, label }: { fileName: string; text: string; label: string }) => (
	<a
		className="inline-flex min-h-[34px] cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
		href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
		download={fileName}
	>
		{label}
	</a>
);

type SegmentedControlProps<T extends string> = {
	label: string;
	options: { id: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
};

export const SegmentedControl = <T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) => (
	<div className="flex flex-col gap-2" role="group" aria-label={label}>
		<span className={labelClassName}>{label}</span>
		<div className="flex flex-wrap gap-2">
			{options.map((option) => (
				<button
					className={`${buttonClassName} ${value === option.id ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#5f6259]"}`}
					key={option.id}
					type="button"
					aria-pressed={value === option.id}
					onClick={() => onChange(option.id)}
				>
					{option.label}
				</button>
			))}
		</div>
	</div>
);

type ResultBlockProps = {
	title: string;
	value: string;
	rows?: number;
	fileName?: string;
	emptyMessage?: string;
};

export const ResultBlock = ({ title, value, rows = 9, fileName, emptyMessage = "Your result will appear here." }: ResultBlockProps) => {
	const slug = title.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
	return (
		<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="m-0 text-sm font-semibold">{title}</h2>
				<div className="flex flex-wrap items-center gap-2">
					<CopyTextButton text={value} />
					{fileName && value ? <DownloadLink fileName={fileName} label={`Download ${fileName}`} text={value} /> : null}
				</div>
			</div>
			<TextAreaField id={`${slug}-output`} label="Result" value={value} onChange={() => undefined} placeholder={emptyMessage} rows={rows} readOnly />
		</section>
	);
};

export const StatGrid = ({ items }: { items: { label: string; value: string }[] }) => (
	<dl className="m-0 grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
		{items.map(({ label, value }) => (
			<div className="border border-line bg-[#fbfaf7] px-3 py-2" key={label}>
				<dt className="text-[10px] uppercase tracking-[.08em] text-[#5f6259]">{label}</dt>
				<dd className="m-0 mt-1 break-all font-mono text-[13px] text-ink">{value}</dd>
			</div>
		))}
	</dl>
);
