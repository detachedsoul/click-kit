"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { jsonToCode, type CodeLanguage } from "@/features/developer-tools/json-code-utils";
import { ErrorNote, ResultBlock, ToolPanel, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `{
  "id": 42,
  "name": "Ada Lovelace",
  "active": true,
  "score": 9.5,
  "tags": ["math", "pioneer"],
  "profile": { "city": "Lagos", "age": 36 },
  "items": [{ "sku": "kit-1", "qty": 2, "note": null }]
}`;

const languages: { id: CodeLanguage; label: string; extension: string }[] = [
	{ id: "go", label: "Go", extension: "go" },
	{ id: "rust", label: "Rust (serde)", extension: "rs" },
	{ id: "python", label: "Python (dataclasses)", extension: "py" },
	{ id: "java", label: "Java (records)", extension: "java" },
	{ id: "csharp", label: "C# (records)", extension: "cs" },
	{ id: "kotlin", label: "Kotlin (kotlinx.serialization)", extension: "kt" },
	{ id: "swift", label: "Swift (Codable)", extension: "swift" },
];

export const JsonCodeTool = () => {
	const [language, setLanguage] = useState<CodeLanguage>("go");
	const [rootName, setRootName] = useState("Root");
	const [source, setSource] = useState(sample);
	const result = useMemo(() => {
		try {
			return { output: jsonToCode(source, language, rootName), error: "" };
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not generate types." };
		}
	}, [source, language, rootName]);
	const extension = languages.find((item) => item.id === language)!.extension;
	return (
		<ToolPanel>
			<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-[620px]:grid-cols-1">
				<div>
					<label className={labelClassName} htmlFor="code-language">
						Target language
					</label>
					<SelectField
						className={selectClassName}
						id="code-language"
						value={language}
						onChange={(event) => setLanguage(event.target.value as CodeLanguage)}
					>
						{languages.map((item) => (
							<option key={item.id} value={item.id}>
								{item.label}
							</option>
						))}
					</SelectField>
				</div>
				<label className={labelClassName} htmlFor="code-root-name">
					Root type name
					<input
						className={fieldClassName}
						id="code-root-name"
						value={rootName}
						onChange={(event) => setRootName(event.target.value)}
						placeholder="Root"
					/>
				</label>
			</div>
			<TextAreaField id="json-code-input" label="JSON sample" value={source} onChange={setSource} placeholder="Paste JSON…" rows={12} />
			<ErrorNote message={result.error} />
			{!result.error && (
				<ResultBlock title="Generated code" value={result.output} rows={16} fileName={`model.${extension}`} />
			)}
			<p className={hintClassName}>
				Types are inferred from every array element, so missing keys become optional and mixed primitives widen to a permissive value type. Rename the
				root for a better fit with your project.
			</p>
		</ToolPanel>
	);
};
