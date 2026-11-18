"use client";

import { useMemo, useState } from "react";
import { CheckboxField } from "@/features/developer-tools/tool-ui";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { cleanInvisible, hexCode, scanInvisible } from "@/features/text-tools/invisible-utils";

const sample = "Hello\u200B world\u00A0— this line hides a soft\u00ADhyphen and a\u202Ebidi override.";

export const InvisibleTool = () => {
	const [text, setText] = useState(sample);
	const [spacesToSpaces, setSpacesToSpaces] = useState(true);
	const scan = useMemo(() => scanInvisible(text), [text]);
	const cleaned = useMemo(() => cleanInvisible(text, { spacesToSpaces }), [text, spacesToSpaces]);
	const summary = useMemo(() => {
		if (!text.trim()) return "Paste some text to scan.";
		return "";
	}, [text]);
	const findingsText = useMemo(() => {
		const lines = scan.totals.map((item) => `${hexCode(item.code).padEnd(8)} ${String(item.count).padStart(3)}×  ${item.label}`);
		const first = scan.findings
			.slice(0, 8)
			.map((finding) => `line ${finding.line}, column ${finding.column}: ${hexCode(finding.code)} ${finding.label}`);
		return [
			`Invisible characters: ${scan.total}`,
			`Visible characters:   ${scan.visible}`,
			`Lines:                ${scan.lines}`,
			"",
			...lines,
			...(first.length ? ["", "First occurrences", ...first] : []),
		].join("\n");
	}, [scan]);
	return (
		<ToolPanel>
			<TextAreaField
				hint="Zero-width spaces, no-break spaces, soft hyphens, and bidi control characters are invisible in editors but can break code, search, and copy-paste."
				id="invisible-input"
				label="Text to scan"
				onChange={setText}
				placeholder="Paste text that looks fine but behaves oddly…"
				value={text}
			/>
			<CheckboxField
				checked={spacesToSpaces}
				hint="Off deletes exotic spaces entirely instead of turning them into plain spaces."
				id="invisible-spaces"
				label="Turn unusual spaces into ordinary spaces"
				onChange={setSpacesToSpaces}
			/>
			<ErrorNote message={summary} />
			{!summary && (
				<>
					<StatGrid
						items={[
							{ label: "Invisible", value: String(scan.total) },
							{ label: "Visible", value: String(scan.visible) },
							{ label: "Distinct kinds", value: String(scan.totals.length) },
							{ label: "Lines", value: String(scan.lines) },
						]}
					/>
					<ResultBlock fileName="invisible-report.txt" rows={10} title="Scan report" value={findingsText} />
					<section className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h2 className="m-0 text-sm font-semibold">Cleaned text</h2>
							<CopyTextButton text={cleaned} />
						</div>
						<TextAreaField id="invisible-cleaned" label="Cleaned text" onChange={() => undefined} placeholder="Cleaned text appears here." readOnly value={cleaned} />
					</section>
				</>
			)}
			<p className={hintClassName}>
				Everything runs locally in your browser. Cleaning keeps tabs and line breaks, removes zero-width, bidi, and soft-hyphen characters, and tidies
				the spaces left behind.
			</p>
		</ToolPanel>
	);
};

export default InvisibleTool;
