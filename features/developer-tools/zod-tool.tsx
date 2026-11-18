"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToZod } from "@/features/developer-tools/zod-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const sample = `{
  "id": 42,
  "name": "Ada Lovelace",
  "active": true,
  "score": 9.5,
  "tags": ["math"],
  "profile": { "city": "Lagos", "age": 36 },
  "items": [{ "sku": "kit-1", "qty": 2, "note": null }]
}`;

export const JsonZodTool = () => {
	const [source, setSource] = useState(sample);
	const [rootName, setRootName] = useState("Root");
	const result = useMemo(() => {
		try {
			return { code: jsonToZod(source, rootName), error: "" };
		} catch (error) {
			return { code: "", error: error instanceof Error ? error.message : "Could not generate a schema." };
		}
	}, [source, rootName]);
	return (
		<ToolPanel>
			<label className={`${labelClassName} max-w-[260px]`} htmlFor="zod-root">
				Schema name
				<input className={fieldClassName} id="zod-root" value={rootName} onChange={(event) => setRootName(event.target.value)} placeholder="Root" />
			</label>
			<TextAreaField id="zod-input" label="JSON sample" value={source} onChange={setSource} placeholder="Paste JSON…" rows={12} />
			<ErrorNote message={result.error} />
			{!result.error && <ResultBlock title="Zod schema" value={result.code} rows={16} fileName="schema.ts" />}
			<p className={hintClassName}>
				Keys missing from some array elements become <code className="font-mono text-[11px]">.optional()</code>, and nulls become{" "}
				<code className="font-mono text-[11px]">.nullable()</code>.
			</p>
		</ToolPanel>
	);
};
