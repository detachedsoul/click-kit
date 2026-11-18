"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToXml, xmlToJson } from "@/features/developer-tools/xml-utils";
import { ErrorNote, ResultBlock, SegmentedControl, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101" available="true">
    <title>Small Worlds</title>
    <price>8.95</price>
    <tags><tag>fiction</tag><tag>debut</tag></tags>
  </book>
  <book id="bk102">
    <title>Open Skies</title>
    <price>12.5</price>
  </book>
</catalog>
`;

const sampleJson = `{
  "catalog": {
    "book": [
      { "@_id": "bk101", "@_available": "true", "title": "Small Worlds", "price": "8.95", "tags": { "tag": ["fiction", "debut"] } },
      { "@_id": "bk102", "title": "Open Skies", "price": "12.5" }
    ]
  }
}
`;

type Direction = "xml-to-json" | "json-to-xml";

export const XmlJsonTool = () => {
	const [direction, setDirection] = useState<Direction>("xml-to-json");
	const [source, setSource] = useState(sampleXml);
	const [includeAttributes, setIncludeAttributes] = useState(true);
	const [rootName, setRootName] = useState("root");
	const result = useMemo(() => {
		try {
			return {
				output:
					direction === "xml-to-json"
						? xmlToJson(source, { includeAttributes })
						: jsonToXml(source, { includeAttributes, rootName }),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this document." };
		}
	}, [direction, source, includeAttributes, rootName]);
	const changeDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => (!current.trim() || current === sampleXml || current === sampleJson ? (next === "xml-to-json" ? sampleXml : sampleJson) : current));
	};
	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Conversion direction"
				options={[
					{ id: "xml-to-json", label: "XML to JSON" },
					{ id: "json-to-xml", label: "JSON to XML" },
				]}
				value={direction}
				onChange={changeDirection}
			/>
			<div className="flex flex-wrap items-end gap-4">
				<label className="flex w-fit cursor-pointer items-center gap-2 py-2 text-xs text-ink">
					<input
						className="size-4 cursor-pointer accent-[#42584d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						type="checkbox"
						checked={includeAttributes}
						onChange={(event) => setIncludeAttributes(event.target.checked)}
					/>
					Keep attributes (as <code className="font-mono text-[11px]">@_name</code> keys)
				</label>
				{direction === "json-to-xml" && (
					<label className={`${labelClassName} w-40`} htmlFor="xml-root-name">
						Wrapper root
						<input
							className={fieldClassName}
							id="xml-root-name"
							value={rootName}
							onChange={(event) => setRootName(event.target.value)}
							placeholder="root"
						/>
					</label>
				)}
			</div>
			<TextAreaField
				id="xml-input"
				label={direction === "xml-to-json" ? "XML input" : "JSON input"}
				value={source}
				onChange={setSource}
				placeholder={direction === "xml-to-json" ? "Paste XML…" : "Paste JSON…"}
				rows={14}
				hint="Repeated sibling elements become arrays, text with attributes lands in #text, and entities are decoded. The wrapper root is used when the JSON root is an array or has several keys."
			/>
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock
					title={direction === "xml-to-json" ? "JSON output" : "XML output"}
					value={result.output}
					fileName={direction === "xml-to-json" ? "converted.json" : "converted.xml"}
				/>
			)}
			<p className={hintClassName}>Conversion happens locally; pasted documents never leave this tab.</p>
		</ToolPanel>
	);
};
