import Link from "next/link";
import type { Metadata } from "next";
import Shell from "@/components/shell";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { siteName, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
	title: "Privacy",
	description: "How ClickKit handles your data: every tool runs in your browser, and nothing you paste is uploaded.",
	alternates: { canonical: "/privacy" },
	openGraph: { type: "article", title: "Privacy · ClickKit", description: "Every ClickKit tool runs in your browser. Your inputs never leave your device.", url: `${siteUrl}/privacy` },
};

const points = [
	{
		title: "Your input stays on your device",
		body: "Every tool on ClickKit runs as JavaScript in your browser. Text, files, images, and numbers you paste are processed locally and are never sent to a server.",
	},
	{
		title: "No accounts, no uploads",
		body: "There is no sign-up, no login, and no storage bucket behind the tools. Nothing you enter is saved between visits unless your browser restores a form field for you.",
	},
	{
		title: "No analytics on what you paste",
		body: "Page views may be measured in aggregate, but tool inputs are not collected, logged, or profiled. Nothing you type is used to train anything.",
	},
	{
		title: "Third parties",
		body: "The site is hosted on Vercel, which processes standard request data such as IP addresses and user agents for delivery and abuse prevention. Opening a GitHub link leaves ClickKit and is covered by GitHub's own policy.",
	},
	{
		title: "Cookies",
		body: "ClickKit sets no tracking cookies. Any preferences a tool remembers live in that page's memory and disappear when you close the tab.",
	},
];

export default function PrivacyPage() {
	return (
		<Shell>
			<header className="max-w-[680px] py-[50px] pb-7 max-[620px]:py-[36px]">
				<nav aria-label="Breadcrumb" className="flex items-center gap-[9px] text-[11px] text-[#5f6259]">
					<Link className="hover:text-accent-dark" href="/">
						Home
					</Link>
					<span aria-hidden="true">/</span>
					<span>Privacy</span>
				</nav>
				<p className="mb-0 mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.09em] text-accent-dark">
					<LockKeyhole aria-hidden="true" size={13} /> Private by nature
				</p>
				<h1 className="mb-3 mt-2 font-serif text-[clamp(44px,6vw,68px)] font-normal leading-[.95] tracking-[-.035em]">Privacy, in plain words.</h1>
				<p className="m-0 text-sm leading-[1.7] text-[#60635b]">
					{siteName} exists to do a small job and get out of the way. That also means handling as little of your data as possible — ideally, none.
				</p>
			</header>
			<div className="grid max-w-[840px] gap-px border border-line bg-line">
				{points.map((point, index) => (
					<section className="bg-surface p-6 max-[620px]:p-4" key={point.title}>
						<h2 className="m-0 flex items-baseline gap-3 text-sm font-semibold">
							<span className="font-mono text-[10px] text-accent-dark">{String(index + 1).padStart(2, "0")}</span>
							{point.title}
						</h2>
						<p className="mb-0 ml-[26px] mt-2 text-[13px] leading-[1.7] text-[#60635b]">{point.body}</p>
					</section>
				))}
			</div>
			<p className="my-6 max-w-[680px] text-xs leading-[1.7] text-muted">
				Spotted something here that does not match how the site behaves? <a className="text-accent-dark underline hover:text-accent" href="https://github.com/detachedsoul/click-kit/issues/new" rel="noreferrer" target="_blank">Open an issue</a> and it
				will be fixed.
			</p>
			<Link className="mb-[70px] inline-flex items-center gap-2 border border-line bg-surface px-4 py-2.5 text-xs hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="/">
				<ArrowLeft aria-hidden="true" size={14} /> Back to the tools
			</Link>
		</Shell>
	);
}
