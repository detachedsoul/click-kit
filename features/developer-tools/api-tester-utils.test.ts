import { describe, expect, it } from "vitest";
import { buildRequestUrl, displayResponseBody, formatJson, isPublicIpAddress, newApiRequest, parseRequestHeaders, safeReadHistory } from "@/features/developer-tools/api-tester-utils";

describe("API tester helpers", () => {
	it("builds query strings while retaining existing parameters and repeated keys", () => {
		const url = buildRequestUrl("https://api.example.com/items?tag=one", [
			{ id: "a", key: "page", value: "2" },
			{ id: "b", key: "tag", value: "two & three" },
			{ id: "c", key: "", value: "ignored" },
		]);
		expect(new URL(url).searchParams.getAll("tag")).toEqual(["one", "two & three"]);
		expect(new URL(url).searchParams.get("page")).toBe("2");
	});

	it("omits empty header names and uses the last repeated name", () => {
		expect(parseRequestHeaders([
			{ id: "1", key: " Accept ", value: "text/plain" },
			{ id: "2", key: "", value: "unused" },
			{ id: "3", key: "Accept", value: "application/json" },
		])).toEqual({ Accept: "application/json" });
	});

	it("formats valid JSON and leaves invalid JSON visible to the editor", () => {
		expect(formatJson('{"ok":true,"count":2}')).toEqual({ formatted: '{\n  "ok": true,\n  "count": 2\n}', error: "" });
		expect(formatJson("{oops")).toEqual({ formatted: "{oops", error: "The JSON is not valid yet." });
		expect(displayResponseBody('{"ok":true}', true)).toBe('{\n  "ok": true\n}');
		expect(displayResponseBody("plain text", true)).toBe("plain text");
	});

	it("keeps only request-shaped entries from local history", () => {
		const valid = { id: "h1", savedAt: "2026-11-15T12:00:00Z", request: newApiRequest() };
		expect(safeReadHistory(JSON.stringify([valid, { nope: true }]))).toEqual([valid]);
		expect(safeReadHistory("not JSON")).toEqual([]);
		expect(safeReadHistory(JSON.stringify({ ...valid }))).toEqual([]);
	});

	it("allows public addresses and blocks local, private, reserved, and mapped-private IPs", () => {
		for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPublicIpAddress(address)).toBe(true);
		for (const address of ["127.0.0.1", "10.0.0.8", "172.20.4.1", "192.168.1.4", "169.254.0.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "2001:db8::1", "::ffff:192.168.1.1"]) expect(isPublicIpAddress(address)).toBe(false);
	});
});
