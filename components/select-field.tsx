import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

type SelectFieldProps = Omit<ComponentProps<"select">, "className"> & {
	className: string;
	containerClassName: string;
	caretClassName?: string;
	children: ReactNode;
};

const SelectField = ({ className, containerClassName, caretClassName = "right-3", children, ...props }: SelectFieldProps) => (
	<div className={`relative ${containerClassName}`}>
		<select {...props} className={`${className} appearance-none`}>
			{children}
		</select>
		<ChevronDown className={`pointer-events-none absolute ${caretClassName} top-1/2 -translate-y-1/2 text-muted`} size={16} aria-hidden="true" />
	</div>
);

export { SelectField };
