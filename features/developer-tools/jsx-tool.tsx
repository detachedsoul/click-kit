"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { htmlToJsx } from "@/features/developer-tools/jsx-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, ToolPanel } from "@/features/developer-tools/tool-ui";

const sample = `<section class="card" data-id="7">
  <!-- pricing card -->
  <h2 style="font-size: 20px; color: #1f2937">Pro plan</h2>
  <p>Everything in <strong>Starter</strong>, plus priority support.</p>
  <label for="seats">Seats</label>
  <input id="seats" type="number" value="5" disabled>
  <img src="/logo.svg" alt="" width="24" height="24" />
</section>`;

export const JsxTool = () => {
	const [source, setSource] = useState(sample);
	const [component, setComponent] = useState("PricingCard");
	const [wrap, setWrap] = useState(true);
	const [svg, setSvg] = useState(false);
	const result = useMemo(() => {
		try {
			return { output: htmlToJsx(source, { component, wrap, svg }), error: "" };
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this markup." };
		}
	}, [source, component, wrap, svg]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="jsx-component">
					Component name
					<input className={fieldClassName} id="jsx-component" value={component} onChange={(event) => setComponent(event.target.value)} />
				</label>
				<div className="flex flex-col justify-end gap-2">
					<CheckboxField checked={wrap} id="jsx-wrap" label={<>Wrap in a React component</>} onChange={setWrap} />
					<CheckboxField checked={svg} id="jsx-svg" label={<>Treat input as SVG (case-sensitive XML)</>} onChange={setSvg} />
				</div>
			</div>
			<TextAreaField
				id="jsx-source"
				label="HTML or SVG"
				value={source}
				onChange={setSource}
				placeholder='<div class="box">Hello</div>'
				rows={14}
				hint="Attributes and inline styles are converted to React props: class → className, for → htmlFor, style → an object, and void tags self-close."
			/>
			<ErrorNote message={result.error} />
			{result.output && <ResultBlock title="Result" value={result.output} rows={18} fileName={`${component || "Component"}.tsx`} />}
			<p className={hintClassName}>
				HTML entities are decoded, comments become JSX comments, and braces in text are escaped so the output compiles as-is. TypeScript types are
				left for you to add on props.
			</p>
		</ToolPanel>
	);
};
