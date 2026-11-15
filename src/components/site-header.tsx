"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
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
		<header className="site-header">
			<div className="shell header-inner">
				<Link className="brand" href="/" aria-label="ClickKit home">
					<span className="brand-mark" aria-hidden="true">c</span>clickkit
				</Link>
				<nav className="header-links" aria-label="Main navigation">
					<Link href="/#tools">All tools</Link>
					<Link href="/#categories">Categories</Link>
				</nav>
				<nav className="mobile-nav" aria-label="Main navigation">
					<Link href="/#tools">Tools</Link><Link href="/#categories">Categories</Link>
				</nav>
				<div className="header-search">
					<Search className="search-icon" size={15} aria-hidden="true" />
					<input
						ref={inputRef}
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
					<span className="search-shortcut" aria-hidden="true">⌘ K</span>
					{query && <div className="search-results" id="tool-search-results" role="listbox" aria-label="Tool search results">
						{results.length ? results.map((tool, index) => {
							const category = categories.find((item) => item.id === tool.category);
							return <Link className={`search-result${index === activeIndex ? " search-result-active" : ""}`} key={tool.id} id={`search-option-${tool.id}`} role="option" aria-selected={index === activeIndex} href={`/tools/${tool.slug}`} onClick={clearQuery}>
								<span>{tool.name}</span><small>{category?.name}</small>
							</Link>;
						}) : <div className="search-result"><span>No matching tools</span><small>Try another term</small></div>}
					</div>}
				</div>
			</div>
		</header>
	);
};

export default SiteHeader;
