const maximumSourceLength = 100_000;
const maximumHeaders = 200;

export type ParsedHeaders = {
	startLine: string | null;
	headers: { name: string; value: string; count: number }[];
	raw: Record<string, string[]>;
	kind: "response" | "request" | "headers";
};

export const parseHeaders = (source: string): ParsedHeaders => {
	if (!source.trim()) throw new Error("Paste HTTP headers to inspect first.");
	if (source.length > maximumSourceLength) throw new Error("Keep header input under 100,000 characters.");
	const lines = source.replace(/\r\n/gu, "\n").split("\n");
	let index = 0;
	let startLine: string | null = null;
	const first = lines[0]?.trim() ?? "";
	if (/^HTTP\/\d(\.\d)?\s+\d{3}/iu.test(first) || /^[A-Z]+\s+\S+\s+HTTP\/\d/iu.test(first)) {
		startLine = first;
		index = 1;
	}
	const raw: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
	let lastName: string | null = null;
	for (; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim()) continue;
		if (/^\s/u.test(line) && lastName) {
			const values = raw[lastName];
			values[values.length - 1] = `${values[values.length - 1]} ${line.trim()}`;
			continue;
		}
		const colon = line.indexOf(":");
		if (colon <= 0) throw new Error(`Line ${index + 1} is not a "Name: value" header.`);
		const name = line.slice(0, colon).trim();
		if (!/^[!#$%&'*+\-.^_`|~\w]+$/u.test(name)) throw new Error(`"${name}" is not a valid header name.`);
		const value = line.slice(colon + 1).trim();
		const key = name.toLowerCase();
		raw[key] ??= [];
		raw[key].push(value);
		lastName = key;
	}
	const headers = Object.entries(raw).map(([name, values]) => ({ name, value: values.join(", "), count: values.length }));
	if (headers.length === 0) throw new Error("No header lines found.");
	if (headers.length > maximumHeaders) throw new Error("Inspect at most 200 header names at a time.");
	return { startLine, headers, raw, kind: startLine ? (/^HTTP\//iu.test(startLine) ? "response" : "request") : "headers" };
};

const get = (parsed: ParsedHeaders, name: string) => parsed.raw[name]?.[0] ?? "";

export type SecurityFinding = { label: string; state: "pass" | "warn" | "fail"; detail: string };

export type SecurityReport = { grade: string; score: number; passed: number; total: number; findings: SecurityFinding[] };

export const gradeHeaders = (parsed: ParsedHeaders): SecurityReport => {
	const finding = (label: string, state: "pass" | "warn" | "fail", detail: string): SecurityFinding => ({ label, state, detail });
	const findings: SecurityFinding[] = [];
	const hsts = get(parsed, "strict-transport-security");
	const maxAge = Number(/max-age=(\d+)/iu.exec(hsts)?.[1] ?? "0");
	findings.push(
		!hsts
			? finding("Strict-Transport-Security", "fail", "Missing: browsers can downgrade to HTTP on first contact.")
			: maxAge >= 15_552_000
				? finding("Strict-Transport-Security", "pass", `max-age ${maxAge.toLocaleString()} seconds${/includeSubDomains/iu.test(hsts) ? " with includeSubDomains" : ""}.`)
				: finding("Strict-Transport-Security", "warn", `max-age is ${maxAge} seconds; 15,552,000 (180 days) or more is recommended.`),
	);
	const csp = get(parsed, "content-security-policy");
	if (!csp) findings.push(finding("Content-Security-Policy", "fail", "Missing: injected scripts are not restricted."));
	else if (/unsafe-inline|unsafe-eval/iu.test(csp)) findings.push(finding("Content-Security-Policy", "warn", "Present but allows unsafe-inline or unsafe-eval."));
	else findings.push(finding("Content-Security-Policy", "pass", "Present without unsafe-inline or unsafe-eval."));
	const nosniff = get(parsed, "x-content-type-options").toLowerCase() === "nosniff";
	findings.push(nosniff ? finding("X-Content-Type-Options", "pass", "nosniff prevents MIME sniffing.") : finding("X-Content-Type-Options", "fail", "Missing or not nosniff."));
	const frameOptions = get(parsed, "x-frame-options").toUpperCase();
	const cspFrames = /frame-ancestors/iu.test(csp);
	findings.push(
		cspFrames || frameOptions === "DENY" || frameOptions === "SAMEORIGIN"
			? finding("Clickjacking protection", "pass", cspFrames ? "CSP frame-ancestors is set." : `X-Frame-Options is ${frameOptions}.`)
			: finding("Clickjacking protection", "fail", "Set X-Frame-Options or a CSP frame-ancestors directive."),
	);
	const referrer = get(parsed, "referrer-policy").toLowerCase();
	findings.push(
		!referrer
			? finding("Referrer-Policy", "warn", "Missing: URLs may leak to third parties in the Referer header.")
			: referrer.includes("unsafe-url")
				? finding("Referrer-Policy", "fail", "unsafe-url sends full URLs to every destination.")
				: finding("Referrer-Policy", "pass", referrer),
	);
	const permissions = get(parsed, "permissions-policy");
	findings.push(permissions ? finding("Permissions-Policy", "pass", "Browser features are explicitly scoped.") : finding("Permissions-Policy", "warn", "Missing: powerful browser features are unrestricted."));
	const coop = get(parsed, "cross-origin-opener-policy").toLowerCase();
	findings.push(coop ? finding("Cross-Origin-Opener-Policy", "pass", coop) : finding("Cross-Origin-Opener-Policy", "warn", "Missing: cross-window isolation is not requested."));
	const server = get(parsed, "server");
	const powered = get(parsed, "x-powered-by");
	findings.push(
		server || powered
			? finding("Version disclosure", "warn", [server && `Server: ${server}`, powered && `X-Powered-By: ${powered}`].filter(Boolean).join(" · "))
			: finding("Version disclosure", "pass", "No Server or X-Powered-By header."),
	);
	const passed = findings.filter((item) => item.state === "pass").length;
	const weights = findings.reduce((total, item) => total + (item.state === "pass" ? 1 : item.state === "warn" ? 0.5 : 0), 0);
	const score = Math.round((weights / findings.length) * 100);
	const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";
	return { grade, score, passed, total: findings.length, findings };
};

export type CachingSummary = { cacheControl: string; directives: string[]; hasValidator: boolean; vary: string };

export const summariseCaching = (parsed: ParsedHeaders): CachingSummary => {
	const cacheControl = get(parsed, "cache-control");
	const directives = cacheControl
		.split(",")
		.map((directive) => directive.trim())
		.filter(Boolean);
	return {
		cacheControl: cacheControl || "Not set",
		directives,
		hasValidator: Boolean(get(parsed, "etag") || get(parsed, "last-modified")),
		vary: get(parsed, "vary") || "Not set",
	};
};
