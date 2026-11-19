import Link from "next/link";
import Shell from "@/components/shell";
import { LogoMark } from "@/components/logo";

const footerLinks = [
	{ href: "/tools", label: "All tools" },
	{ href: "/#categories", label: "Categories" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/privacy", label: "Privacy" },
	{ href: "https://github.com/detachedsoul/click-kit", label: "GitHub", external: true },
];

const SiteFooter = () => (
	<footer className="border-t border-line py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[11px] text-[#5f6259]">
		<Shell className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-[620px]:flex-col max-[620px]:items-start">
			<span className="inline-flex items-center gap-2 font-bold text-[#41423c]">
				<LogoMark size={18} />
				clickkit
			</span>
			<nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
				{footerLinks.map((link) =>
					link.external ? (
						<a className="inline-flex min-h-9 items-center hover:text-accent-dark" href={link.href} key={link.href} rel="noreferrer" target="_blank">
							{link.label}
						</a>
					) : (
						<Link className="inline-flex min-h-9 items-center hover:text-accent-dark" href={link.href} key={link.href}>
							{link.label}
						</Link>
					),
				)}
			</nav>
			<span className="">Small tools. Less friction. Your data stays yours.</span>
		</Shell>
	</footer>
);

export default SiteFooter;
