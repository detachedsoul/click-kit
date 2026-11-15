import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { categories, tools } from "@/lib/tools";
import ToolCard from "@/components/tool-card";

const HomePage = () => {
	const featuredTools = ["word-counter", "json-formatter", "percentage-calculator", "password-generator", "case-converter", "qr-generator", "unit-converter", "pomodoro-timer"]
		.map((id) => tools.find((tool) => tool.id === id)!)
		.filter(Boolean);

	return <>
		<section className="shell hero" aria-labelledby="home-title">
			<div>
				<div className="eyebrow">A little more useful, every day</div>
				<h1 id="home-title">Good tools.<br /><span>Less fuss.</span></h1>
				<p className="hero-copy">A considered collection of small tools for the things you do every day. No sign-up, no clutter — just get what you need and get on with it.</p>
			</div>
			<aside className="hero-aside"><strong>Made to be useful.</strong><p>Practical helpers for your words, numbers, code, and everyday work — all in one quiet corner of the web.</p></aside>
		</section>

		<section className="section" id="tools" aria-labelledby="tools-title">
			<div className="shell">
				<div className="section-heading"><div><h2 id="tools-title">A good place to start</h2><p>The little helpers people reach for most.</p></div><Link className="text-link" href="#categories">Browse by category <ArrowRight size={14} /></Link></div>
				<div className="tool-grid">{featuredTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
			</div>
		</section>

		<section className="section" id="categories" aria-labelledby="categories-title">
			<div className="shell">
				<div className="section-heading"><div><h2 id="categories-title">Find your kind of tool</h2><p>Five useful corners, each with its own purpose.</p></div></div>
				<div className="category-grid">{categories.map((category) => {
					const Icon = category.icon;
					const count = tools.filter((tool) => tool.category === category.id).length;
					return <Link className="category-card" key={category.id} href={`/category/${category.id}`}>
						<Icon size={19} strokeWidth={1.7} aria-hidden="true" />
						<h3>{category.name}</h3><p>{category.description}</p><span className="category-count">{String(count).padStart(2, "0")} tools</span>
					</Link>;
				})}</div>
				<div style={{ marginTop: 25 }} className="privacy-note"><LockKeyhole size={17} aria-hidden="true" /><span><strong>Private by nature.</strong> Tools are designed to run in your browser. Your inputs stay on your device.</span></div>
			</div>
		</section>
	</>;
};

export default HomePage;
