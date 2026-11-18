"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import type { HashAlgorithm } from "@/features/developer-tools/additional-developer-utils";
import {
	csvToJson,
	generateGitignore,
	gitignoreTemplateOptions,
	hashFile,
	jsonToCsv,
	queryJsonPath,
	validateJsonSchema,
	type CsvDelimiter,
	type GitignoreTemplateId,
} from "@/features/developer-tools/data-tools-utils";

const ToolLayout = ({ children }: { children: React.ReactNode }) => (
	<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		{children}
	</div>
);

const ResultPanel = ({ title, value, rows = 9 }: { title: string; value: string; rows?: number }) => (
	<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
		<div className="flex items-center justify-between gap-3">
			<h2 className="m-0 text-sm font-semibold">{title}</h2>
			<CopyTextButton text={value} />
		</div>
		<TextAreaField
			id={`${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-output`}
			label="Result"
			value={value}
			onChange={() => undefined}
			placeholder="Your result will appear here."
			rows={rows}
			readOnly
		/>
	</section>
);

const actionClassName =
	"min-h-9 cursor-pointer border px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const selectClassName =
	"block h-11 w-full border border-[#d9d7cd] bg-surface px-3 pr-9 text-sm text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent";

const sampleCsv = 'name,notes,active\n"Ari","likes commas, too",true\nBo,"said ""hello""",false';
const sampleJson = '[{"name":"Ari","notes":"likes commas, too","active":true},{"name":"Bo","notes":"said \\"hello\\"","active":false}]';

export const CsvJsonTool = () => {
	const [direction, setDirection] = useState<"csv-to-json" | "json-to-csv">("csv-to-json");
	const [source, setSource] = useState(sampleCsv);
	const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
	const [hasHeader, setHasHeader] = useState(true);
	const result = useMemo(() => {
		try {
			return {
				output: direction === "csv-to-json" ? csvToJson(source, delimiter, hasHeader) : jsonToCsv(source, delimiter),
				error: "",
			};
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not convert this data." };
		}
	}, [direction, source, delimiter, hasHeader]);
	const changeDirection = (next: "csv-to-json" | "json-to-csv") => {
		setDirection(next);
		setSource((current) =>
			!current.trim() || current === sampleCsv || current === sampleJson ? (next === "csv-to-json" ? sampleCsv : sampleJson) : current,
		);
	};
	return (
		<ToolLayout>
			<div className="flex flex-wrap gap-2" role="group" aria-label="Conversion direction">
				{(["csv-to-json", "json-to-csv"] as const).map((item) => (
					<button
						className={`${actionClassName} ${direction === item ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`}
						key={item}
						type="button"
						aria-pressed={direction === item}
						onClick={() => changeDirection(item)}
					>
						{item === "csv-to-json" ? "CSV to JSON" : "JSON to CSV"}
					</button>
				))}
			</div>
			<div className="grid grid-cols-[minmax(0,1fr)_minmax(170px,.4fr)] gap-4 max-[620px]:grid-cols-1">
				{direction === "csv-to-json" && (
					<label className="flex w-fit cursor-pointer items-center gap-2 self-center text-xs text-ink">
						<input
							className="size-4 cursor-pointer accent-[#42584d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							type="checkbox"
							checked={hasHeader}
							onChange={(event) => setHasHeader(event.target.checked)}
						/>
						First row contains column names
					</label>
				)}
				<div className="max-w-[220px] max-[620px]:max-w-none">
					<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="csv-json-delimiter">
						Delimiter
					</label>
					<SelectField
						className={selectClassName}
						containerClassName="mt-2"
						id="csv-json-delimiter"
						value={delimiter}
						onChange={(event) => setDelimiter(event.target.value as CsvDelimiter)}
					>
						<option value=",">Comma</option>
						<option value=";">Semicolon</option>
						<option value="\t">Tab</option>
					</SelectField>
				</div>
			</div>
			<TextAreaField
				id="csv-json-input"
				label={direction === "csv-to-json" ? "CSV input" : "JSON input"}
				value={source}
				onChange={setSource}
				placeholder={direction === "csv-to-json" ? "Paste CSV rows…" : "Paste an array of JSON objects…"}
				rows={12}
				hint="Quoted fields, escaped quotes, and newlines inside quoted CSV cells are supported. Values convert to strings; JSON nulls become empty CSV cells."
			/>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				<ResultPanel title={direction === "csv-to-json" ? "Converted JSON" : "Converted CSV"} value={result.output} />
			)}
		</ToolLayout>
	);
};

export const JsonPathTool = () => {
	const [source, setSource] = useState(
		'{\n  "store": {\n    "book": [\n      { "title": "Small Worlds", "price": 8.95 },\n      { "title": "Open Skies", "price": 12.5 }\n    ]\n  }\n}',
	);
	const [query, setQuery] = useState("$.store.book[*].title");
	const result = useMemo(() => {
		try {
			return { matches: queryJsonPath(source, query), error: "" };
		} catch (error) {
			return { matches: [], error: error instanceof Error ? error.message : "Could not evaluate this JSONPath." };
		}
	}, [source, query]);
	const output = JSON.stringify(result.matches, null, 2);
	return (
		<ToolLayout>
			<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="jsonpath-query">
				JSONPath query
				<input
					className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-sm text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="jsonpath-query"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="$.items[*].name"
				/>
			</label>
			<TextAreaField
				id="jsonpath-input"
				label="JSON document"
				value={source}
				onChange={setSource}
				placeholder="Paste a JSON object or array…"
				rows={12}
				hint="Uses JSONPath selectors and filters without evaluating native JavaScript expressions. Results include JSON Pointers."
			/>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				<>
					<p className="m-0 text-xs text-muted" role="status">
						{result.matches.length} match{result.matches.length === 1 ? "" : "es"} found.
					</p>
					<ResultPanel title="JSONPath matches" value={output} />
				</>
			)}
		</ToolLayout>
	);
};

export const JsonSchemaValidatorTool = () => {
	const [data, setData] = useState('{\n  "id": "not-a-number",\n  "email": "person@example.com"\n}');
	const [schema, setSchema] = useState(
		'{\n  "$schema": "https://json-schema.org/draft/2020-12/schema",\n  "type": "object",\n  "required": ["id", "email"],\n  "properties": {\n    "id": { "type": "integer" },\n    "email": { "type": "string", "format": "email" }\n  },\n  "additionalProperties": false\n}',
	);
	const result = useMemo(() => {
		try {
			return { validation: validateJsonSchema(data, schema), error: "" };
		} catch (error) {
			return { validation: null, error: error instanceof Error ? error.message : "Could not validate this JSON." };
		}
	}, [data, schema]);
	return (
		<ToolLayout>
			<div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
				<TextAreaField
					id="schema-validator-data"
					label="JSON data"
					value={data}
					onChange={setData}
					placeholder="Paste JSON data…"
					rows={12}
				/>
				<TextAreaField
					id="schema-validator-schema"
					label="JSON Schema"
					value={schema}
					onChange={setSchema}
					placeholder="Paste a Draft 2020-12 schema…"
					rows={12}
				/>
			</div>
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Validates locally against JSON Schema Draft 2020-12, including standard formats. External references are not fetched. Validation is computed in this tab; use trusted, reasonably sized schemas and data.
			</p>
			{result.error ? (
				<p className="m-0 break-words text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				result.validation && (
					<div className="flex flex-col gap-3">
						<p className={`m-0 text-xs font-semibold ${result.validation.valid ? "text-[#315e43]" : "text-[#8a3028]"}`} role="status">
							{result.validation.valid
								? "JSON is valid against this schema."
								: `${result.validation.issues.length + result.validation.omittedIssues} schema issue${result.validation.issues.length + result.validation.omittedIssues === 1 ? "" : "s"} found.`}
						</p>
						{!result.validation.valid && (
							<ResultPanel
								title="Validation issues"
								value={JSON.stringify(
									{
										issues: result.validation.issues,
										omitted: result.validation.omittedIssues,
									},
									null,
									2,
								)}
							/>
						)}
					</div>
				)
			)}
		</ToolLayout>
	);
};

export const FileHashTool = () => {
	const [file, setFile] = useState<File | null>(null);
	const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
	const [digest, setDigest] = useState("");
	const [error, setError] = useState("");
	const [isHashing, setIsHashing] = useState(false);
	const calculate = async () => {
		if (!file) {
			setError("Choose a file to hash.");
			return;
		}
		setIsHashing(true);
		setDigest("");
		setError("");
		try {
			const result = await hashFile(file, algorithm);
			setDigest(`${result.algorithm}  ${result.digest}\n${result.fileName} (${result.size.toLocaleString()} bytes)`);
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not hash this file.");
		} finally {
			setIsHashing(false);
		}
	};
	return (
		<ToolLayout>
			<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="file-hash-input">
				Choose a file (up to 64 MiB)
				<input
					className="mt-2 block min-h-11 w-full cursor-pointer border border-line bg-surface p-2 text-xs text-ink file:mr-3 file:cursor-pointer file:border-0 file:bg-[#edf0eb] file:px-3 file:py-2 file:text-xs file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					id="file-hash-input"
					type="file"
					onChange={(event) => {
						setFile(event.target.files?.[0] ?? null);
						setDigest("");
						setError("");
					}}
				/>
			</label>
			<div className="w-full max-w-xs">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="file-hash-algorithm">
					Digest algorithm
				</label>
				<SelectField
					className={selectClassName}
					containerClassName="mt-2"
					id="file-hash-algorithm"
					value={algorithm}
					onChange={(event) => {
						setAlgorithm(event.target.value as HashAlgorithm);
						setDigest("");
					}}
				>
					<option value="SHA-256">SHA-256</option>
					<option value="SHA-384">SHA-384</option>
					<option value="SHA-512">SHA-512</option>
				</SelectField>
			</div>
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				The selected file is read locally and never uploaded. Web Crypto buffers the file before hashing; the 64 MiB cap helps limit memory use.
			</p>
			<button
				className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
				type="button"
				disabled={isHashing}
				onClick={() => void calculate()}
			>
				{isHashing ? "Hashing file…" : "Calculate file hash"}
			</button>
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{digest && <ResultPanel title="File checksum" value={digest} rows={4} />}
			<p className="sr-only" role="status" aria-live="polite">
				{digest ? "File hash calculated." : ""}
			</p>
		</ToolLayout>
	);
};

export const GitignoreGeneratorTool = () => {
	const [selected, setSelected] = useState<Set<GitignoreTemplateId>>(new Set(["node", "vscode", "macos"]));
	const result = useMemo(() => {
		try {
			return { output: generateGitignore([...selected]), error: "" };
		} catch (error) {
			return { output: "", error: error instanceof Error ? error.message : "Could not generate a .gitignore file." };
		}
	}, [selected]);
	const toggle = (id: GitignoreTemplateId) => {
		setSelected((previous) => {
			const next = new Set(previous);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};
	return (
		<ToolLayout>
			<fieldset className="m-0 border-0 p-0">
				<legend className="mb-3 text-xs font-semibold text-[#3c3d37]">Choose project and system templates</legend>
				<div className="grid grid-cols-2 gap-2 max-[520px]:grid-cols-1">
					{gitignoreTemplateOptions.map(({ id, label }) => (
						<label className="flex cursor-pointer items-center gap-2 border border-line bg-[#fbfaf7] px-3 py-2.5 text-xs" key={id}>
							<input
								className="size-4 cursor-pointer accent-[#42584d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								type="checkbox"
								checked={selected.has(id)}
								onChange={() => toggle(id)}
							/>
							{label}
						</label>
					))}
				</div>
			</fieldset>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				<div className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">Generated .gitignore</h2>
						<div className="flex flex-wrap items-center gap-2">
							<CopyTextButton text={result.output} />
							<a
								className="inline-flex min-h-[34px] cursor-pointer items-center border border-forest bg-forest px-3 text-[11px] text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.output)}`}
								download=".gitignore"
							>
								Download .gitignore
							</a>
						</div>
					</div>
					<TextAreaField
						id="gitignore-output"
						label="Result"
						value={result.output}
						onChange={() => undefined}
						placeholder="Select at least one template."
						rows={14}
						readOnly
					/>
				</div>
			)}
		</ToolLayout>
	);
};
