"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { applyJsonPatch, formatJsonPatch, generateJsonPatch, summariseJsonPatch } from "@/features/developer-tools/json-patch-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";

const originalSample = `{
  "name": "ClickKit",
  "version": 1,
  "tags": ["tools"],
  "owner": { "name": "Ada" }
}`;

const updatedSample = `{
  "name": "ClickKit",
  "version": 2,
  "tags": ["tools", "local"],
  "owner": { "name": "Ada", "email": "ada@example.com" }
}`;

export const JsonPatchTool = () => {
	const [original, setOriginal] = useState(originalSample);
	const [updated, setUpdated] = useState(updatedSample);
	const result = useMemo(() => {
		try {
			const operations = generateJsonPatch(original, updated);
			const applied = applyJsonPatch(original, operations);
			const roundTrips = operations.length === 0 || JSON.stringify(applied) === JSON.stringify(JSON.parse(updated) as unknown);
			return { operations, patch: formatJsonPatch(operations), counts: summariseJsonPatch(operations), roundTrips, error: "" };
		} catch (error) {
			return { operations: [], patch: "", counts: null, roundTrips: true, error: error instanceof Error ? error.message : "Could not build a patch." };
		}
	}, [original, updated]);
	return (
		<ToolPanel>
			<div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
				<TextAreaField id="patch-original" label="Original document" value={original} onChange={setOriginal} placeholder="Paste the original JSON…" rows={12} />
				<TextAreaField id="patch-updated" label="Updated document" value={updated} onChange={setUpdated} placeholder="Paste the updated JSON…" rows={12} />
			</div>
			<ErrorNote message={result.error} />
			{!result.error && result.counts && (
				<>
					<StatGrid
						items={[
							{ label: "Operations", value: String(result.operations.length) },
							{ label: "Add", value: String(result.counts.add) },
							{ label: "Remove", value: String(result.counts.remove) },
							{ label: "Replace", value: String(result.counts.replace) },
						]}
					/>
					<p className="m-0 text-xs text-muted" role="status">
						{result.operations.length === 0
							? "The documents are identical, so the patch is empty."
							: result.roundTrips
								? "Applying this patch to the original reproduces the updated document."
								: "The patch could not be verified against the updated document."}
					</p>
					<ResultBlock title="JSON Patch (RFC 6902)" value={result.patch} rows={14} fileName="patch.json" />
				</>
			)}
			<p className={hintClassName}>
				Objects diff key by key, arrays of equal length diff index by index, and anything else is replaced. Paths use JSON Pointer escaping for{" "}
				<code className="font-mono text-[11px]">~</code> and <code className="font-mono text-[11px]">/</code>.
			</p>
		</ToolPanel>
	);
};
