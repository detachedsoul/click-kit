import type { ComponentProps, ReactNode } from "react";
import { selectClassName } from "@/features/developer-tools/tool-ui";

type SelectFieldProps = Omit<ComponentProps<"select">, "className"> & {
	className?: string;
	containerClassName?: string;
	children: ReactNode;
};

/** Select with the shared caret, padding, and focus ring. The wrapper is kept so labels can place it. */
const SelectField = ({ className = "", containerClassName = "", children, ...props }: SelectFieldProps) => (
	<div className={`relative ${containerClassName}`}>
		<select {...props} className={`${selectClassName} ${className}`.trim()}>
			{children}
		</select>
	</div>
);

export { SelectField };
