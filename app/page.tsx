import Link from "next/link";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import { ArrowRight, Bug, GitPullRequest, Lightbulb, LockKeyhole } from "lucide-react";
import { categories, tools } from "@/lib/tools";
import { addedOnLabel, recentToolReleases } from "@/lib/tool-recency";

const HomePage = () => {
	const featuredTools = ["word-counter", "read-aloud", "percentage-calculator", "password-generator", "case-converter", "qr-generator", "unit-converter", "pomodoro-timer"]
		.map((id) => tools.find((tool) => tool.id === id)!)
		.filter(Boolean);
	const readyToolsCount = tools.filter((tool) => tool.status === "available").length;
	const recentReleases = recentToolReleases();
	const recentTools = recentReleases.flatMap((release) => release.tools).slice(0, 4);
	const latestAdded = recentReleases[0]?.date;

	return <>
		<section aria-labelledby="home-title">
			<Shell className="grid grid-cols-[minmax(0,1fr)_330px] items-center gap-[clamp(40px,8vw,112px)] py-[76px] max-[900px]:grid-cols-[minmax(0,1fr)_255px] max-[900px]:gap-7 max-[900px]:py-[66px] max-[620px]:block max-[620px]:py-12">
				<div className="py-[7px]">
					<div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[.1em] text-accent-dark before:h-px before:w-[25px] before:bg-accent">A little more useful, every day</div>
					<h1 id="home-title" className="mb-[21px] mt-[22px] max-w-[760px] font-serif text-[clamp(76px,9vw,112px)] font-normal leading-[.78] tracking-[-.045em] max-[900px]:text-[clamp(76px,10vw,92px)] max-[620px]:mb-[17px] max-[620px]:mt-5 max-[620px]:text-[clamp(46px,14.5vw,86px)] max-[620px]:leading-[.8]">
						Good tools.<br /><span className="italic text-accent">Less fuss.</span>
					</h1>
					<p className="m-0 max-w-[480px] text-base leading-[1.7] text-[#5d6058] max-[620px]:max-w-[430px] max-[620px]:text-sm">Small, thoughtful browser tools for the digital chores in your day. No account, no detour — just the right tool, right when you need it.</p>
					<Link className="mt-[25px] inline-flex items-center gap-2.5 border-b border-accent pb-[7px] text-[13px] font-semibold text-accent-dark transition-[gap] duration-200 hover:gap-[15px] max-[620px]:mt-5" href="/tools/word-counter">
						Try the word counter <ArrowRight size={16} aria-hidden="true" />
					</Link>
				</div>
				<aside className="relative min-h-[232px] overflow-hidden rounded-[3px] border border-forest bg-forest p-[23px_24px_24px] text-[#f6f4eb] max-[900px]:min-h-[220px] max-[900px]:p-[21px] max-[620px]:mt-[31px] max-[620px]:min-h-0">
					<span aria-hidden="true" className="pointer-events-none absolute -bottom-[95px] -right-[76px] size-44 rounded-full border border-[#c8d4bd40] shadow-[0_0_0_20px_#c8d4bd0b,0_0_0_40px_#c8d4bd0b]" />
					<div className="relative z-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.05em] text-[#d4ddcb]"><span className="size-[7px] rounded-full bg-[#adc89a] shadow-[0_0_0_3px_#adc89a1c]" /> Ready to use today</div>
					<div className="my-[23px] mb-[11px] flex items-baseline gap-3 max-[620px]:my-[19px] max-[620px]:mb-[10px]">
						<strong className="font-serif text-[76px] font-normal leading-[.8] tracking-[-.035em] text-[#f1c891] max-[620px]:text-6xl">{String(readyToolsCount).padStart(2, "0")}</strong>
						<span className="text-xs text-[#e7e8dd]">tools ready now</span>
					</div>
					<p className="relative z-10 m-0 max-w-[250px] text-xs leading-[1.65] text-[#c6cec3] max-[620px]:max-w-[360px]">Quick ways to count, compare, clean, reshape, and listen to your words. More useful things are on the way.</p>
				</aside>
			</Shell>
		</section>

		<section className="scroll-mt-[86px] border-t border-line py-[34px] pb-[66px] max-[620px]:py-[27px] max-[620px]:pb-[43px]" id="tools" aria-labelledby="tools-title">
			<Shell>
				<div className="mb-[22px] flex items-end justify-between gap-5 max-[620px]:mb-[17px] max-[620px]:items-start">
					<div><h2 id="tools-title" className="m-0 font-serif text-[34px] font-normal leading-[1.05] tracking-[-.02em] max-[620px]:text-[30px]">A good place to start</h2><p className="mb-0 mt-2 text-[13px] text-muted max-[620px]:text-xs">The little helpers people reach for most.</p></div>
					<Link className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap text-xs text-[#50534c] transition-colors hover:text-accent-dark" href="#categories">Browse by category <ArrowRight size={14} /></Link>
				</div>
				<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{featuredTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
			</Shell>
		</section>

		{recentTools.length > 0 ? (
			<section aria-labelledby="new-title" className="scroll-mt-[86px] border-t border-line py-[34px] pb-[66px] max-[620px]:py-[27px] max-[620px]:pb-[43px]" id="new">
				<Shell>
					<div className="mb-[22px] flex items-end justify-between gap-5 max-[620px]:mb-[17px] max-[620px]:items-start">
						<div>
							<p className="m-0 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark">Fresh out of the workshop</p>
							<h2 className="mb-0 mt-2 font-serif text-[34px] font-normal leading-[1.05] tracking-[-.02em] max-[620px]:text-[30px]" id="new-title">Recently added</h2>
							<p className="mb-0 mt-2 text-[13px] text-muted max-[620px]:text-xs">{recentTools.length} new tools in the last two weeks{latestAdded ? ` · latest ${addedOnLabel(latestAdded)}` : ""}.</p>
						</div>
						<Link className="inline-flex shrink-0 items-center gap-[7px] whitespace-nowrap text-xs text-[#50534c] transition-colors hover:text-accent-dark" href="/changelog">
							What&apos;s new <ArrowRight size={14} aria-hidden="true" />
						</Link>
					</div>
					<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{recentTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
				</Shell>
			</section>
		) : null}

		<section className="scroll-mt-[86px] border-t border-line py-[34px] pb-[66px] max-[620px]:py-[27px] max-[620px]:pb-[43px]" id="categories" aria-labelledby="categories-title">
			<Shell>
				<div className="mb-[22px] flex items-end justify-between gap-5 max-[620px]:mb-[17px] max-[620px]:items-start">
					<div><h2 id="categories-title" className="m-0 font-serif text-[34px] font-normal leading-[1.05] tracking-[-.02em] max-[620px]:text-[30px]">Find your kind of tool</h2><p className="mb-0 mt-2 text-[13px] text-muted max-[620px]:text-xs">{categories.length} useful corners, each with its own purpose.</p></div>
				</div>
				<div className="grid grid-cols-5 border-l border-t border-line max-[900px]:grid-cols-3 max-[620px]:grid-cols-2">{categories.map((category) => {
					const Icon = category.icon;
					const count = tools.filter((tool) => tool.category === category.id).length;
					return <Link className="flex min-h-[168px] flex-col items-start border-b border-r border-line bg-[#f7f5ee] p-[19px_16px_17px] transition-colors hover:bg-surface max-[620px]:min-h-[151px] max-[620px]:p-[15px_12px]" key={category.id} href={`/category/${category.id}`}>
						<Icon className="text-accent" size={19} strokeWidth={1.7} aria-hidden="true" />
						<h3 className="mb-1.5 mt-4 text-[13px] font-semibold tracking-[-.015em] max-[620px]:mt-3">{category.name}</h3><p className="m-0 text-[11px] leading-[1.5] text-muted">{category.description}</p><span className="mt-auto block pt-3 font-mono text-[10px] text-[#5f6259]">{String(count).padStart(2, "0")} tools</span>
					</Link>;
				})}</div>
				<div className="mt-[23px] flex items-center gap-3 border border-[#d8dfd1] bg-[#e9ede3] px-[17px] py-[15px] text-xs leading-[1.55] text-[#50584e] max-[620px]:items-start max-[620px]:p-[14px]">
					<LockKeyhole className="shrink-0 text-[#536c50]" size={17} aria-hidden="true" />
					<span><strong className="font-bold text-forest">Private by nature.</strong> Available tools run in your browser. Your inputs stay on your device.</span>
				</div>
			</Shell>
		</section>

		<section className="border-t border-line bg-[#f7f5ee] py-[54px] max-[620px]:py-10" aria-labelledby="contribute-title">
			<Shell>
				<div className="mb-6 max-w-[640px]">
					<p className="m-0 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark">Built better together</p>
					<h2 id="contribute-title" className="mb-2 mt-2 font-serif text-[34px] font-normal leading-[1.05] tracking-[-.02em] max-[620px]:text-[30px]">Have an idea? Found a snag?</h2>
					<p className="m-0 text-[13px] leading-[1.65] text-[#60635b]">Tell us what would make ClickKit more useful. Report a problem, suggest a tool or improvement, or help make a fix with a pull request.</p>
				</div>
				<div className="grid grid-cols-3 border-l border-t border-line max-[620px]:grid-cols-1">
					<a className="group flex min-h-[120px] flex-col items-start border-b border-r border-line bg-surface p-5 transition-colors hover:bg-[#f0efe9] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent" href="https://github.com/detachedsoul/click-kit/issues/new" target="_blank" rel="noreferrer">
						<Bug className="text-accent" size={19} aria-hidden="true" />
						<span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink">Report an issue <ArrowRight className="transition-transform group-hover:translate-x-1" size={14} aria-hidden="true" /></span>
						<span className="mt-1 text-[11px] text-muted">Let us know what isn’t working.</span>
					</a>
					<a className="group flex min-h-[120px] flex-col items-start border-b border-r border-line bg-surface p-5 transition-colors hover:bg-[#f0efe9] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent" href="https://github.com/detachedsoul/click-kit/issues" target="_blank" rel="noreferrer">
						<Lightbulb className="text-accent" size={19} aria-hidden="true" />
						<span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink">Share a suggestion <ArrowRight className="transition-transform group-hover:translate-x-1" size={14} aria-hidden="true" /></span>
						<span className="mt-1 text-[11px] text-muted">Request a tool or propose an improvement.</span>
					</a>
					<a className="group flex min-h-[120px] flex-col items-start border-b border-r border-line bg-surface p-5 transition-colors hover:bg-[#f0efe9] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent" href="https://github.com/detachedsoul/click-kit/compare" target="_blank" rel="noreferrer">
						<GitPullRequest className="text-accent" size={19} aria-hidden="true" />
						<span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-ink">Open a pull request <ArrowRight className="transition-transform group-hover:translate-x-1" size={14} aria-hidden="true" /></span>
						<span className="mt-1 text-[11px] text-muted">Help build the improvements you want to see.</span>
					</a>
				</div>
			</Shell>
		</section>
	</>;
};

export default HomePage;
