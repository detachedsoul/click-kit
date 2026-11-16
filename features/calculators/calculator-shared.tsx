"use client";

export const formatCalculatorDisplay = (value: number) => new Intl.NumberFormat("en", {
	maximumSignificantDigits: 14,
}).format(Object.is(value, -0) ? 0 : value);

type CalculatorNumberFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	min?: number;
};

export const CalculatorNumberField = ({ id, label, value, onChange, placeholder = "0", min }: CalculatorNumberFieldProps) => (
	<label className="block min-w-0 text-xs font-semibold text-[#3c3d37]" htmlFor={id}>
		{label}
		<input
			className="mt-2 block h-11 w-full min-w-0 border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
			id={id}
			inputMode="decimal"
			min={min}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			step="any"
			type="number"
			value={value}
		/>
	</label>
);
