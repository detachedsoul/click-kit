import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HttpStatusTool } from "@/features/developer-tools/http-status-tool";
import { filterStatuses, httpStatuses } from "@/features/developer-tools/http-status-utils";

afterEach(cleanup);

describe("HTTP status reference", () => {
	it("covers every status class with unique codes", () => {
		expect(httpStatuses.length).toBeGreaterThanOrEqual(55);
		expect(new Set(httpStatuses.map((item) => item.code)).size).toBe(httpStatuses.length);
		for (const category of ["1xx", "2xx", "3xx", "4xx", "5xx"]) {
			expect(httpStatuses.some((item) => item.category === category)).toBe(true);
		}
	});

	it("sorts codes in ascending order", () => {
		const codes = httpStatuses.map((item) => item.code);
		expect(codes).toEqual([...codes].sort((a, b) => a - b));
	});

	it("filters by code, name, and description", () => {
		expect(filterStatuses("429").map((item) => item.name)).toEqual(["Too Many Requests"]);
		expect(filterStatuses("not found").map((item) => item.code)).toEqual([404]);
		expect(filterStatuses("rate").map((item) => item.code)).toEqual([429]);
		expect(filterStatuses("").length).toBe(httpStatuses.length);
		expect(filterStatuses("zzz")).toEqual([]);
	});

	it("filters by category", () => {
		expect(filterStatuses("", "2xx").every((item) => item.category === "2xx")).toBe(true);
		expect(filterStatuses("created", "2xx").map((item) => item.code)).toEqual([201]);
		expect(filterStatuses("created", "4xx")).toEqual([]);
	});

	it("renders results and narrows with the search box", async () => {
		const user = userEvent.setup();
		render(<HttpStatusTool />);
		expect(screen.getByRole("status").textContent).toContain(`${httpStatuses.length} of ${httpStatuses.length}`);
		fireEvent.change(screen.getByLabelText("Search by code, name, or meaning"), { target: { value: "teapot" } });
		expect(screen.getByText("I'm a Teapot")).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("1 of");
		await user.click(screen.getByRole("button", { name: "5xx Server error" }));
		expect(screen.getByRole("status").textContent).toContain("0 of");
		expect(screen.getByText(/No status codes match/u)).toBeTruthy();
	});
});
