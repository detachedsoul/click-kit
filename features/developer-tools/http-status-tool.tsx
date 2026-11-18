"use client";

import { useMemo, useState } from "react";
import { filterStatuses, httpStatuses, statusCategories, type StatusCategory } from "@/features/developer-tools/http-status-utils";
import { ToolPanel, buttonClassName, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

export const HttpStatusTool = () => {
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState<StatusCategory | "all">("all");
	const results = useMemo(() => filterStatuses(query, category), [query, category]);
	return (
		<ToolPanel>
			<div className="flex flex-col gap-4">
				<label className={labelClassName} htmlFor="status-search">
					Search by code, name, or meaning
					<input
						className={fieldClassName}
						id="status-search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="429, redirect, validation…"
					/>
				</label>
				<div className="flex flex-wrap gap-2" role="group" aria-label="Status category">
					{statusCategories.map((item) => (
						<button
							className={`${buttonClassName} ${category === item.id ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`}
							key={item.id}
							type="button"
							aria-pressed={category === item.id}
							onClick={() => setCategory(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>
			<p className="m-0 text-xs text-muted" role="status">
				{results.length} of {httpStatuses.length} status codes shown.
			</p>
			{results.length === 0 ? (
				<p className={hintClassName}>No status codes match that search. Try a number, a phrase from the name, or clear the filters.</p>
			) : (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{results.map((item) => (
						<li className="border border-line bg-[#fbfaf7] px-4 py-3" key={item.code}>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="font-mono text-sm font-semibold text-ink">{item.code}</span>
								<span className="text-sm text-ink">{item.name}</span>
								<span className="ml-auto font-mono text-[10px] uppercase tracking-[.08em] text-[#7a7c72]">{item.category}</span>
							</div>
							<p className="m-0 mt-1 text-xs leading-relaxed text-[#5b5e55]">{item.description}</p>
						</li>
					))}
				</ul>
			)}
		</ToolPanel>
	);
};
