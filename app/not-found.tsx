import Link from "next/link";
import type { Metadata } from "next";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import { ArrowLeft, Search } from "lucide-react";
import { categories, tools } from "@/lib/tools";

export const metadata: Metadata = {
	title: "Page not found",
	description: "That page does not exist. Browse the ClickKit tools instead.",
	robots: { index: false, follow: true },
};

export default function NotFound() {
	const suggestions = ["word-counter", "json-formatter", "percentage-calculator", "case-converter"]
		.map((slug) => tools.find((tool) => tool.slug === slug))
		.filter(Boolean);

	return (
		<Shell>
			<section className="py-[70px] pb-[40px] max-[620px]:py-[46px]" aria-labelledby="not-found-title">
				<p className="m-0 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark">Error 404</p>
				<h1 className="mb-3 mt-3 font-serif text-[clamp(52px,7vw,84px)] font-normal leading-[.92] tracking-[-.035em]" id="not-found-title">
					This page went <span className="italic text-accent">missing.</span>
				</h1>
				<p className="m-0 max-w-[520px] text-sm leading-[1.7] text-[#60635b]">
					The link may be out of date, or the tool may have moved. Everything ClickKit makes lives one click away — start from the categories below, or use the
					search box in the header<span className="hidden sm:inline"> (press <kbd className="rounded-[3px] border border-line bg-surface px-[5px] py-px font-mono text-[11px]">⌘ K</kbd>)</span>.
				</p>
				<Link className="mt-6 inline-flex items-center gap-2 border border-forest bg-forest px-4 py-2.5 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/">
					<ArrowLeft size={14} aria-hidden="true" /> Back to all tools
				</Link>
			</section>
			<section className="border-t border-line py-[34px]" aria-labelledby="not-found-categories">
				<h2 className="m-0 font-serif text-[28px] font-normal tracking-[-.02em]" id="not-found-categories">
					Browse by category
				</h2>
				<div className="mt-4 flex flex-wrap gap-2">
					{categories.map((category) => (
						<Link
							className="inline-flex items-center gap-2 border border-line bg-[#f8f7f2] px-3 py-2 text-xs transition-colors hover:border-[#5f6259] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							href={`/category/${category.id}`}
							key={category.id}
						>
							<category.icon aria-hidden="true" size={15} strokeWidth={1.7} />
							{category.name}
						</Link>
					))}
				</div>
			</section>
			<section className="border-t border-line py-[34px] pb-[80px]" aria-labelledby="not-found-popular">
				<div className="mb-4 flex items-end justify-between gap-4">
					<h2 className="m-0 font-serif text-[28px] font-normal tracking-[-.02em]" id="not-found-popular">
						Popular right now
					</h2>
					<Link className="inline-flex items-center gap-1.5 text-xs text-[#50534c] hover:text-accent-dark" href="/tools">
						<Search aria-hidden="true" size={13} /> All tools
					</Link>
				</div>
				<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">
					{suggestions.map((tool) => tool && <ToolCard key={tool.id} tool={tool} />)}
				</div>
			</section>
		</Shell>
	);
}
