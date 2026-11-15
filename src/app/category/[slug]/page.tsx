import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { categories, tools } from "@/lib/tools";
import ToolCard from "@/components/tool-card";

export const generateStaticParams = () => categories.map(({ id }) => ({ slug: id }));

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
	const { slug } = await params;
	const category = categories.find((item) => item.id === slug);
	return category ? { title: category.name, description: category.description } : {};
};

const CategoryPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const category = categories.find((item) => item.id === slug);
	if (!category) notFound();
	const categoryTools = tools.filter((tool) => tool.category === category.id);
	return <div className="shell">
		<header className="page-top">
			<nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={12} /><span>{category.name}</span></nav>
			<h1>{category.name}</h1><p>{category.description}</p>
		</header>
		<section className="category-tools" aria-labelledby="category-tools-title">
			<div className="section-heading"><div><h2 id="category-tools-title">Tools for {category.name.toLowerCase()}</h2><p>Useful things, without the unnecessary bits.</p></div><span className="tool-count">{String(categoryTools.length).padStart(2, "0")} TOOLS</span></div>
			<div className="tool-grid">{categoryTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
		</section>
	</div>;
};

export default CategoryPage;
