import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CurlTool } from "@/features/developer-tools/curl-tool";
import { curlToAxios, curlToFetch, curlToPython, parseCurl } from "@/features/developer-tools/curl-utils";

afterEach(cleanup);

describe("cURL converter", () => {
	it("parses methods, headers, and JSON bodies", () => {
		const request = parseCurl(`curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{"name":"Ada"}'`);
		expect(request).toMatchObject({
			url: "https://api.example.com/users",
			method: "POST",
			bodyKind: "json",
			headers: [["Content-Type", "application/json"]],
		});
		expect(request.body).toBe('{"name":"Ada"}');
	});

	it("defaults to GET or POST and understands line continuations", () => {
		expect(parseCurl("curl https://example.com").method).toBe("GET");
		const post = parseCurl(`curl 'https://example.com' \\\n  -H 'Accept: */*' \\\n  -d 'a=1'`);
		expect(post.method).toBe("POST");
		expect(post.bodyKind).toBe("text");
		expect(post.headers).toEqual([["Accept", "*/*"]]);
	});

	it("supports basic auth, cookies, form fields, and flags", () => {
		const request = parseCurl(`curl -u user:pa\\"ss -b 'a=1' -F 'name=Ada' -F 'role=admin' -L -k https://example.com/upload`);
		expect(request.basicAuth).toEqual({ user: "user", password: 'pa"ss' });
		expect(request.headers).toContainEqual(["Cookie", "a=1"]);
		expect(request.formFields).toEqual([["name", "Ada"], ["role", "admin"]]);
		expect(request).toMatchObject({ followRedirects: true, insecure: true, method: "POST" });
	});

	it("generates fetch, axios, and Python snippets", () => {
		const request = parseCurl(`curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{"name":"Ada","active":true,"meta":null}'`);
		const fetchCode = curlToFetch(request);
		expect(fetchCode).toContain('method: "POST"');
		expect(fetchCode).toContain('"Content-Type": "application/json"');
		expect(fetchCode).toContain("await response.json()");
		const axiosCode = curlToAxios(request);
		expect(axiosCode).toContain('import axios from "axios";');
		expect(axiosCode).toContain("axios.post(");
		const pythonCode = curlToPython(request);
		expect(pythonCode).toContain("import requests");
		expect(pythonCode).toContain("json={");
		expect(pythonCode).toContain('"active": True');
		expect(pythonCode).toContain('"meta": None');
	});

	it("includes basic auth headers and form data", () => {
		const request = parseCurl(`curl -u user:secret -F 'a=b' https://example.com`);
		expect(curlToFetch(request)).toContain("new FormData()");
		expect(curlToFetch(request)).toContain(`Authorization`);
		expect(curlToPython(request)).toContain("files = {");
	});

	it("rejects malformed commands", () => {
		expect(() => parseCurl("  ")).toThrow(/Paste a cURL command/u);
		expect(() => parseCurl("wget https://example.com")).toThrow(/start with "curl"/u);
		expect(() => parseCurl("curl")).toThrow(/No URL found/u);
		expect(() => parseCurl("curl ftp://example.com")).toThrow(/http and https/u);
		expect(() => parseCurl("curl 'https://example.com")).toThrow(/unclosed quote/u);
		expect(() => parseCurl("curl https://example.com -H 'novalue'")).toThrow(/needs a name and a value/u);
	});

	it("renders code for the selected target", async () => {
		const user = userEvent.setup();
		render(<CurlTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("await fetch(");
		await user.selectOptions(screen.getByLabelText("Target"), "python");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("requests.post(");
		await user.selectOptions(screen.getByLabelText("Target"), "fetch");
		fireEvent.change(screen.getByLabelText("cURL command"), { target: { value: "curl https://example.com" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('method: "GET"');
	});

	it("shows an alert for invalid commands", () => {
		render(<CurlTool />);
		fireEvent.change(screen.getByLabelText("cURL command"), { target: { value: "curl" } });
		expect(screen.getByRole("alert").textContent).toContain("No URL found");
	});
});
