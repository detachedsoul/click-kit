"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { parseXml, runXPath, xpathExamples } from "@/features/developer-tools/xpath-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="b1" lang="en">
    <title>Structure and Interpretation</title>
    <author>Sussman</author>
    <price>42.50</price>
  </book>
  <book id="b2" lang="fr">
    <title>Programmes</title>
    <author>Wirth</author>
    <price>19.00</price>
  </book>
</catalog>`;

export const XPathTool = () => {
	const [source, setSource] = useState(sampleXml);
	const [expression, setExpression] = useState("//book/title");
	const result = useMemo(() => {
		try {
			const doc = parseXml(source);
			return { report: runXPath(doc, expression), error: "" };
		} catch (error) {
			return { report: null, error: error instanceof Error ? error.message : "Could not run that expression." };
		}
	}, [source, expression]);
	return (
		<ToolPanel>
			<TextAreaField
				id="xpath-xml"
				label="XML or HTML document"
				value={source}
				onChange={setSource}
				placeholder="<root><item>value</item></root>"
				rows={12}
				hint="Parsed locally in this tab. HTML doctypes switch the parser into HTML mode so sloppy markup still loads."
			/>
			<label className={labelClassName} htmlFor="xpath-expression">
				XPath expression
				<input
					className={`${fieldClassName} font-mono`}
					id="xpath-expression"
					value={expression}
					onChange={(event) => setExpression(event.target.value)}
					placeholder="//book[@lang='en']/title"
				/>
			</label>
			<div className="flex flex-wrap gap-2">
				{xpathExamples.map((example) => (
					<button className="cursor-pointer border border-line bg-[#fbfaf7] px-2 py-1 font-mono text-[11px] text-[#3e4139] hover:border-accent" key={example} onClick={() => setExpression(example)} type="button">
						{example}
					</button>
				))}
			</div>
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Result type", value: result.report.kind === "nodes" ? "node set" : result.report.kind },
							{ label: "Matches", value: String(result.report.count) },
							{ label: "Expression", value: expression.trim().slice(0, 48) },
						]}
					/>
					{result.report.truncated && <p className={hintClassName}>Showing the first 200 matches only.</p>}
					<ResultBlock
						title="Matches"
						value={
							result.report.matches.length
								? result.report.matches.map((match) => `${match.index}. ${match.path}  →  ${match.value}`).join("\n")
								: "No nodes matched this expression."
						}
						rows={12}
						fileName="xpath-results.txt"
					/>
				</>
			)}
			<p className={hintClassName}>
				The browser&apos;s native XPath 1.0 engine runs the query, so functions such as <code>contains()</code>, <code>normalize-space()</code>, and{" "}
				<code>count()</code> are available. Lower-case <code>name()</code> differences aside, HTML documents are matched case-insensitively.
			</p>
		</ToolPanel>
	);
};
