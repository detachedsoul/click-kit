"use client";

import { useMemo, useState } from "react";
import { SelectField } from "@/components/select-field";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { curlToAxios, curlToFetch, curlToPython, parseCurl } from "@/features/developer-tools/curl-utils";
import { ErrorNote, ResultBlock, ToolPanel, hintClassName, labelClassName, selectClassName } from "@/features/developer-tools/tool-ui";

const sample = `curl -X POST 'https://api.example.com/v1/users' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer demo-token' \\
  -d '{"name":"Ada","email":"ada@example.com","roles":["admin"]}'`;

type Target = "fetch" | "axios" | "python";

export const CurlTool = () => {
	const [source, setSource] = useState(sample);
	const [target, setTarget] = useState<Target>("fetch");
	const result = useMemo(() => {
		try {
			const request = parseCurl(source);
			const code = target === "fetch" ? curlToFetch(request) : target === "axios" ? curlToAxios(request) : curlToPython(request);
			return { code, error: "", request };
		} catch (error) {
			return { code: "", error: error instanceof Error ? error.message : "Could not read this cURL command.", request: null };
		}
	}, [source, target]);
	const extension = target === "python" ? "py" : target === "axios" ? "ts" : "js";
	return (
		<ToolPanel>
			<TextAreaField
				id="curl-input"
				label="cURL command"
				value={source}
				onChange={setSource}
				placeholder={"curl -X POST https://api.example.com \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"ok\":true}'"}
				rows={9}
				hint="Supports -X, -H, -d/--data/--json, -F, -u, -A, -e, -b, --url, -I, -L, -k, and ignores flags that only affect curl output."
			/>
			<label className={`${labelClassName} max-w-[240px]`} htmlFor="curl-target">
				Target
				<SelectField className={selectClassName} containerClassName="mt-2" id="curl-target" value={target} onChange={(event) => setTarget(event.target.value as Target)}>
					<option value="fetch">JavaScript fetch</option>
					<option value="axios">Axios</option>
					<option value="python">Python requests</option>
				</SelectField>
			</label>
			<ErrorNote message={result.error} />
			{result.request && (
				<p className="m-0 text-xs text-muted" role="status">
					{result.request.method} {result.request.url} · {result.request.headers.length} header
					{result.request.headers.length === 1 ? "" : "s"}
					{result.request.body ? ` · ${result.request.bodyKind} body` : ""}
					{result.request.formFields.length ? ` · ${result.request.formFields.length} form field(s)` : ""}
				</p>
			)}
			{!result.error && <ResultBlock title="Generated code" value={result.code} rows={16} fileName={`request.${extension}`} />}
			<p className={hintClassName}>Secrets in your command are only rendered into the snippet; nothing is sent anywhere.</p>
		</ToolPanel>
	);
};
