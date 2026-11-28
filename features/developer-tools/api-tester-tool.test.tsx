import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiTesterTool } from "@/features/developer-tools/api-tester-tool";

const mockedFetch = vi.fn();
const responseData = {
	status: 201,
	statusText: "Created",
	headers: { "content-type": "application/json", "x-request-id": "test-123" },
	body: '{"id":12,"created":true}',
	elapsedMs: 48,
	truncated: false,
};

beforeEach(() => {
	localStorage.clear();
	mockedFetch.mockReset();
	mockedFetch.mockResolvedValue(new Response(JSON.stringify(responseData), { status: 200, headers: { "content-type": "application/json" } }));
	vi.stubGlobal("fetch", mockedFetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("API tester", () => {
	it("sends through the same-origin relay and shows status, timing, JSON, and response headers", async () => {
		const user = userEvent.setup();
		render(<ApiTesterTool />);
		await user.selectOptions(screen.getByLabelText("Method"), "POST");
		await user.click(screen.getByRole("button", { name: "Send request" }));
		expect(await screen.findByText("201 Created")).toBeTruthy();
		expect(screen.getByText("48 ms")).toBeTruthy();
		expect(screen.getByLabelText("Syntax highlighted JSON").textContent).toContain('"id": 12');
		expect(mockedFetch).toHaveBeenCalledTimes(1);
		const [url, options] = mockedFetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/api-tester");
		expect(options.method).toBe("POST");
		const payload = JSON.parse(String(options.body));
		expect(payload.method).toBe("POST");
		expect(payload.url).toBe("https://jsonplaceholder.typicode.com/posts/1");
		await user.click(screen.getByRole("button", { name: /Headers \(2\)/u }));
		expect(await screen.findByText("x-request-id")).toBeTruthy();
	});

	it("adds query parameters, supports form-data, and records request history", async () => {
		const user = userEvent.setup();
		render(<ApiTesterTool />);
		await user.click(screen.getByRole("button", { name: /Params/u }));
		await user.click(screen.getByRole("button", { name: "Add parameter" }));
		await user.type(screen.getByLabelText("Parameter name"), "page");
		await user.type(screen.getByLabelText("Parameter value"), "2");
		await user.click(screen.getByRole("button", { name: /Body/u }));
		await user.click(screen.getByRole("button", { name: "Form-data" }));
		await user.selectOptions(screen.getByLabelText("Method"), "PATCH");
		await user.click(screen.getByRole("button", { name: "Send request" }));
		expect(await screen.findByRole("button", { name: /PATCH.*Untitled request.*201/u })).toBeTruthy();
		const payload = JSON.parse(String((mockedFetch.mock.calls[0] as [string, RequestInit])[1].body));
		expect(payload.method).toBe("PATCH");
		expect(payload.url).toContain("page=2");
		expect(payload.bodyKind).toBe("form");
		expect(payload.formFields).toEqual(expect.arrayContaining([expect.objectContaining({ key: "name", value: "Ada Lovelace" })]));
	});

	it("does not call the relay for malformed JSON and explains the CORS-safe proxy", async () => {
		const user = userEvent.setup();
		render(<ApiTesterTool />);
		await user.click(screen.getByRole("button", { name: /Body/u }));
		const editor = screen.getByLabelText("JSON request body");
		await user.clear(editor);
		fireEvent.change(editor, { target: { value: "{bad" } });
		expect(screen.getByText("The JSON is not valid yet.")).toBeTruthy();
		expect((screen.getByRole("button", { name: "Send request" }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText(/relayed by ClickKit’s server/u)).toBeTruthy();
		expect(mockedFetch).not.toHaveBeenCalled();
	});
});
