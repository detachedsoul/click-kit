"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { generateFixtures } from "@/features/developer-tools/fixture-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `{
  "id": 1,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "company": "Acme Labs",
  "city": "Lisbon",
  "website": "https://example.com",
  "plan": "pro",
  "seats": 4,
  "active": true,
  "joinedAt": "2024-03-01T09:30:00Z",
  "address": { "city": "Lisbon", "street": "1 Alder Way" },
  "tags": ["beta"]
}`;

export const FixtureTool = () => {
	const [source, setSource] = useState(sample);
	const [count, setCount] = useState(10);
	const [seed, setSeed] = useState("clickkit");
	const [rows, setRows] = useState(true);
	const result = useMemo(() => {
		try {
			const generated = generateFixtures(source, { count, seed });
			const text = rows ? JSON.stringify(generated.records, null, 2) : (generated.records as Record<string, unknown>[]).map((record) => JSON.stringify(record)).join("\n");
			return { text, records: generated.records, error: "" };
		} catch (error) {
			return { text: "", records: [], error: error instanceof Error ? error.message : "Could not generate fixtures." };
		}
	}, [source, count, seed, rows]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="fixture-count">
					Records
					<input className={fieldClassName} id="fixture-count" max={1000} min={1} onChange={(event) => setCount(Number(event.target.value))} type="number" value={count} />
				</label>
				<label className={labelClassName} htmlFor="fixture-seed">
					Seed
					<input className={fieldClassName} id="fixture-seed" onChange={(event) => setSeed(event.target.value)} value={seed} />
				</label>
				<span className="flex flex-col justify-end gap-2">
					<CheckboxField
						checked={!rows}
						id="fixture-rows"
						label="Emit JSON Lines instead of a JSON array"
						onChange={(jsonLines) => setRows(!jsonLines)}
					/>
				</span>
			</div>
			<TextAreaField
				id="fixture-source"
				label="Sample record"
				value={source}
				onChange={setSource}
				placeholder='{"name": "Ada", "email": "ada@example.com"}'
				rows={12}
				hint="One object describes the shape; nested objects and arrays keep their structure. Field names such as email, city, joinedAt, url, phone, and uuid pick matching fake values."
			/>
			<ErrorNote message={result.error} />
			{result.text && (
				<>
					<StatGrid
						items={[
							{ label: "Records", value: String(result.records.length) },
							{ label: "Fields", value: String(result.records.length ? Object.keys(result.records[0] as Record<string, unknown>).length : 0) },
							{ label: "Seed", value: seed || "clickkit" },
						]}
					/>
					<ResultBlock title="Result" value={result.text} rows={18} fileName={rows ? "fixtures.json" : "fixtures.jsonl"} />
				</>
			)}
			<p className={hintClassName}>
				Output is deterministic: the same seed and sample always produce the same records, so fixtures stay stable across runs and can be committed to a
				repository.
			</p>
		</ToolPanel>
	);
};
