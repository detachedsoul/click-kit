import type { Metadata } from "next";
import type { ComponentType } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { categories, getTool, tools } from "@/lib/tools";
import WordCounter from "@/features/text-tools/word-counter";
import CaseConverter from "@/features/text-tools/case-converter";
import TextCleaner from "@/features/text-tools/text-cleaner";
import TextDiffChecker from "@/features/text-tools/text-diff-checker";

const availableToolComponents: Record<string, ComponentType> = {
	"word-counter": WordCounter,
	"case-converter": CaseConverter,
	"text-cleaner": TextCleaner,
	"text-diff": TextDiffChecker,
};

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
	const AvailableTool = availableToolComponents[tool.slug];

	return <div className="shell">
		<header className="page-top">
			<nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href={`/category/${category.id}`}>{category.name}</Link><span aria-hidden="true">/</span><span>{tool.name}</span></nav>
			<h1>{tool.name}</h1><p>{tool.description}</p>
		</header>
		{tool.status === "available" && AvailableTool
			? <section className="tool-stage" aria-label={`${tool.name} tool`}><AvailableTool /></section>
			: <section className="planned-panel" aria-labelledby="planned-title">
				<Icon size={27} strokeWidth={1.6} aria-hidden="true" />
				<h2 id="planned-title">A useful tool is taking shape.</h2>
				<p>This tool is on the ClickKit roadmap. It will be marked available here only when it can do the job properly.</p>
				<Link className="button-link" href={`/category/${category.id}`}><ArrowLeft size={14} /> Explore {category.name}</Link>
			</section>}
	</div>;
};

export default ToolPage;
