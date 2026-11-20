import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HtmlToMarkdownTool } from "@/features/converter-tools/html-markdown-tool";

afterEach(cleanup);

const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;

describe("html to markdown tool", () => {
	it("starts with the sample converted", () => {
		render(<HtmlToMarkdownTool />);
		expect(output()).toContain("# Shopping list");
		expect(output()).toContain("**bread**");
		expect(output()).toContain("[market run](https://example.com/market)");
		expect(output()).toContain("> Buy the good tomatoes.");
	});

	it("converts what is typed after loading", async () => {
		const user = userEvent.setup();
		render(<HtmlToMarkdownTool />);
		const input = screen.getByLabelText("HTML input");
		await user.clear(input);
		await user.type(input, "<h2>Steps</h2><ol><li>Mix</li><li>Bake</li></ol>");
		expect(output()).toBe("## Steps\n\n1. Mix\n2. Bake");
	});

	it("drops links when the box is unticked", async () => {
		const user = userEvent.setup();
		render(<HtmlToMarkdownTool />);
		const input = screen.getByLabelText("HTML input");
		await user.clear(input);
		await user.type(input, '<p><a href="https://example.com">the site</a></p>');
		expect(output()).toBe("[the site](https://example.com)");
		await user.click(screen.getByLabelText("Links"));
		expect(output()).toBe("the site");
	});

	it("switches to plain text", async () => {
		const user = userEvent.setup();
		render(<HtmlToMarkdownTool />);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(output()).toContain("Shopping list");
		expect(output()).not.toContain("#");
		expect(screen.queryByLabelText("Links")).toBeNull();
	});

	it("empties the result when the input goes", async () => {
		const user = userEvent.setup();
		render(<HtmlToMarkdownTool />);
		await user.clear(screen.getByLabelText("HTML input"));
		expect(output()).toBe("");
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("offers a markdown file to download", async () => {
		const user = userEvent.setup();
		render(<HtmlToMarkdownTool />);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(await screen.findByRole("link", { name: "Download converted.txt" })).toBeTruthy();
	});
});
