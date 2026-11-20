import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownTableTool } from "@/features/converter-tools/markdown-table-tool";

beforeEach(() => {
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const MD = `| Item | Qty |
| :--- | --: |
| Tea | 2 |`;

const HTML = "<table><tr><th>Item</th><th>Qty</th></tr><tr><td>Tea</td><td>2</td></tr></table>";

const paste = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
	await user.clear(screen.getByLabelText("Table, in Markdown or HTML"));
	await user.type(screen.getByLabelText("Table, in Markdown or HTML"), text);
	await user.click(screen.getByRole("button", { name: "Convert the table" }));
};

describe("markdown table tool", () => {
	it("explains the two directions before anything is pasted", () => {
		render(<MarkdownTableTool />);
		expect(screen.getByText(/Paste either one and it comes out the other way/u)).toBeTruthy();
		expect(screen.queryByLabelText("Result")).toBeNull();
	});

	it("turns a Markdown table into HTML", async () => {
		const user = userEvent.setup();
		render(<MarkdownTableTool />);
		await paste(user, MD);
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain("<thead>");
		expect(output).toContain('<td style="text-align: right">2</td>');
		expect(screen.getByText("Found as").parentElement?.textContent).toContain("Markdown");
		expect(screen.getByRole("link", { name: "Download table.html" })).toBeTruthy();
	});

	it("turns an HTML table into Markdown", async () => {
		const user = userEvent.setup();
		render(<MarkdownTableTool />);
		await paste(user, HTML);
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain("| Item | Qty |");
		expect(output).toContain("| Tea  | 2   |");
		expect(screen.getByRole("link", { name: "Download table.md" })).toBeTruthy();
		expect(screen.getByText(/styling, spans, and colspan widths did not/u)).toBeTruthy();
	});

	it("counts the rows and columns it found", async () => {
		const user = userEvent.setup();
		render(<MarkdownTableTool />);
		await paste(user, MD);
		expect(screen.getByText("Rows").parentElement?.textContent).toContain("2");
		expect(screen.getByText("Columns").parentElement?.textContent).toContain("2");
		expect(screen.getByText("Written out as").parentElement?.textContent).toContain("HTML");
	});

	it("says plainly when there is no table to convert", async () => {
		const user = userEvent.setup();
		render(<MarkdownTableTool />);
		await paste(user, "just a paragraph about tables");
		expect((await screen.findByRole("alert")).textContent).toContain("No table found");
		expect(screen.queryByLabelText("Result")).toBeNull();
	});

	it("clears the old result when the paste changes", async () => {
		const user = userEvent.setup();
		render(<MarkdownTableTool />);
		await paste(user, MD);
		expect(screen.getByLabelText("Result")).toBeTruthy();
		await user.type(screen.getByLabelText("Table, in Markdown or HTML"), "!");
		expect(screen.queryByLabelText("Result")).toBeNull();
	});
});
