"use client";

import { useMemo, useState } from "react";
import { CheckboxField, DownloadLink, ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { analyseKeywordDensity, verdictFor } from "@/features/text-tools/density-utils";

const sampleText =
	"Good coffee starts with good beans. We roast every batch in small lots, so the coffee you buy is fresh, traceable, and consistent. Our coffee subscription lets you choose a roast, pause any time, and learn how each coffee is grown.";

export default function DensityTool() {
	const [text, setText] = useState(sampleText);
	const [keywordInput, setKeywordInput] = useState("coffee");
	const [caseSensitive, setCaseSensitive] = useState(false);
	const keywords = useMemo(() => keywordInput.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 20), [keywordInput]);
	const report = useMemo(() => analyseKeywordDensity(text, keywords, { caseSensitive }), [text, keywords, caseSensitive]);
	const error = !text.trim() ? "Paste some text to analyse." : !keywords.length ? "Add at least one keyword or phrase to check." : "";
	const table = useMemo(() => {
		const header = "keyword                            uses  words  density  verdict";
		const rows = report.keywords.map((row) => {
			const name = row.keyword.length > 32 ? `${row.keyword.slice(0, 31)}…` : row.keyword;
			return [name.padEnd(34), String(row.count).padStart(4), String(row.words).padStart(6), `${row.density}%`.padStart(8), `  ${verdictFor(row.density)}`].join(" ");
		});
		return [header, ...rows].join("\n");
	}, [report]);
	const csv = useMemo(
		() => ["keyword,uses,words,density,verdict", ...report.keywords.map((row) => `"${row.keyword.replace(/"/gu, '""')}",${row.count},${row.words},${row.density},${verdictFor(row.density)}`)].join("\n"),
		[report],
	);
	return (
		<ToolPanel>
			<TextAreaField
				hint="Density counts whole words and phrases, so “art” will not match “chart”."
				id="density-input"
				label="Content"
				onChange={setText}
				placeholder="Paste the article, product page, or draft…"
				value={text}
			/>
			<label className={labelClassName} htmlFor="density-keywords">
				Keywords and phrases (one per line, up to 20)
				<textarea
					className="mt-2 block h-24 w-full resize-y border border-field bg-surface px-3 py-2 font-mono text-xs text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="density-keywords"
					onChange={(event) => setKeywordInput(event.target.value)}
					placeholder={"coffee\ncoffee subscription\nsmall lots"}
					value={keywordInput}
				/>
			</label>
			<CheckboxField checked={caseSensitive} hint="Off treats “Coffee” and “coffee” as different keywords." id="density-case" label="Case sensitive" onChange={setCaseSensitive} />
			<ErrorNote message={error} />
			{!error && (
				<>
					<StatGrid
						items={[
							{ label: "Words", value: String(report.totalWords) },
							{ label: "Unique words", value: String(report.uniqueWords) },
							{ label: "Keywords checked", value: String(report.keywords.length) },
							{ label: "Not used", value: String(report.missing.length) },
						]}
					/>
					<ResultBlock fileName="keyword-density.txt" rows={12} title="Density report" value={table} />
					<DownloadLink fileName="keyword-density.csv" label="Download CSV" text={csv} />
					<section className="flex flex-col gap-2">
						<h2 className="m-0 text-sm font-semibold">Most frequent terms</h2>
						<ol className="m-0 grid gap-1.5 pl-5 text-xs">
							{report.topTerms.map((term) => (
								<li key={term.term}>
									<span className="font-mono">{term.term}</span> — {term.count}× ({term.density}%)
								</li>
							))}
						</ol>
					</section>
				</>
			)}
			<p className={hintClassName}>
				Density is the share of words taken up by a keyword or phrase. Around 0.5–2.5% reads naturally for a main keyword; higher usually means the copy is
				repeating itself. Verdicts are a rule of thumb, not a ranking factor.
			</p>
		</ToolPanel>
	);
}
