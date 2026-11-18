"use client";

import { useMemo, useState } from "react";
import { CheckboxField, ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToErd } from "@/features/developer-tools/mermaid-utils";

const sample = `{
  "users": [
    {
      "id": 1,
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "created_at": "2024-01-02T09:30:00Z",
      "address": { "city": "Lagos", "country": "NG" },
      "posts": [
        { "id": 10, "title": "Notes on the engine", "published": true, "views": 1240 }
      ]
    }
  ],
  "tags": ["maths", "history"]
}`;

const sampleErd = `erDiagram
  User {
    int id
    string name
    string email
    date created_at
    int address_id
  }
  User ||--|| Address : "address"
  User ||--o{ Post : "posts"`;

export default function MermaidTool() {
	const [source, setSource] = useState(sample);
	const [includeRelations, setIncludeRelations] = useState(true);
	const result = useMemo(() => {
		try {
			return { value: jsonToErd(source, { includeRelations }), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Could not read this JSON." };
		}
	}, [source, includeRelations]);
	return (
		<ToolPanel>
			<TextAreaField
				hint="Top-level arrays become entities, nested objects become one-to-one relations, and nested arrays become one-to-many relations."
				id="mermaid-input"
				label="Sample JSON"
				onChange={setSource}
				placeholder="Paste an API response or a record shape…"
				value={source}
			/>
			<CheckboxField checked={includeRelations} hint="Off draws the entities and fields only, without relationship lines." id="mermaid-relations" label="Include relationship lines" onChange={setIncludeRelations} />
			<ErrorNote message={result.error} />
			{result.value && (
				<>
					<StatGrid
						items={[
							{ label: "Entities", value: String(result.value.entityCount) },
							{ label: "Attributes", value: String(result.value.entities.reduce((total, item) => total + item.attributes.length, 0)) },
							{ label: "Relations", value: String(result.value.relations.length) },
							{ label: "Lines", value: String(result.value.mermaid.split("\n").length) },
						]}
					/>
					<ResultBlock fileName="schema.mmd" rows={14} title="Mermaid ER diagram" value={result.value.mermaid} />
					<section className="flex flex-col gap-2">
						<h2 className="m-0 text-sm font-semibold">Entities</h2>
						<ul className="m-0 grid gap-2 pl-5 text-xs">
							{result.value.entities.map((entity) => (
								<li key={entity.name}>
									<span className="font-mono font-semibold">{entity.name}</span> — {entity.attributes.map((attribute) => `${attribute.name}: ${attribute.type}`).join(", ")}
								</li>
							))}
						</ul>
					</section>
					<details className="border border-line bg-[#fbfaf7] px-3 py-2 text-xs">
						<summary className="cursor-pointer font-semibold">Where to paste this</summary>
						<pre className="m-0 mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed">{sampleErd}</pre>
						<p className={`${hintClassName} mt-2`}>
							Paste the output into GitHub markdown as a <code>```mermaid</code> block, into mermaid.live, or into any docs tool that renders Mermaid.
						</p>
					</details>
				</>
			)}
			<p className={hintClassName}>
				Types are inferred from the values: integers, decimals, booleans, ISO dates, strings, and nested JSON. Rename entities or columns in the output if your
				naming conventions differ.
			</p>
		</ToolPanel>
	);
}
