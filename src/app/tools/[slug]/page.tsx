import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { categories, getTool, tools } from "@/lib/tools";

export const generateStaticParams = () => tools.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> => {
	const { slug } = await params;
	const tool = getTool(slug);
	return tool ? { title: tool.name, description: tool.description } : {};
};

const ToolPage = async ({ params }: { params: Promise<{ slug: string }> }) => {
	const { slug } = await params;
	const tool = getTool(slug);
	if (!tool) notFound();
	const category = categories.find((item) => item.id === tool.category)!;
	const Icon = tool.icon;

	return <div className="shell">
		<header className="page-top">
			<nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href={`/category/${category.id}`}>{category.name}</Link><span aria-hidden="true">/</span><span>{tool.name}</span></nav>
			<h1>{tool.name}</h1><p>{tool.description}</p>
		</header>
		<section className="planned-panel" aria-labelledby="planned-title">
			<Icon size={27} strokeWidth={1.6} aria-hidden="true" />
			<h2 id="planned-title">A useful tool is taking shape.</h2>
			<p>This tool is on the ClickKit roadmap. It will be marked available here only when it can do the job properly.</p>
			<Link className="button-link" href={`/category/${category.id}`}><ArrowLeft size={14} /> Explore {category.name}</Link>
		</section>
	</div>;
};

export default ToolPage;
