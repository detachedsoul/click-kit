"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { formatBytes, optimiseSvg } from "@/features/developer-tools/svg-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Exported by Vector Studio -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="24.000px" height="24.000px" viewBox="0 0 24.0000 24.0000" inkscape:version="1.2">
  <metadata>generated 2024-01-01</metadata>
  <title>Arrow icon</title>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" transform="translate(0.00000, 0.00000)">
    <path d="M12.0000 2.5000 L21.5000 12.0000 L12.0000 21.5000 Z" fill="#1f2937" stroke-width="1.50000"/>
    <!-- decorative dot -->
    <circle cx="12.0000" cy="12.0000" r="1.25000" fill="#ffffff"></circle>
  </g>
</svg>`;

export const SvgTool = () => {
	const [source, setSource] = useState(sample);
	const [decimals, setDecimals] = useState(2);
	const [removeIds, setRemoveIds] = useState(false);
	const [removeMetadata, setRemoveMetadata] = useState(true);
	const [keepTitle, setKeepTitle] = useState(true);
	const [prettify, setPrettify] = useState(false);
	const result = useMemo(() => {
		try {
			return { report: optimiseSvg(source, { decimals, removeIds, removeMetadata, keepTitle, prettify }), error: "" };
		} catch (error) {
			return { report: null, error: error instanceof Error ? error.message : "Could not optimise this SVG." };
		}
	}, [source, decimals, removeIds, removeMetadata, keepTitle, prettify]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="svg-decimals">
					Coordinate precision
					<select className={selectClassName} id="svg-decimals" value={decimals} onChange={(event) => setDecimals(Number(event.target.value))}>
						<option value={0}>Whole numbers</option>
						<option value={1}>1 decimal</option>
						<option value={2}>2 decimals</option>
						<option value={3}>3 decimals</option>
					</select>
				</label>
				<div className="flex flex-col justify-end gap-2">
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="svg-metadata">
						<input checked={removeMetadata} id="svg-metadata" onChange={(event) => setRemoveMetadata(event.target.checked)} type="checkbox" />
						Remove metadata and editor nodes
					</label>
					<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="svg-title">
						<input checked={keepTitle} id="svg-title" onChange={(event) => setKeepTitle(event.target.checked)} type="checkbox" />
						Keep title and description (accessibility)
					</label>
				</div>
				<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="svg-ids">
					<input checked={removeIds} id="svg-ids" onChange={(event) => setRemoveIds(event.target.checked)} type="checkbox" />
					Strip id attributes from child elements
				</label>
				<label className="flex items-center gap-2 text-xs font-semibold text-[#3c3d37]" htmlFor="svg-pretty">
					<input checked={prettify} id="svg-pretty" onChange={(event) => setPrettify(event.target.checked)} type="checkbox" />
					Pretty-print instead of minifying
				</label>
			</div>
			<TextAreaField id="svg-source" label="SVG markup" value={source} onChange={setSource} placeholder="<svg …</svg>" rows={12} hint="Comments, metadata, editor namespaces, and empty groups are dropped; numeric attributes are rounded and path data is compacted." />
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Before", value: formatBytes(result.report.before) },
							{ label: "After", value: formatBytes(result.report.after) },
							{ label: "Saved", value: `${result.report.saved}%` },
							{ label: "Comments / metadata", value: `${result.report.commentCount} / ${result.report.metadataCount}` },
						]}
					/>
					{result.report.warnings.map((warning) => (
						<p className="m-0 text-xs text-[#8a6a1f]" key={warning}>
							{warning}
						</p>
					))}
					<ResultBlock title="Result" value={result.report.output} rows={12} fileName="icon.svg" />
				</>
			)}
			<p className={hintClassName}>
				Optimisation is local and conservative: gradients, masks, and <code>url(#id)</code> references are preserved. Keep ids if your CSS or
				animations target them.
			</p>
		</ToolPanel>
	);
};
