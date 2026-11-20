import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HtmlTableTool } from "@/features/converter-tools/html-tables-tool";

afterEach(cleanup);

const markup = `<table><caption>March</caption>
	<tr><th>Item</th><th>Cost</th></tr>
	<tr><td>Tea</td><td>3.50</td></tr>
</table>
<table><tr><td>second</td></tr></table>`;

const paste = async (user: ReturnType<typeof userEvent.setup>, text = markup) => {
	fireEvent.change(screen.getByLabelText("Page markup"), { target: { value: text } });
	await user.click(screen.getByRole("button", { name: "Find the tables" }));
};

const result = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;

describe("html tables to csv", () => {
	it("waits for markup", () => {
		render(<HtmlTableTool />);
		expect(screen.getByText(/Paste markup with a table in it/u)).toBeTruthy();
	});

	it("writes the table out as CSV", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await paste(user);
		expect(result()).toBe("Item,Cost\nTea,3.50\n");
		expect(screen.getByText("Rows").parentElement?.textContent).toContain("2");
	});

	it("switches to a Markdown table", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await paste(user);
		await user.click(screen.getByRole("button", { name: "Markdown table" }));
		expect(result()).toContain("| Item | Cost |");
		expect(result()).toContain("| ---- | ---- |");
	});

	it("lets you pick between several tables", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await paste(user);
		const picker = screen.getByLabelText("Which table");
		await user.selectOptions(picker, "1");
		expect(result()).toBe("second\n");
	});

	it("offers the result as a download named after the caption", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await paste(user);
		expect(screen.getByRole("link", { name: "Download march.csv" })).toBeTruthy();
	});

	it("says when there is no table in the markup", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await paste(user, "<p>no tables here</p>");
		expect(screen.getByRole("alert").textContent).toContain("No table found");
	});

	it("says when there is nothing pasted at all", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		await user.click(screen.getByRole("button", { name: "Find the tables" }));
		expect(screen.getByRole("alert").textContent).toContain("Paste the page");
	});

	it("reads a saved page", async () => {
		const user = userEvent.setup();
		render(<HtmlTableTool />);
		const file = new File([markup], "spend.html", { type: "text/html" });
		await user.upload(screen.getByLabelText("…or a saved web page"), file);
		await screen.findByLabelText("Result");
		expect(result()).toContain("Tea");
		expect(screen.getByText("Read from").parentElement?.textContent).toContain("spend.html");
	});
});
