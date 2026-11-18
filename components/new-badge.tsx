import { addedOnLabel, isNewTool, toolAddedOn } from "@/lib/tool-recency";

/** A pill that marks a tool added inside the new-tools window. Renders nothing for older tools. */
export const NewBadge = ({ slug }: { slug: string }) => {
	if (!isNewTool(slug)) return null;
	const added = toolAddedOn(slug);
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full bg-[#f7e5cd] px-2 py-1 font-mono text-[9px] uppercase tracking-[.02em] text-[#8a5320] max-[620px]:px-1.5 max-[620px]:text-[8px]"
			title={added ? `Added ${addedOnLabel(added)}` : "Recently added"}
		>
			<span aria-hidden="true" className="size-1.5 rounded-full bg-[#c07c35]" />
			New
			{added ? <span className="sr-only"> tool — added {addedOnLabel(added)}</span> : null}
		</span>
	);
};

export default NewBadge;
