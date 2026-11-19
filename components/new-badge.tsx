import { Sparkles } from "lucide-react";
import { addedOnLabel, daysSinceAdded, isNewTool, toolAddedOn } from "@/lib/tool-recency";

/** "Added today", "Added 3 days ago" — the freshest possible phrasing for a recent tool. */
export const addedAgo = (slug: string) => {
	const days = daysSinceAdded(slug);
	if (days === null) return null;
	if (days <= 0) return "Added today";
	if (days === 1) return "Added yesterday";
	return `Added ${days} days ago`;
};

const pill =
	"inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[.08em] text-white shadow-[0_1px_0_#873b28] max-[620px]:px-1.5 max-[620px]:text-[10px]";

type NewBadgeProps = {
	slug: string;
	/** `pill` for cards and headers, `banner` for the top of a tool page. */
	variant?: "pill" | "banner";
};

/** Marks a tool added inside the new-tools window. Renders nothing for older tools. */
export const NewBadge = ({ slug, variant = "pill" }: NewBadgeProps) => {
	if (!isNewTool(slug)) return null;
	const added = toolAddedOn(slug);
	const when = added ? addedOnLabel(added) : null;
	const ago = addedAgo(slug);
	const title = when ? `Added ${when}${ago ? ` — ${ago.toLowerCase()}` : ""}` : "Recently added";

	if (variant === "banner") {
		return (
			<span
				className="inline-flex flex-wrap items-center gap-2 rounded-[2px] border border-[#e8c7a1] bg-[#fbeee0] py-1 pl-1 pr-3 text-[11px] text-[#7a4f1d]"
				title={title}
			>
				<span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.08em] text-white">
					<Sparkles aria-hidden="true" size={10} strokeWidth={2.6} />
					New
				</span>
				<span>{ago ?? "Recently added"}{when ? ` · ${when}` : ""}</span>
			</span>
		);
	}

	return (
		<span className={pill} title={title}>
			<Sparkles aria-hidden="true" size={10} strokeWidth={2.6} />
			New
			<span className="sr-only"> tool{when ? ` — added ${when}` : ""}</span>
		</span>
	);
};

export default NewBadge;
