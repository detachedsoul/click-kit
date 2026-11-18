"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import ToolCard from "@/components/tool-card";
import { categories, tools } from "@/lib/tools";

const STORAGE_KEY = "clickkit:tools-category";

const readSavedCategory = () => {
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		return saved && categories.some((item) => item.id === saved) ? saved : "all";
	} catch {
		return "all";
	}
};

const writeSavedCategory = (value: string) => {
	try {
		window.localStorage.setItem(STORAGE_KEY, value);
	} catch {
		// Storage can be disabled or full; the filter still works for this visit.
	}
};

const subscribeToStorage = (onChange: () => void) => {
	window.addEventListener("storage", onChange);
	return () => window.removeEventListener("storage", onChange);
};

const matchesQuery = (tool: (typeof tools)[number], query: string) => {
	const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
	if (!words.length) return true;
	const category = categories.find((item) => item.id === tool.category);
	const haystack = `${tool.name} ${tool.description} ${tool.keywords.join(" ")} ${category?.name ?? ""}`.toLowerCase();
	return words.every((word) => haystack.includes(word));
};

const ToolsBrowser = () => {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	// The last category lives in localStorage; the server snapshot keeps the static HTML on "all".
	const saved = useSyncExternalStore(subscribeToStorage, readSavedCategory, () => "all");
	const category = selected ?? saved;
	const chooseCategory = (value: string) => {
		setSelected(value);
		writeSavedCategory(value);
	};

	useEffect(() => {
		const handleShortcut = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing = target ? target.closest("input, textarea, select, [contenteditable='true']") !== null : false;
			if (event.key === "/" && !typing) {
				event.preventDefault();
				inputRef.current?.focus();
			}
			if (event.key === "Escape" && document.activeElement === inputRef.current) {
				setQuery("");
				inputRef.current?.blur();
			}
		};
		window.addEventListener("keydown", handleShortcut);
		return () => window.removeEventListener("keydown", handleShortcut);
	}, []);

	const filtered = useMemo(
		() => tools.filter((tool) => (category === "all" || tool.category === category) && matchesQuery(tool, query)),
		[category, query],
	);
	const activeCategory = categories.find((item) => item.id === category);
	const filtering = category !== "all" || query.trim().length > 0;
	const reset = () => {
		setQuery("");
		chooseCategory("all");
		inputRef.current?.focus();
	};

	return (
		<div className="flex flex-col gap-5 pb-[80px]">
			<div className="flex flex-col gap-3">
				<div className="relative max-w-[460px]">
					<Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#85857e]" size={15} />
					<input
						aria-label="Search all tools"
						className="h-11 w-full border border-[#d9d7cd] bg-surface pl-9 pr-10 text-sm text-ink outline-2 outline-offset-2 outline-transparent transition-colors placeholder:text-[#96958c] focus:border-accent focus:outline-accent"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Filter by name, keyword, or category…"
						ref={inputRef}
						type="search"
						value={query}
					/>
					{query ? (
						<button
							aria-label="Clear filter"
							className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-[3px] text-[#898981] hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
							type="button"
						>
							<X aria-hidden="true" size={14} />
						</button>
					) : (
						<kbd aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[3px] border border-line px-[5px] py-px font-mono text-[10px] text-[#898981]">
							/
						</kbd>
					)}
				</div>
				<div aria-label="Filter by category" className="flex flex-wrap gap-2" role="group">
					{[{ id: "all", name: "All tools", count: tools.length }, ...categories.map((item) => ({ id: item.id, name: item.name, count: tools.filter((tool) => tool.category === item.id).length }))].map((item) => {
						const active = category === item.id;
						return (
							<button
								aria-pressed={active}
								className={`inline-flex min-h-9 cursor-pointer items-center gap-2 border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
									active ? "border-forest bg-forest text-white" : "border-line bg-surface text-[#50534c] hover:border-[#aaa69a] hover:text-ink"
								}`}
								key={item.id}
								onClick={() => chooseCategory(item.id)}
								type="button"
							>
								{item.name}
								<span className={`font-mono text-[10px] ${active ? "text-[#d4ddcb]" : "text-muted"}`}>{item.count}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
				<p aria-live="polite" className="m-0" role="status">
					{filtered.length === tools.length ? `${tools.length} tools` : `${filtered.length} of ${tools.length} tools`}
					{activeCategory ? ` · ${activeCategory.name}` : ""}
					{query.trim() ? ` · “${query.trim()}”` : ""}
				</p>
				{filtering && (
					<button className="cursor-pointer text-xs text-[#50534c] underline underline-offset-2 hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={reset} type="button">
						Clear filters
					</button>
				)}
			</div>

			{filtered.length ? (
				<div className="grid grid-cols-4 border-l border-t border-line max-[900px]:grid-cols-2">{filtered.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div>
			) : (
				<div className="border border-line bg-surface p-8 text-center">
					<p className="m-0 font-serif text-2xl">Nothing matches that yet.</p>
					<p className="mx-auto mb-4 mt-2 max-w-[420px] text-[13px] leading-[1.6] text-muted">
						No tool mentions “{query.trim() || activeCategory?.name}”. Try a shorter word, or browse everything ClickKit has.
					</p>
					<button
						className="inline-flex min-h-10 cursor-pointer items-center border border-forest bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						onClick={reset}
						type="button"
					>
						Show all tools
					</button>
				</div>
			)}
		</div>
	);
};

export default ToolsBrowser;
