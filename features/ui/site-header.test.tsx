import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SiteHeader from "@/components/site-header";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
	cleanup();
	push.mockClear();
});

const searchBox = () => screen.getByLabelText("Search tools");

describe("site header", () => {
	it("paints solid paper instead of a frosted panel", () => {
		render(<SiteHeader />);
		const header = screen.getByRole("banner");
		// A backdrop blur makes iOS rasterise the header's own text, which reads as blurry.
		expect(header.className).not.toMatch(/backdrop-blur/u);
		expect(header.className).not.toMatch(/bg-paper\//u);
		expect(header.className).toMatch(/\bbg-paper\b/u);
	});

	it("finds tools as you type and opens the one you choose", async () => {
		const user = userEvent.setup();
		render(<SiteHeader />);
		await user.type(searchBox(), "word");
		const option = screen.getByRole("option", { name: /Word counter/u });
		expect(option.getAttribute("href")).toBe("/tools/word-counter");
		await user.click(option);
		expect(searchBox()).toHaveProperty("value", "");
	});

	it("moves through the results with the arrow keys and opens one with Enter", async () => {
		const user = userEvent.setup();
		render(<SiteHeader />);
		const input = searchBox();
		await user.type(input, "converter");
		const options = screen.getAllByRole("option");
		expect(options.length).toBeGreaterThan(1);
		fireEvent.keyDown(input, { key: "ArrowDown" });
		const second = screen.getAllByRole("option")[1];
		expect(second.getAttribute("aria-selected")).toBe("true");
		fireEvent.keyDown(input, { key: "Enter" });
		expect(push).toHaveBeenCalledWith(second.getAttribute("href"));
		expect(searchBox()).toHaveProperty("value", "");
	});

	it("clears the search with Escape or the clear button", async () => {
		const user = userEvent.setup();
		render(<SiteHeader />);
		await user.type(searchBox(), "json");
		fireEvent.keyDown(window, { key: "Escape" });
		expect(searchBox()).toHaveProperty("value", "");
		await user.type(searchBox(), "json");
		await user.click(screen.getByRole("button", { name: "Clear search" }));
		expect(searchBox()).toHaveProperty("value", "");
	});

	it("says when nothing matches", async () => {
		const user = userEvent.setup();
		render(<SiteHeader />);
		await user.type(searchBox(), "zzzznothing");
		expect(screen.getByText("No matching tools")).toBeTruthy();
	});

	it("focuses the field with the keyboard shortcut", () => {
		render(<SiteHeader />);
		fireEvent.keyDown(window, { key: "k", metaKey: true });
		expect(document.activeElement).toBe(searchBox());
	});
});
