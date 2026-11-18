"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { envToTarget, structuredToEnv, type EnvTarget } from "@/features/developer-tools/env-convert-utils";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";

const envSample = `# app config
NODE_ENV=production
export API_URL="https://api.example.com/v1"
PORT=8080
DATABASE__HOST=db.internal
DATABASE__PORT=5432
FEATURE_FLAGS='{"beta":true}'
GREETING="Hello, \\"world\\""
EMPTY=`;

const structuredSample = `{
  "app": { "name": "click-kit", "port": 3000 },
  "database": { "host": "db.internal", "pool": { "min": 2, "max": 10 } },
  "features": ["beta", "audit"],
  "debug": false
}`;

type Direction = "env-to-structured" | "structured-to-env";

export const EnvConvertTool = () => {
	const [direction, setDirection] = useState<Direction>("env-to-structured");
	const [target, setTarget] = useState<EnvTarget>("json");
	const [structuredFormat, setStructuredFormat] = useState<"json" | "yaml">("json");
	const [source, setSource] = useState(envSample);
	const [separator, setSeparator] = useState("__");
	const [nested, setNested] = useState(true);
	const [comments, setComments] = useState(false);
	const changeDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => (current === envSample ? structuredSample : current === structuredSample ? envSample : current));
	};
	const result = useMemo(() => {
		try {
			if (direction === "structured-to-env") {
				const converted = structuredToEnv(source, { format: structuredFormat, separator, comments, sort: false });
				return { text: converted.text, warnings: [] as { line: number; message: string }[], error: "", count: converted.count };
			}
			const converted = envToTarget(source, target, { nested, separator });
			return { text: converted.text, warnings: converted.parsed.warnings, error: "", count: converted.parsed.entries.length };
		} catch (error) {
			return { text: "", warnings: [], error: error instanceof Error ? error.message : "Could not convert this input.", count: 0 };
		}
	}, [direction, source, target, structuredFormat, separator, nested, comments]);
	const fileName = direction === "structured-to-env" ? ".env" : target === "yaml" ? "env.yaml" : target === "compose" ? "compose-env.yml" : target === "shell" ? "env.sh" : "env.json";
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<label className={labelClassName} htmlFor="env-direction">
					Conversion
					<select className={selectClassName} id="env-direction" value={direction} onChange={(event) => changeDirection(event.target.value as Direction)}>
						<option value="env-to-structured">.env → JSON / YAML / Compose</option>
						<option value="structured-to-env">JSON / YAML → .env</option>
					</select>
				</label>
				{direction === "env-to-structured" ? (
					<label className={labelClassName} htmlFor="env-target">
						Output format
						<select className={selectClassName} id="env-target" value={target} onChange={(event) => setTarget(event.target.value as EnvTarget)}>
							<option value="json">JSON object</option>
							<option value="yaml">YAML object</option>
							<option value="compose">Docker Compose environment</option>
							<option value="shell">Shell export lines</option>
						</select>
					</label>
				) : (
					<label className={labelClassName} htmlFor="env-format">
						Input format
						<select className={selectClassName} id="env-format" value={structuredFormat} onChange={(event) => setStructuredFormat(event.target.value as "json" | "yaml")}>
							<option value="json">JSON</option>
							<option value="yaml">YAML</option>
						</select>
					</label>
				)}
				<label className={labelClassName} htmlFor="env-separator">
					Nested key separator
					<input className={`${fieldClassName} font-mono`} id="env-separator" value={separator} onChange={(event) => setSeparator(event.target.value)} />
				</label>
				{direction === "env-to-structured" ? (
					<CheckboxField checked={nested} id="env-nested" label={<>Split {separator || "__"} keys into nested objects</>} onChange={setNested} />
				) : (
					<span className="flex flex-col justify-end gap-2">
						<CheckboxField checked={comments} id="env-comments" label={<>Group keys with section comments</>} onChange={setComments} />
					</span>
				)}
			</div>
			<TextAreaField
				id="env-source"
				label={direction === "env-to-structured" ? ".env file" : `${structuredFormat.toUpperCase()} object`}
				value={source}
				onChange={setSource}
				placeholder={direction === "env-to-structured" ? "KEY=value" : '{"KEY": "value"}'}
				rows={14}
				hint="Quotes are unwrapped, escape sequences in double quotes are decoded, exports and inline comments are handled, and duplicate keys are flagged."
			/>
			<ErrorNote message={result.error} />
			{result.text && (
				<>
					<StatGrid items={[{ label: "Variables", value: String(result.count) }, { label: "Warnings", value: String(result.warnings.length) }]} />
					{result.warnings.length > 0 && (
						<ul className="m-0 flex list-none flex-col gap-1 text-xs text-[#8a6a1f]">
							{result.warnings.map((warning) => (
								<li key={`${warning.line}-${warning.message}`}>
									Line {warning.line}: {warning.message}
								</li>
							))}
						</ul>
					)}
					<ResultBlock title="Result" value={result.text} rows={14} fileName={fileName} />
				</>
			)}
			<p className={hintClassName}>
				Values are always emitted as strings, because that is what processes see. Nested keys such as <code>DATABASE__HOST</code> map to{" "}
				<code>database.host</code> and back again.
			</p>
		</ToolPanel>
	);
};
