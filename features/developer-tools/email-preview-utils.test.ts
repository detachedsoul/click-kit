import { describe, expect, it } from "vitest";
import { EMAIL_SAMPLES, buildEmailDocument, sanitizeEmailHtml, validateEmailHtml } from "@/features/developer-tools/email-preview-utils";

describe("email preview helpers", () => {
	it("provides several editable sample email templates", () => {
		expect(EMAIL_SAMPLES.length).toBeGreaterThanOrEqual(3);
		expect(EMAIL_SAMPLES.every((sample) => sample.html.includes("<html"))).toBe(true);
	});

	it("removes scripts, active elements, event handlers, unsafe links, and CSS URLs", () => {
		const result = sanitizeEmailHtml(`<style>.x{color:red;background:url(https://tracker.example/pixel)}</style><div onclick="alert(1)"><script>steal()</script><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)" target="_top">Open</a><img src="https://tracker.example/pixel"></div>`);
		expect(result.html).not.toMatch(/script|iframe|onclick|javascript:|tracker\.example|target=/iu);
		expect(result.plainText).toBe("Open");
		expect(result.warnings.join(" ")).toMatch(/active|stylesheet|Remote images/u);
	});

	it("loads only HTTPS remote images when the user opts in", () => {
		const html = `<p>Hi</p><img alt="Banner" src="https://cdn.example/banner.png"><img src="http://cdn.example/insecure.png"><img src="data:image/svg+xml;base64,PHN2Zz4=">`;
		const blocked = sanitizeEmailHtml(html);
		const enabled = sanitizeEmailHtml(html, true);
		expect(blocked.html).not.toContain("https://cdn.example");
		expect(enabled.html).toContain('src="https://cdn.example/banner.png"');
		expect(enabled.html).not.toContain("http://cdn.example");
		expect(enabled.html).not.toContain("data:image/svg+xml");
		expect(buildEmailDocument(enabled.html, true)).toContain("img-src data: https:");
		expect(buildEmailDocument(blocked.html, false)).toContain("img-src data:;");
	});

	it("converts the safe markup to readable plain text and reports missing image alt text", () => {
		const result = sanitizeEmailHtml(`<style>p{color:red}</style><table><tr><td><h1>Hello</h1><p>World<br>again</p><img src="data:image/png;base64,AA=="></td></tr></table>`);
		expect(result.plainText).toBe("Hello\n\nWorld\nagain");
		expect(result.plainText).not.toContain("color:red");
		expect(result.warnings.join(" ")).toMatch(/alternative text/u);
		expect(validateEmailHtml("<p>Hello</p>", result).warnings.join(" ")).toMatch(/doctype/u);
	});

	it("requires content and rejects oversized templates", () => {
		expect(sanitizeEmailHtml("").errors).toEqual(["HTML is empty."]);
		expect(sanitizeEmailHtml("x".repeat(500_001)).errors[0]).toMatch(/500 KB/u);
	});
});
