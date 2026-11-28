import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/api-tester/route";

const post = (payload: Record<string, unknown>) => POST(new Request("http://localhost/api/api-tester", {
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify(payload),
}));

describe("API tester request relay", () => {
	it("blocks loopback targets before opening a connection", async () => {
		const response = await post({ method: "GET", url: "http://127.0.0.1:3000/private", headers: {} });
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: expect.stringMatching(/private|local/iu) });
	});

	it("blocks internal hostnames and protocols outside HTTP", async () => {
		const local = await post({ method: "GET", url: "http://service.internal/status", headers: {} });
		const otherProtocol = await post({ method: "GET", url: "file:///etc/passwd", headers: {} });
		expect(local.status).toBe(400);
		expect(otherProtocol.status).toBe(400);
	});

	it("rejects unsupported methods and invalid request JSON without forwarding", async () => {
		const method = await post({ method: "TRACE", url: "https://example.com", headers: {} });
		const body = await post({ method: "POST", url: "https://example.com", bodyKind: "json", body: "{bad", headers: {} });
		expect(method.status).toBe(400);
		expect(body.status).toBe(400);
	});
});
