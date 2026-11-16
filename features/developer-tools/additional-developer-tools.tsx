"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import {
	convertColor,
	decodeJwt,
	formatSql,
	hashText,
	inspectUrl,
	jsonToSchema,
	type HashAlgorithm,
} from "@/features/developer-tools/additional-developer-utils";
import type { SqlLanguage } from "sql-formatter";

const ToolLayout = ({ children }: { children: React.ReactNode }) => (
	<div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">
		{children}
	</div>
);

const ResultPanel = ({ title, value, rows = 8 }: { title: string; value: string; rows?: number }) => (
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

export const UrlInspectorTool = () => {
	const [source, setSource] = useState("https://example.com/search?q=clickkit&page=2&q=tools#results");
	const result = useMemo(() => {
		try {
			return { details: inspectUrl(source), error: "" };
		} catch (error) {
			return { details: null, error: error instanceof Error ? error.message : "Could not inspect this URL." };
		}
	}, [source]);
	return (
		<ToolLayout>
			<TextAreaField
				id="url-inspector-input"
				label="Absolute URL"
				value={source}
				onChange={setSource}
				placeholder="https://example.com/path?query=value#section"
				rows={4}
				hint="Parsing happens locally. HTTP and HTTPS URLs are supported."
			/>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				result.details && (
					<section className="flex flex-col gap-4" aria-label="URL details" aria-live="polite">
						<div className="flex items-center justify-between gap-3">
							<h2 className="m-0 text-sm font-semibold">URL components</h2>
							<CopyTextButton text={result.details.url} />
						</div>
						<dl className="m-0 grid grid-cols-2 border-l border-t border-line sm:grid-cols-3">
							{[
								{ label: "Protocol", value: result.details.protocol },
								{ label: "Host", value: result.details.host },
								{ label: "Origin", value: result.details.origin },
								{ label: "Path", value: result.details.pathname },
								{ label: "Fragment", value: result.details.fragment || "None" },
							].map((item) => (
								<div
									className="min-w-0 border-b border-r border-line bg-[#f8f7f3] p-3"
									key={item.label}
								>
									<dt className="font-mono text-[10px] uppercase tracking-wide text-muted">
										{item.label}
									</dt>
									<dd className="mb-0 mt-1 break-all font-mono text-xs">{item.value}</dd>
								</div>
							))}
						</dl>
						<div className="overflow-x-auto border border-line">
							<table className="w-full min-w-[360px] border-collapse text-left text-xs">
								<caption className="border-b border-line bg-[#f3f2ec] px-3 py-2 text-left font-semibold">
									Query parameters ({result.details.query.length})
								</caption>
								<thead className="bg-[#f8f7f3] text-[10px] uppercase tracking-wide text-muted">
									<tr>
										<th className="px-3 py-2">Name</th>
										<th className="px-3 py-2">Value</th>
									</tr>
								</thead>
								<tbody>
									{result.details.query.map((item, index) => (
										<tr className="border-t border-line" key={`${item.name}-${index}`}>
											<td className="max-w-[180px] break-all px-3 py-2 font-mono">{item.name}</td>
											<td className="max-w-[300px] break-all px-3 py-2 font-mono">
												{item.value}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{result.details.query.length === 0 && (
								<p className="m-0 border-t border-line p-3 text-xs text-muted">
									This URL has no query parameters.
								</p>
							)}
						</div>
					</section>
				)
			)}
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Embedded username and password credentials are redacted in the normalized URL. Query values are shown as
				entered; inspect sensitive links carefully.
			</p>
		</ToolLayout>
	);
};

const hashAlgorithms: { id: HashAlgorithm; label: string }[] = [
	{ id: "SHA-256", label: "SHA-256" },
	{ id: "SHA-384", label: "SHA-384" },
	{ id: "SHA-512", label: "SHA-512" },
];

export const HashGeneratorTool = () => {
	const [source, setSource] = useState("");
	const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
	const [digest, setDigest] = useState("");
	const [isHashing, setIsHashing] = useState(false);
	const [error, setError] = useState("");
	const generate = async () => {
		setIsHashing(true);
		setError("");
		setDigest("");
		try {
			setDigest(await hashText(source, algorithm));
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Could not generate this digest.");
		} finally {
			setIsHashing(false);
		}
	};
	return (
		<ToolLayout>
			<div className="grid grid-cols-[minmax(0,1fr)_minmax(170px,.45fr)] items-end gap-4 max-[620px]:grid-cols-1">
				<label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="hash-algorithm">
					Algorithm
					<SelectField
						containerClassName="relative mt-2 block w-full"
						className="block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface pl-3 pr-10 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
						id="hash-algorithm"
						disabled={isHashing}
						value={algorithm}
						onChange={(event) => setAlgorithm(event.target.value as HashAlgorithm)}
					>
						{hashAlgorithms.map((item) => (
							<option key={item.id} value={item.id}>
								{item.label}
							</option>
						))}
					</SelectField>
				</label>
				<button
					className="min-h-11 cursor-pointer bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-[#b8b9b1]"
					type="button"
					onClick={() => void generate()}
					disabled={isHashing}
				>
					{isHashing ? "Hashing…" : "Generate hash"}
				</button>
			</div>
			<TextAreaField
				id="hash-input"
				label="Text to hash"
				readOnly={isHashing}
				value={source}
				onChange={(value) => {
					setSource(value);
					setDigest("");
					setError("");
				}}
				placeholder="Type or paste text to create a digest…"
				rows={8}
				hint="Web Crypto hashes text locally. Hashing is one-way; this does not encrypt or protect passwords."
			/>
			{isHashing && (
				<p className="m-0 text-xs text-muted" role="status">
					Generating {algorithm}…
				</p>
			)}
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{digest && (
				<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
					<div className="flex items-center justify-between gap-3">
						<h2 className="m-0 text-sm font-semibold">{algorithm} digest</h2>
						<CopyTextButton text={digest} />
					</div>
					<p
						className="m-0 break-all border border-line bg-[#f6f5f0] p-4 font-mono text-xs leading-relaxed"
						role="status"
					>
						{digest}
					</p>
				</section>
			)}
		</ToolLayout>
	);
};

const sqlDialects: { id: SqlLanguage; label: string }[] = [
	{ id: "sql", label: "Standard SQL" },
	{ id: "postgresql", label: "PostgreSQL" },
	{ id: "mysql", label: "MySQL" },
	{ id: "sqlite", label: "SQLite" },
	{ id: "transactsql", label: "Transact-SQL" },
];

export const SqlFormatterTool = () => {
	const [source, setSource] = useState(
		"select u.name, count(o.id) as order_count from users u left join orders o on o.user_id = u.id where u.active = true group by u.name order by order_count desc;",
	);
	const [dialect, setDialect] = useState<SqlLanguage>("sql");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const [isFormatting, setIsFormatting] = useState(false);
	const handleFormat = async () => {
		setIsFormatting(true);
		setError("");
		try {
			setOutput(await formatSql(source, dialect));
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not format this SQL query.");
		} finally {
			setIsFormatting(false);
		}
	};
	return (
		<ToolLayout>
			<label className="block max-w-[360px] text-xs font-semibold text-[#3c3d37]" htmlFor="sql-dialect">
				SQL dialect
				<SelectField
					containerClassName="relative mt-2 block w-full"
					className="block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface pl-3 pr-10 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="sql-dialect"
					disabled={isFormatting}
					value={dialect}
					onChange={(event) => setDialect(event.target.value as SqlLanguage)}
				>
					{sqlDialects.map((item) => (
						<option key={item.id} value={item.id}>
							{item.label}
						</option>
					))}
				</SelectField>
			</label>
			<TextAreaField
				id="sql-input"
				label="SQL query"
				readOnly={isFormatting}
				value={source}
				onChange={(value) => {
					setSource(value);
					setOutput("");
					setError("");
				}}
				placeholder="Paste a SQL query…"
				rows={12}
				hint="Formatting runs locally. This tool formats whitespace; it does not execute queries or guarantee syntax validity."
			/>
			<button
				className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-[#b8b9b1]"
				type="button"
				onClick={() => void handleFormat()}
				disabled={isFormatting || !source.trim()}
			>
				{isFormatting ? "Formatting…" : "Format SQL"}
			</button>
			{error && (
				<p className="m-0 break-words text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{output && <ResultPanel title="Formatted SQL" value={output} rows={13} />}
		</ToolLayout>
	);
};

export const ColorConverterTool = () => {
	const [source, setSource] = useState("#4263eb");
	const result = useMemo(() => {
		try {
			return { color: convertColor(source), error: "" };
		} catch (error) {
			return { color: null, error: error instanceof Error ? error.message : "Enter a supported CSS color." };
		}
	}, [source]);
	return (
		<ToolLayout>
			<label className="block max-w-[520px] text-xs font-semibold text-[#3c3d37]" htmlFor="color-input">
				Color value
				<input
					className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent"
					id="color-input"
					value={source}
					onChange={(event) => setSource(event.target.value)}
					placeholder="#4263eb, rgb(...), or hsl(...)"
				/>
			</label>
			{result.error ? (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{result.error}
				</p>
			) : (
				result.color && (
					<section className="flex flex-col gap-4" aria-label="Converted color" aria-live="polite">
						<div
							className="h-24 border border-line"
							style={{ backgroundColor: result.color.hex }}
							role="img"
							aria-label={`Color preview ${result.color.hex}`}
						/>
						<dl className="m-0 flex flex-col gap-2">
							{[
								{ label: "HEX", value: result.color.hex },
								{ label: "RGB", value: result.color.rgb },
								{ label: "HSL", value: result.color.hsl },
							].map((item) => (
								<div
									className="flex items-center justify-between gap-3 border border-line bg-[#f8f7f3] px-3 py-2"
									key={item.label}
								>
									<dt className="font-mono text-[10px] font-semibold uppercase text-muted">
										{item.label}
									</dt>
									<dd className="m-0 min-w-0 flex-1 break-all text-right font-mono text-xs">
										{item.value}
									</dd>
									<CopyTextButton text={item.value} />
								</div>
							))}
						</dl>
					</section>
				)
			)}
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Accepts HEX, comma-separated rgb()/rgba(), hsl()/hsla(), and transparent. Alpha transparency is
				preserved where possible.
			</p>
		</ToolLayout>
	);
};

export const JwtDecoderTool = () => {
	const [token, setToken] = useState("");
	const [decoded, setDecoded] = useState<ReturnType<typeof decodeJwt> | null>(null);
	const [error, setError] = useState("");
	const decode = () => {
		try {
			setDecoded(decodeJwt(token));
			setError("");
		} catch (caughtError) {
			setDecoded(null);
			setError(caughtError instanceof Error ? caughtError.message : "Could not decode this token.");
		}
	};
	return (
		<ToolLayout>
			<p
				className="m-0 border-l-2 border-[#b78b42] bg-[#f8f2e2] px-3 py-2.5 text-xs leading-relaxed text-[#61502b]"
				role="note"
			>
				<strong>Decode only, never verify.</strong> This tool reads the header and payload locally. It does not
				verify the signature, issuer, audience, or claims. Do not treat decoded data as trusted.
			</p>
			<TextAreaField
				id="jwt-input"
				label="Three-part JWT"
				value={token}
				onChange={(value) => {
					setToken(value);
					setDecoded(null);
					setError("");
				}}
				placeholder="Paste a JWT with header.payload.signature…"
				rows={6}
				hint="A token can contain sensitive information. Decoding is local; nothing is sent to a server."
			/>
			<button
				className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				type="button"
				onClick={decode}
			>
				Decode token
			</button>
			{error && (
				<p className="m-0 break-words text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{decoded && (
				<div className="flex flex-col gap-4">
					<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
						<div className="flex items-center justify-between gap-3">
							<h2 className="m-0 text-sm font-semibold">Header</h2>
							<CopyTextButton text={JSON.stringify(decoded.header, null, 2)} />
						</div>
						<pre className="m-0 max-h-[260px] overflow-auto border border-line bg-[#f6f5f0] p-4 font-mono text-xs leading-relaxed">
							{JSON.stringify(decoded.header, null, 2)}
						</pre>
					</section>
					<section className="flex flex-col gap-3 border-t border-line pt-[18px]">
						<div className="flex items-center justify-between gap-3">
							<h2 className="m-0 text-sm font-semibold">Payload</h2>
							<CopyTextButton text={JSON.stringify(decoded.payload, null, 2)} />
						</div>
						<pre className="m-0 max-h-[360px] overflow-auto border border-line bg-[#f6f5f0] p-4 font-mono text-xs leading-relaxed">
							{JSON.stringify(decoded.payload, null, 2)}
						</pre>
						{decoded.expiresAt && (
							<p className="m-0 text-xs text-muted">Unverified exp claim: {decoded.expiresAt}</p>
						)}
					</section>
					<p className="m-0 text-xs text-muted" role="status">
						Signature segment {decoded.signaturePresent ? "is present but not checked" : "is empty"}.
					</p>
				</div>
			)}
		</ToolLayout>
	);
};

export const JsonSchemaTool = () => {
	const [source, setSource] = useState(
		'{\n  "name": "Ari",\n  "active": true,\n  "roles": ["editor", "reviewer"],\n  "profile": { "score": 12 }\n}',
	);
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const generate = () => {
		try {
			setOutput(jsonToSchema(source));
			setError("");
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not infer a schema from this JSON.");
		}
	};
	return (
		<ToolLayout>
			<TextAreaField
				id="schema-input"
				label="JSON example"
				value={source}
				onChange={(value) => {
					setSource(value);
					setOutput("");
					setError("");
				}}
				placeholder="Paste a JSON example…"
				rows={11}
			/>
			<button
				className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				type="button"
				onClick={generate}
			>
				Generate JSON Schema
			</button>
			{error && (
				<p className="m-0 text-xs text-[#8a3f30]" role="alert">
					{error}
				</p>
			)}
			{output && <ResultPanel title="JSON Schema (2020-12)" value={output} rows={14} />}
			<p className="m-0 text-[11px] leading-relaxed text-muted">
				Required fields and value types are inferred from this sample only. The schema cannot infer fields or
				value variants absent from the example.
			</p>
		</ToolLayout>
	);
};
