import type { ComponentProps } from "react";

const shellClasses = "mx-auto w-[calc(100%-2rem)] max-w-[520px] min-[621px]:w-[calc(100%-2.5rem)] min-[621px]:max-w-[720px] min-[901px]:w-[calc(100%-3.5rem)] min-[901px]:max-w-[1180px]";

type ShellProps = ComponentProps<"div">;

const Shell = ({ className = "", ...props }: ShellProps) => (
	<div className={`${shellClasses} ${className}`} {...props} />
);

export default Shell;
