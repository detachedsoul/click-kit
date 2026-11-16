"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { CopyTextButton, TextAreaField } from "@/features/text-tools/text-tool-shared";
import { decodeBase64, encodeBase64, findRegexMatches, formatJson, generateUuidV4, isoToTimestamp, jsonToTypeScript, timestampToIso, type JsonOutputMode, type TimestampUnit } from "@/features/developer-tools/developer-utils";

const ToolLayout = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col gap-6 p-7 max-[760px]:gap-[18px] max-[760px]:p-[18px] max-[520px]:gap-4 max-[520px]:p-[14px]">{children}</div>;

const ResultPanel = ({ title, value, rows = 8 }: { title: string; value: string; rows?: number }) => <section className="flex flex-col gap-3 border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold">{title}</h2><CopyTextButton text={value} /></div><TextAreaField id={`${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-output`} label="Result" value={value} onChange={() => undefined} placeholder="Your result will appear here." rows={rows} readOnly /></section>;

const ActionButtons = ({ value, onChange, label }: { value: JsonOutputMode; onChange: (value: JsonOutputMode) => void; label: string }) => <div className="flex flex-wrap gap-2" role="group" aria-label={label}>{(["pretty", "minify"] as const).map((mode) => <button className={`min-h-9 cursor-pointer border px-3 text-xs ${value === mode ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`} key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)}>{mode === "pretty" ? "Format with indentation" : "Minify"}</button>)}</div>;

export const JsonFormatterTool = () => {
	const [source, setSource] = useState("{\n  \"name\": \"ClickKit\",\n  \"tools\": [\"format\", \"validate\"]\n}");
	const [mode, setMode] = useState<JsonOutputMode>("pretty");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const process = (nextMode: JsonOutputMode) => {
		setMode(nextMode);
		try {
			setOutput(formatJson(source, nextMode));
			setError("");
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not process this JSON.");
		}
	};
	return <ToolLayout><ActionButtons value={mode} onChange={process} label="JSON output format" /><TextAreaField id="json-formatter-input" label="JSON input" value={source} onChange={(value) => { setSource(value); setOutput(""); setError(""); }} placeholder="Paste a JSON object or array…" rows={12} hint="Validates and processes JSON locally in your browser." />{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}{output && <ResultPanel title={mode === "pretty" ? "Formatted JSON" : "Minified JSON"} value={output} rows={12} />}</ToolLayout>;
};

export const JsonTypeScriptTool = () => {
	const [source, setSource] = useState("{\n  \"name\": \"Ari\",\n  \"active\": true,\n  \"roles\": [\"editor\", \"reviewer\"],\n  \"profile\": { \"score\": 12 }\n}");
	const [typeName, setTypeName] = useState("Root");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const generate = () => {
		try {
			setOutput(jsonToTypeScript(source, typeName));
			setError("");
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not infer types from this JSON.");
		}
	};
	return <ToolLayout><div className="grid grid-cols-[minmax(0,1fr)_minmax(160px,.45fr)] gap-4 max-[620px]:grid-cols-1"><TextAreaField id="json-types-input" label="JSON example" value={source} onChange={(value) => { setSource(value); setOutput(""); setError(""); }} placeholder="Paste a JSON object or array…" rows={11} /><label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="json-types-name">Type name<input className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="json-types-name" value={typeName} onChange={(event) => { setTypeName(event.target.value); setOutput(""); setError(""); }} /></label></div><button className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="button" onClick={generate}>Generate TypeScript</button>{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}{output && <ResultPanel title="TypeScript type" value={output} rows={11} />}<p className="m-0 text-[11px] leading-relaxed text-muted">Infers types from this example only. It cannot know which properties are optional across unseen data.</p></ToolLayout>;
};

export const Base64Tool = () => {
	const [source, setSource] = useState("");
	const [direction, setDirection] = useState<"encode" | "decode">("encode");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const process = (nextDirection: "encode" | "decode") => {
		setDirection(nextDirection);
		try {
			setOutput(nextDirection === "encode" ? encodeBase64(source) : decodeBase64(source));
			setError("");
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not process this Base64 text.");
		}
	};
	return <ToolLayout><div className="flex flex-wrap gap-2" role="group" aria-label="Base64 action">{(["encode", "decode"] as const).map((action) => <button className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === action ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`} key={action} type="button" aria-pressed={direction === action} onClick={() => process(action)}>{action === "encode" ? "Encode text" : "Decode Base64"}</button>)}</div><TextAreaField id="base64-input" label={direction === "encode" ? "Text to encode" : "Base64 to decode"} value={source} onChange={(value) => { setSource(value); setOutput(""); setError(""); }} placeholder={direction === "encode" ? "Enter text, including Unicode characters…" : "Paste Base64 text…"} hint="Encoding and decoding happen in your browser; no data is uploaded." />{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}{output && <ResultPanel title={direction === "encode" ? "Base64 output" : "Decoded text"} value={output} rows={7} />}</ToolLayout>;
};

export const UuidGeneratorTool = () => {
	const [quantity, setQuantity] = useState("1");
	const [uuids, setUuids] = useState<string[]>([]);
	const [error, setError] = useState("");
	const generate = () => {
		const count = Number(quantity);
		if (!Number.isInteger(count) || count < 1 || count > 100) {
			setUuids([]);
			setError("Choose a whole-number quantity from 1 to 100.");
			return;
		}
		try {
			setUuids(Array.from({ length: count }, () => generateUuidV4()));
			setError("");
		} catch (caughtError) {
			setUuids([]);
			setError(caughtError instanceof Error ? caughtError.message : "Could not generate secure UUIDs.");
		}
	};
	const output = uuids.join("\n");
	return <ToolLayout><div className="flex flex-wrap items-end gap-4"><label className="block w-full max-w-[220px] text-xs font-semibold text-[#3c3d37]" htmlFor="uuid-quantity">How many UUIDs?<input className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="uuid-quantity" inputMode="numeric" value={quantity} onChange={(event) => { setQuantity(event.target.value); setError(""); }} /></label><button className="min-h-11 cursor-pointer bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="button" onClick={generate}>Generate UUIDs</button></div>{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}{output && <section className="flex flex-col gap-3 border-t border-line pt-[18px]"><div className="flex items-center justify-between gap-3"><h2 className="m-0 text-sm font-semibold">UUID version 4</h2><CopyTextButton text={output} /></div><ol className="m-0 max-h-[400px] list-decimal space-y-2 overflow-auto border border-line bg-[#f6f5f0] p-4 pl-10 font-mono text-xs">{uuids.map((uuid) => <li className="break-all pl-1" key={uuid}>{uuid}</li>)}</ol></section>}<p className="m-0 text-[11px] leading-relaxed text-muted">Generated with the browser’s cryptographically secure random-number generator.</p></ToolLayout>;
};

const regexFlags = [
	{ id: "i", label: "Ignore case" },
	{ id: "m", label: "Multiline" },
	{ id: "s", label: "Dot matches newline" },
	{ id: "u", label: "Unicode" },
] as const;

export const RegexTesterTool = () => {
	const [pattern, setPattern] = useState("(\\w+)@(\\w+\\.\\w+)");
	const [source, setSource] = useState("Contact us at hello@example.com or team@clickkit.dev.");
	const [flags, setFlags] = useState<string[]>([]);
	const result = useMemo(() => {
		try {
			return { matches: findRegexMatches(source, pattern, flags.join("")), error: "" };
		} catch (error) {
			return { matches: [], error: error instanceof Error ? error.message : "Could not test this expression." };
		}
	}, [source, pattern, flags]);
	return <ToolLayout><div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,.9fr)] gap-5 max-[760px]:grid-cols-1"><div className="flex flex-col gap-4"><label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="regex-pattern">Regular expression<input className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="regex-pattern" value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="Enter a pattern, for example \\d+" /></label><fieldset className="flex flex-wrap gap-x-4 gap-y-2 border border-line bg-[#f8f7f3] px-4 py-3"><legend className="px-1 text-xs font-semibold">Flags</legend>{regexFlags.map((flag) => <label className="flex cursor-pointer items-center gap-2 text-xs" key={flag.id}><input className="size-4 accent-accent-dark" type="checkbox" checked={flags.includes(flag.id)} onChange={(event) => setFlags((current) => event.target.checked ? [...current, flag.id] : current.filter((item) => item !== flag.id))} />{flag.label}</label>)}</fieldset></div><TextAreaField id="regex-source" label="Test text" value={source} onChange={setSource} placeholder="Enter text to search…" rows={9} /></div>{result.error ? <p className="m-0 text-xs text-[#8a3f30]" role="alert">{result.error}</p> : <section className="flex flex-col gap-3 border-l-2 border-accent bg-[#f8f6ef] p-4" aria-label="Regular expression matches" aria-live="polite"><p className="m-0 text-xs font-semibold">{result.matches.length} match{result.matches.length === 1 ? "" : "es"}</p>{result.matches.length ? <ol className="m-0 max-h-[320px] space-y-2 overflow-auto pl-5 font-mono text-xs">{result.matches.map((match, index) => <li className="break-all pl-1" key={`${match.index}-${index}`}><mark className="bg-[#f2d797]">{match.text || "(empty match)"}</mark><span className="ml-2 text-muted">at index {match.index}</span>{match.captures.map((capture, captureIndex) => <p className="mb-0 mt-1 break-all text-muted" key={`${captureIndex}-${capture}`}>Group {captureIndex + 1}: {capture ?? "—"}</p>)}</li>)}</ol> : <p className="m-0 text-xs text-muted">No matches found.</p>}</section>}<p className="m-0 text-[11px] leading-relaxed text-muted">Tests run locally in your browser. Global matching is enabled automatically. Keep patterns and test text reasonably small; some complex expressions can take longer to evaluate.</p></ToolLayout>;
};

export const TimestampConverterTool = () => {
	const [direction, setDirection] = useState<"to-date" | "to-timestamp">("to-date");
	const [unit, setUnit] = useState<TimestampUnit>("seconds");
	const [input, setInput] = useState("1735689600");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const convert = (nextDirection = direction) => {
		try {
			if (!input.trim()) throw new Error(nextDirection === "to-date" ? "Enter a Unix timestamp." : "Enter an ISO 8601 date and time.");
			const converted = nextDirection === "to-date" ? timestampToIso(Number(input), unit) : isoToTimestamp(input, unit);
			setOutput(String(converted));
			setError("");
		} catch (caughtError) {
			setOutput("");
			setError(caughtError instanceof Error ? caughtError.message : "Could not convert this timestamp.");
		}
	};
	const changeDirection = (nextDirection: "to-date" | "to-timestamp") => {
		setDirection(nextDirection);
		setInput(nextDirection === "to-date" ? "1735689600" : "2025-01-01T00:00:00Z");
		setOutput("");
		setError("");
	};
	return <ToolLayout><div className="flex flex-wrap gap-2" role="group" aria-label="Timestamp conversion direction"><button className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === "to-date" ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`} type="button" aria-pressed={direction === "to-date"} onClick={() => changeDirection("to-date")}>Timestamp to date</button><button className={`min-h-9 cursor-pointer border px-3 text-xs ${direction === "to-timestamp" ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:border-[#aaa69a]"}`} type="button" aria-pressed={direction === "to-timestamp"} onClick={() => changeDirection("to-timestamp")}>Date to timestamp</button></div><div className="grid grid-cols-[minmax(0,1fr)_minmax(190px,.55fr)] items-end gap-4 max-[620px]:grid-cols-1"><label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="timestamp-value">{direction === "to-date" ? "Unix timestamp" : "ISO 8601 date and time (include timezone)"}<input className="mt-2 block h-11 w-full border border-[#d9d7cd] bg-surface px-3 font-mono text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="timestamp-value" inputMode={direction === "to-date" ? "decimal" : "text"} value={input} onChange={(event) => { setInput(event.target.value); setOutput(""); setError(""); }} placeholder={direction === "to-date" ? "1735689600" : "2025-01-01T00:00:00Z"} /></label><label className="block text-xs font-semibold text-[#3c3d37]" htmlFor="timestamp-unit">Timestamp unit<SelectField containerClassName="relative mt-2 block w-full" className="block h-11 w-full cursor-pointer border border-[#d9d7cd] bg-surface pl-3 pr-10 text-sm font-normal text-ink outline-2 outline-offset-2 outline-transparent focus:border-accent focus:outline-accent" id="timestamp-unit" value={unit} onChange={(event) => { setUnit(event.target.value as TimestampUnit); setOutput(""); setError(""); }} disabled={direction === "to-timestamp"}><option value="seconds">Seconds</option><option value="milliseconds">Milliseconds</option></SelectField></label></div><button className="min-h-10 cursor-pointer self-start bg-forest px-4 text-xs font-medium text-white hover:bg-[#354d44] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" type="button" onClick={() => convert()}>Convert</button>{error && <p className="m-0 text-xs text-[#8a3f30]" role="alert">{error}</p>}{output && <ResultPanel title={direction === "to-date" ? "UTC date and time" : `Unix timestamp (${unit})`} value={output} rows={2} />}</ToolLayout>;
};
