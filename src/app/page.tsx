import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { categories, tools } from "@/lib/tools";
import ToolCard from "@/components/tool-card";

const HomePage = () => {
	const featuredTools = ["word-counter", "json-formatter", "percentage-calculator", "password-generator", "case-converter", "qr-generator", "unit-converter", "pomodoro-timer"]
		.map((id) => tools.find((tool) => tool.id === id)!)
		.filter(Boolean);
	const readyToolsCount = tools.filter((tool) => tool.status === "available").length;

	return <>
		<section className="shell hero" aria-labelledby="home-title">
			<div className="hero-copy-column">
				<div className="eyebrow">A little more useful, every day</div>
				<h1 id="home-title">Good tools.<br /><span>Less fuss.</span></h1>
				<p className="hero-copy">Small, thoughtful browser tools for the digital chores in your day. No account, no detour — just the right tool, right when you need it.</p>
				<Link className="hero-cta" href="/tools/word-counter">Try the word counter <ArrowRight size={16} aria-hidden="true" /></Link>
			</div>
			<aside className="hero-aside" aria-label="ClickKit tools available now">
				<div className="hero-aside-top"><span className="hero-live-dot" /> Ready to use today</div>
				<div className="hero-aside-count"><strong>{String(readyToolsCount).padStart(2, "0")}</strong><span>tools ready now</span></div>
				<p>Four quick ways to count, compare, clean, and reshape your words. More useful things are on the way.</p>
			</aside>
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
				<div className="privacy-note"><LockKeyhole size={17} aria-hidden="true" /><span><strong>Private by nature.</strong> Tools are designed to run in your browser. Your inputs stay on your device.</span></div>
			</div>
		</section>
	</>;
};

export default HomePage;
