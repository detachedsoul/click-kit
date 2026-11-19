"use client";

import { useMemo, useState } from "react";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";
import { gradeHeaders, parseHeaders, summariseCaching } from "@/features/developer-tools/headers-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";

const sample = `HTTP/2 200
content-type: text/html; charset=utf-8
cache-control: public, max-age=600, must-revalidate
etag: "abc123"
strict-transport-security: max-age=63072000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
content-security-policy: default-src 'self'; frame-ancestors 'none'
server: nginx/1.25.3
set-cookie: session=abc; HttpOnly; Secure
set-cookie: theme=dark; Path=/; SameSite=Lax`;

export const HeadersTool = () => {
	const [source, setSource] = useState(sample);
	const result = useMemo(() => {
		try {
			const parsed = parseHeaders(source);
			return { parsed, security: gradeHeaders(parsed), caching: summariseCaching(parsed), error: "" };
		} catch (error) {
			return { parsed: null, security: null, caching: null, error: error instanceof Error ? error.message : "Could not parse these headers." };
		}
	}, [source]);
	const gradeTone = result.security
		? result.security.score >= 80
			? "text-[#315e43]"
			: result.security.score >= 60
				? "text-[#6f5416]"
				: "text-[#8a3028]"
		: "";
	return (
		<ToolPanel>
			<TextAreaField
				id="headers-input"
				label="Raw headers"
				value={source}
				onChange={setSource}
				placeholder={"HTTP/1.1 200 OK\ncontent-type: text/html"}
				rows={14}
				hint="Paste a response or request start line with headers, or just the header lines. Folded continuation lines are joined automatically."
			/>
			<ErrorNote message={result.error} />
			{result.parsed && result.security && result.caching && (
				<>
					{result.parsed.startLine && (
						<p className="m-0 font-mono text-xs text-[#3e4139]" role="status">
							{result.parsed.startLine}
						</p>
					)}
					<StatGrid
						items={[
							{ label: "Header names", value: String(result.parsed.headers.length) },
							{ label: "Message type", value: result.parsed.kind },
							{ label: "Security grade", value: `${result.security.grade} · ${result.security.score}/100` },
							{ label: "Checks passed", value: `${result.security.passed} of ${result.security.total}` },
						]}
					/>
					<section className="flex flex-col gap-2 border-t border-line pt-[18px]">
						<h2 className="m-0 text-sm font-semibold">Security review</h2>
						<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
							{result.security.findings.map((finding) => (
								<li className="flex flex-wrap items-baseline gap-2 text-xs" key={finding.label}>
									<span
										className={`font-mono text-[10px] uppercase tracking-[.08em] ${
											finding.state === "pass" ? "text-[#315e43]" : finding.state === "warn" ? "text-[#6f5416]" : "text-[#8a3028]"
										}`}
									>
										{finding.state}
									</span>
									<span className="font-semibold text-ink">{finding.label}</span>
									<span className="text-[#5b5e55]">{finding.detail}</span>
								</li>
							))}
						</ul>
						<p className={`m-0 text-xs font-semibold ${gradeTone}`}>Overall grade {result.security.grade}</p>
					</section>
					<ResultBlock
						title="Caching"
						value={[
							`Cache-Control: ${result.caching.cacheControl}`,
							`Directives: ${result.caching.directives.length ? result.caching.directives.join(", ") : "none"}`,
							`Validators: ${result.caching.hasValidator ? "ETag or Last-Modified present" : "none"}`,
							`Vary: ${result.caching.vary}`,
						].join("\n")}
						rows={5}
					/>
					<ResultBlock
						title="Parsed headers"
						value={result.parsed.headers.map((header) => `${header.name}: ${header.value}${header.count > 1 ? ` (${header.count} values)` : ""}`).join("\n")}
						rows={12}
						fileName="headers.txt"
					/>
				</>
			)}
			<p className={hintClassName}>
				The score weights each security header: passes count fully, warnings half, and failures not at all. It reviews headers only, not your
				application code.
			</p>
		</ToolPanel>
	);
};
