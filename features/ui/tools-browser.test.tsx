import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ToolsBrowser from "@/components/tools-browser";
import { categories, tools } from "@/lib/tools";

const STORAGE_KEY = "clickkit:tools-category";

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(cleanup);

describe("tools browser", () => {
	it("shows every tool by default", () => {
		render(<ToolsBrowser />);
		expect(screen.getByRole("status").textContent).toBe(`${tools.length} tools`);
		expect(screen.getAllByRole("link")).toHaveLength(tools.length);
	});

	it("filters by category chip and remembers the choice", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<ToolsBrowser />);
		const calculators = categories.find((category) => category.id === "calculators")!;
		const count = tools.filter((tool) => tool.category === "calculators").length;
		await user.click(screen.getByRole("button", { name: new RegExp(calculators.name, "u") }));
		expect(screen.getByRole("status").textContent).toContain(`${count} of ${tools.length} tools`);
		expect(screen.getByRole("status").textContent).toContain(calculators.name);
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe("calculators");
		unmount();

		render(<ToolsBrowser />);
		expect(screen.getByRole("button", { name: new RegExp(calculators.name, "u") }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("status").textContent).toContain(`${count} of ${tools.length} tools`);
	});

	it("searches names, keywords, and categories with multiple words", async () => {
		const user = userEvent.setup();
		render(<ToolsBrowser />);
		const search = screen.getByLabelText("Search all tools");
		await user.type(search, "json");
		const jsonCount = Number(/(\d+) of 105 tools/u.exec(screen.getByRole("status").textContent ?? "")?.[1]);
		expect(jsonCount).toBeGreaterThan(1);
		expect(jsonCount).toBeLessThan(tools.length);
		expect(screen.getAllByRole("link")).toHaveLength(jsonCount);
		await user.clear(search);
		await user.type(search, "mermaid");
		expect(screen.getByRole("status").textContent).toContain("1 of 105 tools");
		expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("/tools/json-mermaid");
		await user.clear(search);
		await user.type(search, "calculator");
		expect(screen.getAllByRole("link").length).toBeGreaterThan(1);
		expect(screen.getAllByRole("link").every((link) => link.getAttribute("href")?.startsWith("/tools/"))).toBe(true);
	});

	it("combines a category with a search term and can clear both", async () => {
		const user = userEvent.setup();
		render(<ToolsBrowser />);
		await user.click(screen.getByRole("button", { name: /Calculators/u }));
		await user.type(screen.getByLabelText("Search all tools"), "loan");
		const grid = screen.getAllByRole("link");
		expect(grid.length).toBe(1);
		expect(grid[0].getAttribute("href")).toBe("/tools/loan-calculator");
		await user.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(screen.getByRole("status").textContent).toBe(`${tools.length} tools`);
	});

	it("offers a way back when nothing matches", async () => {
		const user = userEvent.setup();
		render(<ToolsBrowser />);
		await user.type(screen.getByLabelText("Search all tools"), "zzzznotathing");
		expect(screen.getByText("Nothing matches that yet.")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Show all tools" }));
		expect(screen.getByRole("status").textContent).toBe(`${tools.length} tools`);
	});
});
