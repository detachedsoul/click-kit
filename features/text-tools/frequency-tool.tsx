"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { frequencyToCsv, frequencyToJson, wordFrequency } from "@/features/text-tools/frequency-utils";
import { DownloadLink, ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `Good documentation is short, concrete, and honest. Short paragraphs help readers scan. Concrete examples beat abstract rules, and honest limitations build trust. Every paragraph should earn its place: if a sentence does not add information, cut it.`;

export const FrequencyTool = () => {
	const [source, setSource] = useState(sample);
	const [ngram, setNgram] = useState<1 | 2 | 3>(1);
	const [ignoreCase, setIgnoreCase] = useState(true);
	const [removeStopWords, setRemoveStopWords] = useState(false);
	const [minimumLength, setMinimumLength] = useState(1);
	const [limit, setLimit] = useState(25);
	const result = useMemo(() => {
		try {
			return { report: wordFrequency(source, { ngram, ignoreCase, removeStopWords, minimumLength, limit }), error: "" };
		} catch (error) {
			return { report: null, error: error instanceof Error ? error.message : "Could not analyse this text." };
		}
	}, [source, ngram, ignoreCase, removeStopWords, minimumLength, limit]);
	const maximum = result.report?.rows[0]?.count ?? 1;
	return (
		<ToolPanel>
			<TextAreaField id="frequency-input" label="Your text" value={source} onChange={setSource} placeholder="Paste text to count repeated words and phrases." rows={10} />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<label className={labelClassName} htmlFor="frequency-ngram">
					Phrase length
					<select className={selectClassName} id="frequency-ngram" onChange={(event) => setNgram(Number(event.target.value) as 1 | 2 | 3)} value={ngram}>
						<option value={1}>Single words</option>
						<option value={2}>Two-word phrases</option>
						<option value={3}>Three-word phrases</option>
					</select>
				</label>
				<label className={labelClassName} htmlFor="frequency-limit">
					Show top
					<input className={fieldClassName} id="frequency-limit" max={500} min={1} onChange={(event) => setLimit(Number(event.target.value))} type="number" value={limit} />
				</label>
				<label className={labelClassName} htmlFor="frequency-min-length">
					Min word length
					<input className={fieldClassName} id="frequency-min-length" max={20} min={1} onChange={(event) => setMinimumLength(Number(event.target.value))} type="number" value={minimumLength} />
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="frequency-case">
					<input checked={ignoreCase} id="frequency-case" onChange={(event) => setIgnoreCase(event.target.checked)} type="checkbox" />
					Ignore case
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="frequency-stop">
					<input checked={removeStopWords} id="frequency-stop" onChange={(event) => setRemoveStopWords(event.target.checked)} type="checkbox" />
					Remove stop words
				</label>
			</div>
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Words", value: String(result.report.words) },
							{ label: "Unique phrases", value: String(result.report.unique) },
							{ label: "Total phrases", value: String(result.report.total) },
							{ label: "Shown", value: String(result.report.rows.length) },
						]}
					/>
					<ol className="m-0 flex list-none flex-col gap-1.5 p-0">
						{result.report.rows.map((row) => (
							<li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3" key={row.phrase}>
								<span className="flex min-w-0 items-center gap-3">
									<span className="truncate text-sm text-ink">{row.phrase}</span>
									<span className="h-1.5 shrink-0 rounded-full bg-accent/25" style={{ width: `${Math.max(4, (row.count / maximum) * 100)}px` }} />
								</span>
								<span className="font-mono text-[11px] text-muted">
									{row.count} · {row.share}%
								</span>
							</li>
						))}
					</ol>
					<ResultBlock title="Result" value={frequencyToJson(result.report.rows)} rows={8} fileName="word-frequency.json" />
					<div>
						<DownloadLink fileName="word-frequency.csv" label="Download CSV" text={frequencyToCsv(result.report.rows)} />
					</div>
				</>
			)}
			<p className={hintClassName}>
				Share is the phrase&apos;s percentage of all phrases counted, after the stop-word and length filters are applied. Stop words are common English
				function words such as “the” and “and”.
			</p>
		</ToolPanel>
	);
};
