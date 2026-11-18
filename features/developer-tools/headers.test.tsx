import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { gradeHeaders, parseHeaders, summariseCaching } from "@/features/developer-tools/headers-utils";
import { HeadersTool } from "@/features/developer-tools/headers-tool";

afterEach(cleanup);

const secure = `HTTP/1.1 200 OK
Content-Type: text/html
Strict-Transport-Security: max-age=63072000; includeSubDomains
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cache-Control: public, max-age=3600
ETag: "v1"
Set-Cookie: a=1; Secure
Set-Cookie: b=2; HttpOnly`;

describe("HTTP header parser", () => {
	it("parses a response with duplicated and folded values", () => {
		const parsed = parseHeaders(secure);
		expect(parsed.kind).toBe("response");
		expect(parsed.startLine).toBe("HTTP/1.1 200 OK");
		expect(parsed.headers.find((header) => header.name === "set-cookie")?.count).toBe(2);
		expect(parsed.raw["strict-transport-security"][0]).toContain("includeSubDomains");
		const folded = parseHeaders("X-Long: first\n    second\nContent-Type: text/plain");
		expect(folded.raw["x-long"][0]).toBe("first second");
		expect(folded.kind).toBe("headers");
	});

	it("detects request lines and rejects malformed input", () => {
		const parsed = parseHeaders("GET /api/health HTTP/1.1\nHost: example.com\nAccept: */*");
		expect(parsed.kind).toBe("request");
		expect(parsed.headers).toHaveLength(2);
		expect(() => parseHeaders("   ")).toThrow(/Paste HTTP headers/u);
		expect(() => parseHeaders("not a header line")).toThrow(/Name: value/u);
		expect(() => parseHeaders("Bad Name: value")).toThrow(/valid header name/u);
	});

	it("grades a hardened response above a bare one", () => {
		const good = gradeHeaders(parseHeaders(secure));
		expect(good.grade).toBe("A");
		expect(good.findings.every((finding) => finding.state !== "fail")).toBe(true);
		const bare = gradeHeaders(parseHeaders("HTTP/1.1 200 OK\nContent-Type: text/html\nServer: nginx/1.2"));
		expect(bare.score).toBeLessThan(good.score);
		expect(bare.findings.filter((finding) => finding.state === "fail").map((finding) => finding.label)).toContain("Strict-Transport-Security");
		expect(bare.findings.find((finding) => finding.label === "Version disclosure")?.state).toBe("warn");
	});

	it("flags weak policies", () => {
		const weak = gradeHeaders(
			parseHeaders("Content-Security-Policy: default-src 'self' 'unsafe-inline'\nStrict-Transport-Security: max-age=300\nReferrer-Policy: unsafe-url"),
		);
		expect(weak.findings.find((finding) => finding.label === "Content-Security-Policy")?.state).toBe("warn");
		expect(weak.findings.find((finding) => finding.label === "Strict-Transport-Security")?.state).toBe("warn");
		expect(weak.findings.find((finding) => finding.label === "Referrer-Policy")?.state).toBe("fail");
	});

	it("summarises caching directives", () => {
		const caching = summariseCaching(parseHeaders(secure));
		expect(caching.directives).toEqual(["public", "max-age=3600"]);
		expect(caching.hasValidator).toBe(true);
		expect(caching.vary).toBe("Not set");
	});

	it("renders the review and reacts to broken input", () => {
		render(<HeadersTool />);
		expect(screen.getByText("HTTP/2 200")).toBeTruthy();
		expect(screen.getByText(/Overall grade/u)).toBeTruthy();
		expect(screen.getAllByLabelText("Result").length).toBeGreaterThan(0);
		fireEvent.change(screen.getByLabelText("Raw headers"), { target: { value: "broken" } });
		expect(screen.getByText(/not a "Name: value" header/u)).toBeTruthy();
	});
});
