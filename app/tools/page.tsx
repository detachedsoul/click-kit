import Link from "next/link";
import type { Metadata } from "next";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import { categories, tools } from "@/lib/tools";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
	title: "All tools",
	description: `Every ClickKit tool in one list — ${tools.length} free browser tools for text, numbers, code, images, and everyday tasks.`,
	alternates: { canonical: "/tools" },
	openGraph: { type: "website", title: "All ClickKit tools", description: "The complete list, grouped by category.", url: `${siteUrl}/tools` },
};

export default function AllToolsPage() {
	return (
		<Shell>
			<header className="max-w-[680px] py-[50px] pb-8 max-[620px]:py-[36px]">
				<nav aria-label="Breadcrumb" className="flex items-center gap-[9px] text-[11px] text-[#777a70]">
					<Link className="hover:text-accent-dark" href="/">
						Home
					</Link>
					<span aria-hidden="true">/</span>
					<span>All tools</span>
				</nav>
				<h1 className="mb-3 mt-6 font-serif text-[clamp(46px,6.5vw,76px)] font-normal leading-[.92] tracking-[-.04em]">Every tool, one page.</h1>
				<p className="m-0 text-sm leading-[1.7] text-[#60635b]">
					{tools.length} tools, grouped by what they do. Everything runs in your browser — no account, no uploads. Use <kbd className="rounded-[3px] border border-line bg-surface px-[5px] py-px font-mono text-[11px]">⌘ K</kbd> anywhere to search.
				</p>
				<nav aria-label="Jump to category" className="mt-5 flex flex-wrap gap-2">
					{categories.map((category) => (
						<a
							className="inline-flex items-center gap-2 border border-line bg-surface px-3 py-1.5 text-xs text-[#50534c] transition-colors hover:border-[#aaa69a] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							href={`#${category.id}`}
							key={category.id}
						>
							<category.icon aria-hidden="true" size={14} strokeWidth={1.7} />
							{category.name}
							<span className="font-mono text-[10px] text-muted">{tools.filter((tool) => tool.category === category.id).length}</span>
						</a>
					))}
				</nav>
			</header>
			<div className="flex flex-col gap-[38px] pb-[80px]">
				{categories.map((category) => {
					const categoryTools = tools.filter((tool) => tool.category === category.id);
					return (
						<section aria-labelledby={`tools-${category.id}`} className="scroll-mt-[86px]" id={category.id} key={category.id}>
							<div className="mb-3 flex flex-wrap items-end justify-between gap-3">
								<div>
									<h2 className="m-0 font-serif text-[30px] font-normal leading-[1.05] tracking-[-.02em]" id={`tools-${category.id}`}>
										{category.name}
									</h2>
									<p className="mb-0 mt-1.5 text-xs text-muted">{category.description}</p>
								</div>
								<Link className="text-xs text-[#50534c] hover:text-accent-dark" href={`/category/${category.id}`}>
									Open category page →
								</Link>
							</div>
							<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
						</section>
					);
				})}
			</div>
		</Shell>
	);
}
