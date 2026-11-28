"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNote, ToolPanel, buttonClassName, fieldClassName, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import { SelectField } from "@/components/select-field";
import { API_METHODS, buildRequestUrl, displayResponseBody, formatJson, newApiRequest, parseRequestHeaders, safeReadHistory, type ApiFormField, type ApiHistoryEntry, type ApiKeyValue, type ApiMethod, type ApiRequest, type ApiResponse } from "@/features/developer-tools/api-tester-utils";

const HISTORY_KEY = "clickkit-api-tester-history-v1";
const formButton = "min-h-8 cursor-pointer border border-line bg-surface px-2.5 text-[11px] text-ink hover:bg-[#f1f0ea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const chip = "inline-flex items-center border border-line bg-[#f8f7f3] px-2 py-1 font-mono text-[10px] text-muted";
const jsonToken = /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/gu;

const SyntaxJson = ({ value }: { value: string }) => (
	<pre aria-label="Syntax highlighted JSON" className="m-0 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-line bg-[#f8f7f3] p-3 font-mono text-xs leading-relaxed">
		{value.split(jsonToken).map((part, index) => {
			if (!part) return null;
			const isString = part.startsWith("\"");
			const isKey = isString && part.trimEnd().endsWith(":");
			const isLiteral = /^(?:true|false|null)$/u.test(part);
			const isNumber = /^-?\d/u.test(part);
			return <span className={isKey ? "text-[#59673d]" : isString ? "text-[#9a543b]" : isLiteral ? "text-[#745c9e]" : isNumber ? "text-[#376b84]" : undefined} key={index}>{part}</span>;
		})}
	</pre>
);

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const blankRow = (prefix: string): ApiKeyValue => ({ id: makeId(prefix), key: "", value: "" });

const asHistoryRequest = (request: ApiRequest): ApiRequest => ({
	...request,
	body: request.body.slice(0, 8000),
	formFields: request.formFields.map((field) => field.fileName ? { ...field, base64: undefined, value: "[File contents not stored in history]" } : field),
});

const trimmedResponse = (response: ApiResponse): ApiResponse => ({ ...response, body: response.body.slice(0, 12_000), truncated: response.truncated || response.body.length > 12_000 });

const updateRow = (rows: ApiKeyValue[], id: string, patch: Partial<ApiKeyValue>) => rows.map((row) => row.id === id ? { ...row, ...patch } : row);

export const ApiTesterTool = () => {
	const [request, setRequest] = useState<ApiRequest>(newApiRequest);
	const [history, setHistory] = useState<ApiHistoryEntry[]>([]);
	const [response, setResponse] = useState<ApiResponse | null>(null);
	const [error, setError] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [requestTab, setRequestTab] = useState<"params" | "headers" | "body">("params");
	const [responseTab, setResponseTab] = useState<"body" | "headers">("body");
	const [prettyResponse, setPrettyResponse] = useState(true);
	const [hydrated, setHydrated] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const timer = window.setTimeout(() => {
			try { setHistory(safeReadHistory(localStorage.getItem(HISTORY_KEY))); } catch { setHistory([]); }
			setHydrated(true);
		}, 0);
		return () => window.clearTimeout(timer);
	}, []);
	useEffect(() => {
		if (!hydrated) return;
		try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20))); } catch { /* Storage can be disabled or full. */ }
	}, [history, hydrated]);

	const bodyValidation = useMemo(() => request.bodyKind === "json" ? formatJson(request.body).error : "", [request.body, request.bodyKind]);
	const requestUrl = useMemo(() => {
		try { return { value: buildRequestUrl(request.url, request.query), error: "" }; }
		catch { return { value: "", error: "Enter a valid HTTP or HTTPS URL before sending." }; }
	}, [request.url, request.query]);
	const responseBody = response ? displayResponseBody(response.body, prettyResponse) : "";
	const isJsonResponse = Boolean(response?.headers["content-type"]?.toLowerCase().includes("json"));

	const setField = <K extends keyof ApiRequest>(key: K, value: ApiRequest[K]) => setRequest((current) => ({ ...current, [key]: value }));
	const setRows = (kind: "headers" | "query", value: ApiKeyValue[]) => setField(kind, value);
	const appendRow = (kind: "headers" | "query") => setRows(kind, [...request[kind], blankRow(kind)]);
	const resetResponse = () => { setResponse(null); setError(""); };

	const send = async () => {
		setError("");
		setResponse(null);
		if (requestUrl.error) { setError(requestUrl.error); return; }
		if (bodyValidation) { setError(bodyValidation); setRequestTab("body"); return; }
		setIsSending(true);
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 24_000);
		try {
			const payload = {
				url: requestUrl.value,
				method: request.method,
				headers: parseRequestHeaders(request.headers),
				bodyKind: request.bodyKind,
				body: request.body,
				formFields: request.formFields.filter((field) => field.key.trim() || field.fileName),
			};
			const result = await fetch("/api/api-tester", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
			const data = await result.json() as ApiResponse & { error?: string };
			if (!result.ok || data.error) throw new Error(data.error || `The request relay returned ${result.status}.`);
			setResponse(data);
			const entry: ApiHistoryEntry = { id: makeId("history"), savedAt: new Date().toISOString(), request: asHistoryRequest(request), response: trimmedResponse(data) };
			setHistory((current) => [entry, ...current].slice(0, 20));
		} catch (caught) {
			const message = controller.signal.aborted ? "The request timed out. Try again or check the API server." : caught instanceof Error ? caught.message : "The request could not be sent.";
			setError(message);
			setHistory((current) => [{ id: makeId("history"), savedAt: new Date().toISOString(), request: asHistoryRequest(request), error: message }, ...current].slice(0, 20));
		} finally {
			window.clearTimeout(timeout);
			setIsSending(false);
		}
	};

	const formatRequestBody = () => {
		const formatted = formatJson(request.body);
		if (!formatted.error) setField("body", formatted.formatted);
	};

	const selectHistory = (entry: ApiHistoryEntry) => {
		setRequest(entry.request);
		setResponse(entry.response ?? null);
		setError(entry.error ?? "");
		setRequestTab("params");
	};

	const exportRequest = () => {
		const blob = new Blob([`${JSON.stringify(request, null, 2)}\n`], { type: "application/json" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `${request.name.trim().replace(/[^a-z0-9_-]+/giu, "-").replace(/^-+|-+$/gu, "") || "api-request"}.json`;
		link.click();
		URL.revokeObjectURL(link.href);
	};

	const importRequest = async (file: File | undefined) => {
		if (!file) return;
		try {
			if (file.size > 3 * 1024 * 1024) throw new Error("Choose a request file smaller than 3 MB.");
			const raw: unknown = JSON.parse(await file.text());
			const candidate = Array.isArray(raw) ? raw[0] : raw;
			if (typeof candidate !== "object" || candidate === null || typeof (candidate as ApiRequest).url !== "string" || !API_METHODS.includes((candidate as ApiRequest).method) || !Array.isArray((candidate as ApiRequest).headers) || !Array.isArray((candidate as ApiRequest).query)) {
				throw new Error("This file is not a supported API request JSON file.");
			}
			const imported = candidate as ApiRequest;
			setRequest({
				...newApiRequest(),
				...imported,
				headers: imported.headers.map((row) => ({ ...row, id: makeId("header") })),
				query: imported.query.map((row) => ({ ...row, id: makeId("param") })),
				formFields: Array.isArray(imported.formFields) ? imported.formFields.map((row) => ({ ...row, id: makeId("form") })) : [],
				bodyKind: imported.bodyKind === "form" ? "form" : "json",
			});
			resetResponse();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "This request file could not be read.");
		}
		if (fileRef.current) fileRef.current.value = "";
	};

	const addFormFile = async (field: ApiFormField, file: File | undefined) => {
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) { setError("Each form-data file must be 2 MB or smaller."); return; }
		try {
			const data = await file.arrayBuffer();
			let binary = "";
			const bytes = new Uint8Array(data);
			for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
			setField("formFields", request.formFields.map((item) => item.id === field.id ? { ...item, fileName: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(binary) } : item));
			setError("");
		} catch { setError("This file could not be prepared for form-data."); }
	};

	const renderRows = (kind: "headers" | "query") => (
		<div className="flex flex-col gap-2" role="table" aria-label={kind === "headers" ? "Request headers" : "Query parameters"}>
			<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted" role="row"><span role="columnheader">{kind === "headers" ? "Header" : "Parameter"}</span><span role="columnheader">Value</span><span role="columnheader">Action</span></div>
			{request[kind].map((row) => (
				<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2" key={row.id} role="row">
					<input aria-label={`${kind === "headers" ? "Header" : "Parameter"} name`} className="min-w-0 border border-line bg-white px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-accent" onChange={(event) => setRows(kind, updateRow(request[kind], row.id, { key: event.target.value }))} placeholder={kind === "headers" ? "Authorization" : "page"} value={row.key} />
					<input aria-label={`${kind === "headers" ? "Header" : "Parameter"} value`} className="min-w-0 border border-line bg-white px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-accent" onChange={(event) => setRows(kind, updateRow(request[kind], row.id, { value: event.target.value }))} placeholder={kind === "headers" ? "Bearer token" : "1"} value={row.value} />
					<button aria-label={`Remove ${kind === "headers" ? "header" : "parameter"}`} className={formButton} onClick={() => setRows(kind, request[kind].filter((item) => item.id !== row.id))} type="button">Remove</button>
				</div>
			))}
			<button className={`${formButton} self-start`} onClick={() => appendRow(kind)} type="button">Add {kind === "headers" ? "header" : "parameter"}</button>
		</div>
	);

	return (
		<ToolPanel>
			<div className="flex flex-wrap items-end gap-2">
				<label className={`${labelClassName} min-w-[130px]`} htmlFor="api-method">Method
					<SelectField className={selectClassName} containerClassName="" id="api-method" onChange={(event) => setField("method", event.target.value as ApiMethod)} value={request.method}>
						{API_METHODS.map((method) => <option key={method}>{method}</option>)}
					</SelectField>
				</label>
				<label className={`${labelClassName} min-w-[220px] flex-1`} htmlFor="api-url">Request URL
					<input autoCapitalize="off" autoComplete="url" className={fieldClassName} id="api-url" onChange={(event) => setField("url", event.target.value)} placeholder="https://api.example.com/v1/items" spellCheck={false} type="url" value={request.url} />
				</label>
				<button className={`${buttonClassName} min-h-11 border-forest bg-forest text-white hover:bg-[#354d44] disabled:cursor-wait disabled:opacity-60`} disabled={isSending || Boolean(requestUrl.error) || Boolean(bodyValidation)} onClick={() => void send()} type="button">{isSending ? "Sending…" : "Send request"}</button>
			</div>
			<label className={`${labelClassName} max-w-xl`} htmlFor="api-request-name">Request name
				<input className={fieldClassName} id="api-request-name" onChange={(event) => setField("name", event.target.value)} value={request.name} />
			</label>

			<div className="flex flex-wrap gap-2" aria-label="Request actions">
				<button className={formButton} onClick={exportRequest} type="button">Export request</button>
				<button className={formButton} onClick={() => fileRef.current?.click()} type="button">Import request</button>
				<input accept="application/json,.json" className="sr-only" onChange={(event) => void importRequest(event.currentTarget.files?.[0])} ref={fileRef} type="file" />
				<button className={formButton} onClick={() => { setRequest(newApiRequest()); resetResponse(); }} type="button">New request</button>
			</div>

			<div className="flex flex-wrap gap-1 border-b border-line" aria-label="Request settings">
				{(["params", "headers", "body"] as const).map((tab) => {
					const count = tab === "params" ? request.query.filter((row) => row.key.trim()).length : tab === "headers" ? request.headers.filter((row) => row.key.trim()).length : request.bodyKind === "form" ? request.formFields.filter((row) => row.key.trim() || row.fileName).length : request.body.trim() ? 1 : 0;
					return <button aria-pressed={requestTab === tab} className={`border-b-2 px-3 py-2 text-xs ${requestTab === tab ? "border-forest font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`} key={tab} onClick={() => setRequestTab(tab)} type="button">{tab === "params" ? "Params" : tab === "headers" ? "Headers" : "Body"}<span className="ml-1 text-[10px] text-muted">{count}</span></button>;
				})}
			</div>
			<section aria-label={`${requestTab} editor`} className="min-h-40 border border-line bg-[#fbfaf7] p-3">
				{requestTab === "params" ? renderRows("query") : null}
				{requestTab === "headers" ? renderRows("headers") : null}
				{requestTab === "body" ? (
					<div className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-[11px] font-semibold text-muted">Body type</span>
							<button aria-pressed={request.bodyKind === "json"} className={request.bodyKind === "json" ? "border border-forest bg-forest px-3 py-1.5 text-xs text-white" : formButton} onClick={() => setField("bodyKind", "json")} type="button">JSON</button>
							<button aria-pressed={request.bodyKind === "form"} className={request.bodyKind === "form" ? "border border-forest bg-forest px-3 py-1.5 text-xs text-white" : formButton} onClick={() => setField("bodyKind", "form")} type="button">Form-data</button>
						</div>
						{request.bodyKind === "json" ? (
						<>
							<div className="flex items-center justify-between gap-2"><label className={labelClassName} htmlFor="api-json-body">JSON request body</label><button className={formButton} onClick={formatRequestBody} type="button">Format JSON</button></div>
							<textarea aria-label="JSON request body" className="min-h-44 w-full resize-y border border-line bg-white p-3 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-accent" id="api-json-body" onChange={(event) => setField("body", event.target.value)} spellCheck={false} value={request.body} />
							{bodyValidation ? <p className="m-0 text-xs text-[#8a3f30]" role="alert">{bodyValidation}</p> : <SyntaxJson value={formatJson(request.body).formatted} />}
						</>
						) : (
						<div className="flex flex-col gap-2">
							<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted"><span>Key</span><span>Value</span><span>Optional file</span><span>Action</span></div>
							{request.formFields.map((field) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2" key={field.id}>
								<input aria-label="Form field key" className="min-w-0 border border-line bg-white px-2 py-2 text-xs" onChange={(event) => setField("formFields", updateRow(request.formFields, field.id, { key: event.target.value }) as ApiFormField[])} placeholder="name" value={field.key} />
								<input aria-label="Form field value" className="min-w-0 border border-line bg-white px-2 py-2 text-xs" disabled={Boolean(field.fileName)} onChange={(event) => setField("formFields", updateRow(request.formFields, field.id, { value: event.target.value }) as ApiFormField[])} placeholder="Ada Lovelace" value={field.value} />
								<div className="min-w-0"><input aria-label="Form data file" className="w-full min-w-0 text-[10px]" onChange={(event) => void addFormFile(field, event.currentTarget.files?.[0])} type="file" />{field.fileName ? <span className="block truncate text-[10px] text-muted">{field.fileName} · {Math.round((field.base64?.length ?? 0) * 0.75 / 1024)} KB</span> : null}</div>
								<button aria-label="Remove form field" className={formButton} onClick={() => setField("formFields", request.formFields.filter((item) => item.id !== field.id))} type="button">Remove</button>
							</div>)}
							<button className={`${formButton} self-start`} onClick={() => setField("formFields", [...request.formFields, { ...blankRow("form"), fileName: undefined, mimeType: undefined, base64: undefined }])} type="button">Add form field</button>
						</div>
						)}
					</div>
				) : null}
			</section>

			<ErrorNote message={error} />
			{response ? (
				<section aria-label="API response" className="flex flex-col gap-3 border-t border-line pt-4" aria-live="polite">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="m-0 text-sm font-semibold">Response</h2>
						<div className="flex flex-wrap items-center gap-2"><span className={`border px-2 py-1 font-mono text-xs ${response.status >= 200 && response.status < 300 ? "border-[#bfd0bf] bg-[#eef5ee] text-[#315340]" : response.status < 400 ? "border-[#ddceb1] bg-[#fbf5e8] text-[#79602b]" : "border-[#dfc2b9] bg-[#fbefec] text-[#8a3f30]"}`}>{response.status} {response.statusText}</span><span className={chip}>{response.elapsedMs} ms</span><span className={chip}>{(new TextEncoder().encode(response.body).length / 1024).toFixed(1)} KB{response.truncated ? " · truncated" : ""}</span></div>
					</div>
					<div className="flex flex-wrap items-center gap-1 border-b border-line">
						{(["body", "headers"] as const).map((tab) => <button aria-pressed={responseTab === tab} className={`border-b-2 px-3 py-2 text-xs ${responseTab === tab ? "border-forest font-semibold text-ink" : "border-transparent text-muted"}`} key={tab} onClick={() => setResponseTab(tab)} type="button">{tab === "body" ? "Body" : "Headers"}{tab === "headers" ? ` (${Object.keys(response.headers).length})` : ""}</button>)}
						{responseTab === "body" && isJsonResponse ? <button className={`${formButton} ml-auto`} onClick={() => setPrettyResponse((value) => !value)} type="button">{prettyResponse ? "Raw" : "Pretty"} JSON</button> : null}
					</div>
					{responseTab === "body" ? (isJsonResponse && prettyResponse ? <SyntaxJson value={responseBody} /> : <pre className="m-0 max-h-[460px] min-h-28 overflow-auto whitespace-pre-wrap break-words border border-line bg-[#f8f7f3] p-3 font-mono text-xs leading-relaxed">{responseBody || "(empty response body)"}</pre>) : (
						<div className="overflow-auto border border-line"><table className="w-full border-collapse text-left text-xs"><thead className="bg-[#f3f2ec] uppercase text-[10px] text-muted"><tr><th className="px-3 py-2">Header</th><th className="px-3 py-2">Value</th></tr></thead><tbody>{Object.entries(response.headers).map(([key, value]) => <tr className="border-t border-line" key={key}><th className="max-w-52 break-all px-3 py-2 text-left font-mono font-medium">{key}</th><td className="break-all px-3 py-2 font-mono">{value}</td></tr>)}</tbody></table></div>
						)}
					{response.truncated ? <p className="m-0 text-xs text-muted">Response body is capped at 1 MB to protect this service.</p> : null}
				</section>
			) : null}

			<section aria-label="Request history" className="flex flex-col gap-2 border-t border-line pt-4">
				<div className="flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-sm font-semibold">Recent requests <span className="font-normal text-muted">({history.length})</span></h2>{history.length ? <button className={formButton} onClick={() => setHistory([])} type="button">Clear history</button> : null}</div>
				{history.length ? <ul className="m-0 flex max-h-64 flex-col gap-1 overflow-auto p-0">{history.map((entry) => <li className="list-none" key={entry.id}><button className="flex w-full items-center gap-2 border border-line bg-[#fbfaf7] px-2.5 py-2 text-left hover:bg-[#f1f0ea]" onClick={() => selectHistory(entry)} type="button"><span className="w-14 shrink-0 font-mono text-[10px] font-semibold text-forest">{entry.request.method}</span><span className="min-w-0 flex-1 truncate text-xs">{entry.request.name || entry.request.url}</span><span className={`shrink-0 font-mono text-[10px] ${entry.error ? "text-[#8a3f30]" : "text-muted"}`}>{entry.response ? `${entry.response.status} · ${entry.response.elapsedMs} ms` : entry.error ? "Error" : "Sent"}</span></button></li>)}</ul> : <p className={hintClassName}>Your recent requests will appear here and stay in this browser only.</p>}
			</section>
			<p className="m-0 border border-[#e6ddc4] bg-[#fbf7ea] p-3 text-[11px] leading-relaxed text-[#64583a]">Requests are relayed by ClickKit’s server to work around browser CORS restrictions. The server blocks local/private network targets, does not follow redirects, caps request/response sizes, and does not store requests. Request definitions and history stay in this browser; authorization headers necessarily pass through the relay, so avoid sending secrets to untrusted endpoints or using this on a shared device.</p>
		</ToolPanel>
	);
};
