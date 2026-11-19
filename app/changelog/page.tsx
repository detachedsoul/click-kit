import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, GitCommitHorizontal, Sparkles } from "lucide-react";
import Shell from "@/components/shell";
import ToolCard from "@/components/tool-card";
import changelog from "@/lib/changelog.generated.json";
import { siteUrl } from "@/lib/site";
import { categories, tools } from "@/lib/tools";
import { addedOnLabel, newToolCount, recentToolReleases, toolAddedOn, toolsAddedOn } from "@/lib/tool-recency";

export const metadata: Metadata = {
	title: "Changelog",
	description: "Everything added, changed, and fixed in ClickKit, newest first — generated straight from the git history.",
	alternates: { canonical: "/changelog" },
	openGraph: { type: "website", title: "ClickKit changelog", description: "What's new in ClickKit, newest first.", url: `${siteUrl}/changelog` },
};

const GROUP_STYLES: Record<string, string> = {
	Added: "bg-[#e6ecdf] text-[#4d6247]",
	Changed: "bg-[#eae7dd] text-[#6b6553]",
	Fixed: "bg-[#f3e2d5] text-[#8a4a2c]",
	Maintenance: "bg-[#ecebe5] text-[#5f6259]",
};

const groupClass = (group: string) => GROUP_STYLES[group] ?? GROUP_STYLES.Maintenance;

const ChangelogPage = () => {
	const releases = changelog.releases;
	const recent = recentToolReleases().flatMap((release) => release.tools);
	const fresh = newToolCount();
	const totalTools = tools.filter((tool) => tool.status === "available").length;

	return (
		<Shell>
			<header className="max-w-[720px] py-[50px] pb-10 max-[620px]:py-[36px] max-[620px]:pb-8">
				<nav aria-label="Breadcrumb" className="flex items-center gap-[9px] text-[11px] text-[#5f6259]">
					<Link className="hover:text-accent-dark" href="/">
						Home
					</Link>
					<span aria-hidden="true">/</span>
					<span>Changelog</span>
				</nav>
				<h1 className="mb-3 mt-6 font-serif text-[clamp(46px,6.5vw,76px)] font-normal leading-[.92] tracking-[-.04em]">What&apos;s new.</h1>
				<p className="m-0 text-sm leading-[1.7] text-[#60635b]">
					Every tool added, changed, or fixed, straight from the repository history. {totalTools} tools are ready today, {fresh} of them added in the last two
					weeks. Additions are dated the day they landed, so the badges elsewhere on the site always agree with this page.
				</p>
			</header>

			{recent.length > 0 ? (
				<section aria-labelledby="fresh-title" className="border-t border-line py-8 max-[620px]:py-6">
					<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 className="m-0 flex items-center gap-2 font-serif text-[26px] font-normal leading-[1.05] tracking-[-.02em]" id="fresh-title">
								<Sparkles aria-hidden="true" className="text-accent" size={18} /> New this fortnight
							</h2>
							<p className="mb-0 mt-1.5 text-xs text-muted">{recent.length} tools inside the two-week new-tools window.</p>
						</div>
						<Link className="inline-flex items-center gap-1.5 text-xs text-[#50534c] hover:text-accent-dark" href="/tools">
							Browse all tools <ArrowUpRight aria-hidden="true" size={13} />
						</Link>
					</div>
					<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{recent.slice(0, 8).map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
				</section>
			) : null}

			<section aria-labelledby="history-title" className="border-t border-line py-8 pb-[70px] max-[620px]:py-6 max-[620px]:pb-[55px]">
				<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 className="m-0 font-serif text-[26px] font-normal leading-[1.05] tracking-[-.02em]" id="history-title">
							Release history
						</h2>
						<p className="mb-0 mt-1.5 text-xs text-muted">One entry per commit, newest first.</p>
					</div>
					<a className="inline-flex items-center gap-1.5 text-xs text-[#50534c] hover:text-accent-dark" href="https://github.com/detachedsoul/click-kit/commits/main" rel="noreferrer" target="_blank">
						<GitCommitHorizontal aria-hidden="true" size={14} /> Commit log
					</a>
				</div>
				{releases.length === 0 ? (
					<p className="m-0 border border-line bg-surface p-4 text-xs text-muted">
						No release notes yet. Run <code className="font-mono">npm run changelog</code> to rebuild them from git history.
					</p>
				) : null}
				<ol className="m-0 flex list-none flex-col gap-8 p-0">
					{releases.map((release) => {
						const addedTools = toolsAddedOn(release.date);
						return (
							<li key={release.date}>
								<div className="flex flex-wrap items-baseline gap-3 border-b border-line pb-2">
									<h3 className="m-0 text-sm font-semibold text-ink">{addedOnLabel(release.date)}</h3>
									{addedTools.length > 0 ? <span className="font-mono text-[10px] uppercase tracking-[.06em] text-[#8a5320]">{addedTools.length} new tool{addedTools.length === 1 ? "" : "s"}</span> : null}
								</div>
								{addedTools.length > 0 ? (
									<ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
										{addedTools.map((tool) => (
											<li key={tool.id}>
												<Link
													className="inline-flex items-center gap-1.5 border border-[#e2d6c2] bg-[#fbf6ec] px-2 py-1 text-[11px] text-[#6f4a22] transition-colors hover:border-accent hover:text-accent-dark"
													href={`/tools/${tool.slug}`}
												>
													{tool.name}
													<span className="text-[10px] text-[#7a6136]">{categories.find((category) => category.id === tool.category)?.name}</span>
												</Link>
											</li>
										))}
									</ul>
								) : null}
								{release.groups.map((group) => (
									<div className="mt-4" key={group.group}>
										<h4 className="m-0 mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.08em] text-[#5f6259]">
											<span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[.02em] ${groupClass(group.group)}`}>{group.group}</span>
										</h4>
										<ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-ink">
											{group.entries.map((entry) => (
												<li key={`${entry.hash}-${entry.summary}`}>
													{entry.scope ? <span className="font-mono text-[11px] uppercase tracking-[.04em] text-[#5f6259]">{entry.scope} </span> : null}
													{entry.summary}{" "}
													<a className="font-mono text-[11px] text-[#5f6259] underline decoration-dotted hover:text-accent-dark" href={`https://github.com/detachedsoul/click-kit/commit/${entry.hash}`} rel="noreferrer" target="_blank">
														{entry.hash}
													</a>
												</li>
											))}
										</ul>
									</div>
								))}
							</li>
						);
					})}
				</ol>
				<p className="mb-0 mt-8 border border-line bg-[#f7f5ee] px-4 py-3 text-[11px] leading-relaxed text-muted">
					Tool dates come from <code className="font-mono">npm run tool-dates</code>, which reads the commit that first introduced each entry in the
					catalogue. The notes come from <code className="font-mono">npm run changelog</code>. Both are committed, so a deployment always shows the same
					history it was built from.
				</p>
				{recent.length > 0 ? (
					<p className="mb-0 mt-4 text-[11px] text-muted">
						Newest entries: {recent.slice(0, 3).map((tool) => `${tool.name} (${toolAddedOn(tool.slug) ? addedOnLabel(toolAddedOn(tool.slug) as string) : "undated"})`).join(", ")}.
					</p>
				) : null}
				<Link className="mt-6 inline-flex items-center gap-2 text-xs text-[#50534c] hover:text-accent-dark" href="/">
					<ArrowLeft aria-hidden="true" size={13} /> Back to home
				</Link>
			</section>
		</Shell>
	);
};

export default ChangelogPage;
