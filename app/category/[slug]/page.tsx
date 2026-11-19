import Link from "next/link";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { categories, tools } from "@/lib/tools";
import { categoryUrl, siteUrl, toolUrl } from "@/lib/site";

export const generateStaticParams = () => categories.map(({ id }) => ({ slug: id }));

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
	const { slug } = await params;
	const category = categories.find((item) => item.id === slug);
	if (!category) return { title: "Category not found" };
	return {
		title: category.name,
		description: `${category.description} Browse ${tools.filter((tool) => tool.category === category.id).length} free browser tools.`,
		alternates: { canonical: `/category/${category.id}` },
		openGraph: { type: "website", title: `${category.name} tools · ClickKit`, description: category.description, url: categoryUrl(category.id) },
	};
};

const CategoryPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const category = categories.find((item) => item.id === slug);
	if (!category) notFound();
	const categoryTools = tools.filter((tool) => tool.category === category.id);
	const categoryJsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "CollectionPage",
				name: `${category.name} tools`,
				description: category.description,
				url: categoryUrl(category.id),
				isPartOf: { "@id": `${siteUrl}/#website` },
				mainEntity: {
					"@type": "ItemList",
					numberOfItems: categoryTools.length,
					itemListElement: categoryTools.map((tool, index) => ({ "@type": "ListItem", position: index + 1, name: tool.name, url: toolUrl(tool.slug) })),
				},
			},
			{
				"@type": "BreadcrumbList",
				itemListElement: [
					{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
					{ "@type": "ListItem", position: 2, name: "All tools", item: `${siteUrl}/tools` },
					{ "@type": "ListItem", position: 3, name: category.name, item: categoryUrl(category.id) },
				],
			},
		],
	};

	return <Shell>
		<script dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }} type="application/ld+json" />
		<header className="py-[45px] pb-[30px] max-[620px]:py-[33px] max-[620px]:pb-6">
			<nav className="flex items-center gap-[9px] text-[11px] text-[#5f6259]" aria-label="Breadcrumb"><Link className="hover:text-accent-dark" href="/">Home</Link><ChevronRight size={12} /><span>{category.name}</span></nav>
			<h1 className="mb-2 mt-[26px] font-serif text-[clamp(50px,6vw,72px)] font-normal leading-[.98] tracking-[-.035em] max-[620px]:mt-[21px] max-[620px]:text-[clamp(48px,12vw,62px)]">{category.name}</h1>
			<p className="m-0 max-w-[570px] text-sm leading-[1.65] text-[#60635b]">{category.description}</p>
		</header>
		<section className="pb-[90px] max-[620px]:pb-[67px]" aria-labelledby="category-tools-title">
			<div className="mb-[22px] flex items-end justify-between gap-5 max-[620px]:mb-[17px] max-[620px]:items-start">
				<div><h2 id="category-tools-title" className="m-0 font-serif text-[34px] font-normal leading-[1.05] tracking-[-.02em] max-[620px]:text-[30px]">Tools for {category.name.toLowerCase()}</h2><p className="mb-0 mt-2 text-[13px] text-muted">Useful things, without the unnecessary bits.</p></div>
				<span className="shrink-0 font-mono text-[10px] tracking-[.05em] text-[#5f6259]">{String(categoryTools.length).padStart(2, "0")} TOOLS</span>
			</div>
			<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
		</section>
	</Shell>;
};

export default CategoryPage;
