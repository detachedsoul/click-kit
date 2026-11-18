import Link from "next/link";
import type { Tool } from "@/lib/tools";
import { ArrowUpRight } from "lucide-react";
import { NewBadge } from "@/components/new-badge";

const ToolCard = ({ tool }: { tool: Tool }) => {
	const Icon = tool.icon;
	const isAvailable = tool.status === "available";

	return (
		<Link
			className="group relative flex min-h-[176px] flex-col border-b border-r border-line bg-[#f8f7f2] p-[18px] transition-[background-color,box-shadow,transform] duration-200 hover:z-[1] hover:-translate-y-0.5 hover:bg-surface hover:shadow-[0_10px_24px_#322c2012] focus-visible:z-[1] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent max-[620px]:min-h-[165px] max-[620px]:p-[13px_12px]"
			href={`/tools/${tool.slug}`}
			aria-label={`${tool.name}. ${isAvailable ? "Ready to use." : "Planned tool."}`}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="grid size-9 place-items-center rounded-[2px] bg-[#eddfd4] text-accent-dark transition-transform duration-200 group-hover:-translate-y-0.5 max-[620px]:size-8">
					<Icon size={17} strokeWidth={1.7} aria-hidden="true" />
				</span>
				<span className="flex items-center gap-1.5">
					<NewBadge slug={tool.slug} />
					<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[.02em] max-[620px]:gap-1 max-[620px]:px-1.5 max-[620px]:text-[8px] ${isAvailable ? "bg-sage text-[#536b4e]" : "bg-[#efeee8] text-[#77786f]"}`}>
						{isAvailable && <span className="size-1.5 rounded-full bg-[#6b8a61]" aria-hidden="true" />}
						{isAvailable ? "Ready" : "In the works"}
					</span>
				</span>
			</div>
			<h3 className="mb-1.5 mt-4 text-[14px] font-semibold tracking-[-.02em] group-hover:text-accent-dark max-[620px]:mt-3 max-[620px]:text-xs">{tool.name}</h3>
			<p className="m-0 pr-4 text-xs leading-[1.55] text-muted max-[620px]:text-[10px]">{tool.description}</p>
			<ArrowUpRight className="absolute bottom-[17px] right-[16px] text-[#96958c] transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent-dark max-[620px]:bottom-3 max-[620px]:right-3" size={14} aria-hidden="true" />
		</Link>
	);
};

export default ToolCard;
