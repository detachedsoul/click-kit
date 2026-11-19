import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownToHtmlTool } from "@/features/converter-tools/markdown-html-tool";

const input = () => screen.getByLabelText("Markdown input") as HTMLTextAreaElement;
const output = () => screen.getByLabelText("Result") as HTMLTextAreaElement;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("markdown to html tool", () => {
	it("starts with a sample already converted", () => {
		render(<MarkdownToHtmlTool />);
		expect(input().value).toContain("# Weekly note");
		expect(output().value).toContain("<h1>Weekly note</h1>");
		expect(output().value).toContain("<table>");
		expect(output().value).not.toContain("<!doctype html>");
	});

	it("converts what you type", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "## Heading\n\nSome **bold** text" } });
		expect(output().value).toBe("<h2>Heading</h2>\n<p>Some <strong>bold</strong> text</p>");
	});

	it("wraps the result in a whole page on request", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "Hello" } });
		fireEvent.click(screen.getByRole("button", { name: "Full page" }));
		expect(output().value.startsWith("<!doctype html>")).toBe(true);
		expect(output().value).toContain("<p>Hello</p>");
		expect(screen.getByRole("link", { name: "Download document.html" })).toBeTruthy();
	});

	it("leaves links alone when the switch is off", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "[docs](https://example.com)" } });
		expect(output().value).toContain('<a href="https://example.com">docs</a>');
		fireEvent.click(screen.getByLabelText("Turn links into anchors"));
		expect(output().value).toBe("<p>[docs](https://example.com)</p>");
	});

	it("leaves the alt text when images are switched off", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "![a cat](/cat.png)" } });
		expect(output().value).toContain("<img ");
		fireEvent.click(screen.getByLabelText("Turn images into img tags"));
		expect(output().value).toBe("<p>a cat</p>");
	});

	it("never lets a pasted script tag through", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "<script>alert(1)</script>" } });
		expect(output().value).toContain("&lt;script&gt;");
		expect(output().value).not.toContain("<script>");
	});

	it("counts the words and headings it can see", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "# One\n\n## Two\n\nthree four" } });
		expect(screen.getByText("Words").parentElement?.textContent).toContain("4");
		expect(screen.getByText("Headings").parentElement?.textContent).toContain("2");
	});

	it("asks for something to convert when the box is empty", () => {
		render(<MarkdownToHtmlTool />);
		fireEvent.change(input(), { target: { value: "   " } });
		expect(output().value).toBe("");
		expect(screen.queryByRole("link", { name: /Download/u })).toBeNull();
	});
});
