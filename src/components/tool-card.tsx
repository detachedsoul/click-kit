import Link from "next/link";
import type { Tool } from "@/lib/tools";

const ToolCard = ({ tool }: { tool: Tool }) => {
	const Icon = tool.icon;
	return (
		<Link className="tool-card" href={`/tools/${tool.slug}`} aria-label={`${tool.name}. Planned tool.`}>
			<div className="tool-card-top"><Icon size={18} strokeWidth={1.7} /><span className="coming">In the works</span></div>
			<h3>{tool.name}</h3>
			<p>{tool.description}</p>
		</Link>
	);
};

export default ToolCard;
