"use client";

import { useMemo, useState } from "react";
import { mimeTypes, searchMime } from "@/features/developer-tools/mime-utils";
import { ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

export const MimeLookupTool = () => {
	const [query, setQuery] = useState("");
	const results = useMemo(() => searchMime(query), [query]);
	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="mime-search">
				Search by extension, MIME type, kind, or description
				<input
					className={fieldClassName}
					id="mime-search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="webp, application/json, font, spreadsheet…"
				/>
			</label>
			<p className="m-0 text-xs text-muted" role="status">
				{results.length} of {mimeTypes.length} types shown.
			</p>
			{results.length === 0 ? (
				<p className={hintClassName}>Nothing matched. Try a file extension such as .woff2 or a type such as application/pdf.</p>
			) : (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{results.map((item) => (
						<li className="border border-line bg-[#fbfaf7] px-4 py-3" key={item.mime}>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="font-mono text-[13px] font-semibold text-ink">{item.mime}</span>
								<span className="ml-auto font-mono text-[10px] uppercase tracking-[.08em] text-[#5f6259]">{item.kind}</span>
							</div>
							<p className="m-0 mt-1 text-xs leading-relaxed text-[#5b5e55]">{item.description}</p>
							<p className="m-0 mt-1 font-mono text-[11px] text-[#5f6259]">
								{item.extensions.map((extension) => `.${extension}`).join("  ")}
							</p>
						</li>
					))}
				</ul>
			)}
		</ToolPanel>
	);
};
