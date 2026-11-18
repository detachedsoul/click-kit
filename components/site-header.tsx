"use client";

import Link from "next/link";
import Shell from "@/components/shell";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { LogoLockup } from "@/components/logo";
import { categories, tools } from "@/lib/tools";

const SiteHeader = () => {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const results = query.trim()
		? tools.filter((tool) => `${tool.name} ${tool.description} ${tool.keywords.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
		: [];

	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing = target ? target.closest("input, textarea, select, [contenteditable='true']") !== null : false;
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				inputRef.current?.focus();
			} else if (event.key === "/" && !typing) {
				event.preventDefault();
				inputRef.current?.focus();
			}
			if (event.key === "Escape") {
				setQuery("");
				inputRef.current?.blur();
			}
		};
		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, []);

	const clearQuery = () => {
		setQuery("");
		setActiveIndex(0);
	};

	return (
		<header className="sticky top-0 z-20 h-[72px] border-b border-line bg-paper/95 backdrop-blur-[14px] max-[620px]:static max-[620px]:h-auto">
			<Shell className="flex h-full items-center gap-[38px] max-[900px]:gap-6 max-[620px]:min-h-[63px] max-[620px]:flex-wrap max-[620px]:gap-0 max-[620px]:pb-3">
				<Link className="inline-flex shrink-0 items-center whitespace-nowrap text-[21px] font-bold tracking-[-1.2px] max-[620px]:text-[19px]" href="/" aria-label="ClickKit home">
					<LogoLockup size={30} className="max-[620px]:[&_svg]:size-[27px]" />
				</Link>
				<nav className="flex items-center gap-6 text-[13px] text-[#55594f] max-[900px]:gap-[15px] max-[620px]:hidden" aria-label="Main navigation">
					<Link className="transition-colors hover:text-accent-dark" href="/tools">All tools</Link>
					<Link className="transition-colors hover:text-accent-dark" href="/changelog">Changelog</Link>
					<Link className="transition-colors hover:text-accent-dark" href="/#categories">Categories</Link>
				</nav>
				<nav className="hidden items-center gap-4 text-xs text-[#55594f] max-[620px]:ml-auto max-[620px]:flex" aria-label="Main navigation">
					<Link href="/tools">Tools</Link><Link href="/changelog">Changelog</Link><Link href="/#categories">Categories</Link>
				</nav>
				<div className="relative ml-auto w-[min(310px,32vw)] max-[620px]:order-3 max-[620px]:mt-2.5 max-[620px]:w-full">
					<Search className="pointer-events-none absolute left-3 top-[12px] text-[#85857e]" size={15} aria-hidden="true" />
					<input
						ref={inputRef}
						className="h-[39px] w-full border border-line bg-surface py-0 pl-[37px] pr-[42px] text-[13px] outline-2 outline-offset-2 outline-transparent transition-[border-color,outline-color] focus:border-accent focus:outline-accent max-[620px]:h-[42px]"
						role="combobox"
						aria-label="Search tools"
						aria-expanded={results.length > 0}
						aria-controls="tool-search-results"
						aria-autocomplete="list"
						aria-activedescendant={results.length ? `search-option-${results[activeIndex]?.id}` : undefined}
						placeholder="Find a tool..."
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={(event) => {
							if (event.key === "ArrowDown" && results.length) {
								event.preventDefault();
								setActiveIndex((index) => (index + 1) % results.length);
							} else if (event.key === "ArrowUp" && results.length) {
								event.preventDefault();
								setActiveIndex((index) => (index - 1 + results.length) % results.length);
							} else if (event.key === "Enter" && results[activeIndex]) {
								event.preventDefault();
								router.push(`/tools/${results[activeIndex].slug}`);
								clearQuery();
							}
						}}
					/>
					{query ? (
						<button
							aria-label="Clear search"
							className="absolute right-2 top-[9px] grid size-6 cursor-pointer place-items-center rounded-[3px] text-[#898981] hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-[620px]:top-[11px]"
							onClick={() => {
								clearQuery();
								inputRef.current?.focus();
							}}
							type="button"
						>
							<X aria-hidden="true" size={14} />
						</button>
					) : (
						<span aria-hidden="true" className="absolute right-2.5 top-[9px] hidden rounded-[3px] border border-line px-[5px] py-px font-mono text-[10px] text-[#898981] min-[621px]:block">⌘ K</span>
					)}
					<span aria-live="polite" className="sr-only" role="status">
						{query ? `${results.length} matching tool${results.length === 1 ? "" : "s"}` : ""}
					</span>
					{query && <div className="absolute left-0 right-0 top-[47px] z-40 border border-line bg-surface p-1.5 shadow-[0_16px_40px_#22231f17] max-[620px]:top-[50px]" id="tool-search-results" role="listbox" aria-label="Tool search results">
						{results.length ? results.map((tool, index) => {
							const category = categories.find((item) => item.id === tool.category);
							return <Link className={`flex items-center justify-between gap-2.5 p-2.5 text-[13px] hover:bg-paper focus:bg-paper ${index === activeIndex ? "bg-paper" : ""}`} key={tool.id} id={`search-option-${tool.id}`} role="option" aria-selected={index === activeIndex} href={`/tools/${tool.slug}`} onClick={clearQuery}>
								<span>{tool.name}</span><small className="text-[11px] text-muted">{tool.status === "available" ? "Ready to use" : category?.name}</small>
							</Link>;
						}) : <div className="flex items-center justify-between gap-2.5 p-2.5 text-[13px]"><span>No matching tools</span><small className="text-[11px] text-muted">Try another term</small></div>}
					</div>}
				</div>
			</Shell>
		</header>
	);
};

export default SiteHeader;
