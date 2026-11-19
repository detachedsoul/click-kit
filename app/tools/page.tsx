import Link from "next/link";
import type { Metadata } from "next";
import Shell from "@/components/shell";
import ToolsBrowser from "@/components/tools-browser";
import { categories, tools } from "@/lib/tools";
import { siteUrl, toolUrl } from "@/lib/site";

export const metadata: Metadata = {
	title: "All tools",
	description: `Every ClickKit tool in one place — ${tools.length} free browser tools for text, numbers, code, images, and everyday tasks. Filter by category or search by keyword.`,
	alternates: { canonical: "/tools" },
	openGraph: { type: "website", title: "All ClickKit tools", description: "The complete list. Filter by category, or search by keyword.", url: `${siteUrl}/tools` },
};

const listJsonLd = {
	"@context": "https://schema.org",
	"@type": "CollectionPage",
	name: "All ClickKit tools",
	url: `${siteUrl}/tools`,
	description: `All ${tools.length} ClickKit tools, grouped by category.`,
	isPartOf: { "@id": `${siteUrl}/#website` },
	mainEntity: {
		"@type": "ItemList",
		numberOfItems: tools.length,
		itemListElement: tools.map((tool, index) => ({ "@type": "ListItem", position: index + 1, name: tool.name, url: toolUrl(tool.slug) })),
	},
};

export default function AllToolsPage() {
	return (
		<Shell>
			<script dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} type="application/ld+json" />
			<header className="max-w-[680px] py-[50px] pb-8 max-[620px]:py-[36px]">
				<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-[9px] gap-y-1 text-[11px] text-[#5f6259]">
					<Link className="hover:text-accent-dark" href="/">
						Home
					</Link>
					<span aria-hidden="true">/</span>
					<span>All tools</span>
				</nav>
				<h1 className="mb-3 mt-6 font-serif text-[clamp(46px,6.5vw,76px)] font-normal leading-[.92] tracking-[-.04em]">Every tool, one page.</h1>
				<p className="m-0 text-sm leading-[1.7] text-[#60635b]">
					{tools.length} tools across {categories.length} categories. Everything runs in your browser — no account, no uploads.{" "}
					<span className="hidden sm:inline">
						Search here, or press <kbd className="rounded-[3px] border border-line bg-surface px-[5px] py-px font-mono text-[11px]">⌘ K</kbd> from any page.
					</span>
				</p>
			</header>
			<ToolsBrowser />
		</Shell>
	);
}
