import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Base64Tool, JsonFormatterTool, JsonTypeScriptTool, RegexTesterTool, TimestampConverterTool, UuidGeneratorTool } from "@/features/developer-tools/developer-tool-components";

afterEach(() => cleanup());

describe("developer tools", () => {
	it("formats JSON and announces invalid JSON", async () => {
		const user = userEvent.setup();
		render(<JsonFormatterTool />);
		await user.click(screen.getByRole("button", { name: "Format with indentation" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("\n  \"name\": \"ClickKit\"");
		fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: "{bad" } });
		await user.click(screen.getByRole("button", { name: "Minify" }));
		expect(screen.getByRole("alert").textContent).toContain("Invalid JSON");
	});

	it("generates a TypeScript type from a JSON example", async () => {
		const user = userEvent.setup();
		render(<JsonTypeScriptTool />);
		await user.click(screen.getByRole("button", { name: "Generate TypeScript" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("export type Root = {");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("roles: Array<string>");
	});

	it("encodes and decodes Base64 Unicode", async () => {
		const user = userEvent.setup();
		render(<Base64Tool />);
		fireEvent.change(screen.getByLabelText("Text to encode"), { target: { value: "Hello 🙂" } });
		await user.click(screen.getByRole("button", { name: "Encode text" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("SGVsbG8g8J+Zgg==");
		await user.click(screen.getByRole("button", { name: "Decode Base64" }));
		fireEvent.change(screen.getByLabelText("Base64 to decode"), { target: { value: "SGVsbG8g8J+Zgg==" } });
		await user.click(screen.getByRole("button", { name: "Decode Base64" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("Hello 🙂");
	});

	it("generates a requested number of UUIDs", async () => {
		const user = userEvent.setup();
		render(<UuidGeneratorTool />);
		fireEvent.change(screen.getByLabelText("How many UUIDs?"), { target: { value: "2" } });
		await user.click(screen.getByRole("button", { name: "Generate UUIDs" }));
		const result = screen.getByRole("list").textContent ?? "";
		expect(result.match(/[\da-f]{8}-[\da-f-]{27}/giu)).toHaveLength(2);
	});

	it("shows matches, capture groups, and invalid regex errors", () => {
		render(<RegexTesterTool />);
		expect(screen.getByRole("region", { name: "Regular expression matches" }).textContent).toContain("Group 1: hello");
		fireEvent.change(screen.getByLabelText("Regular expression"), { target: { value: "[" } });
		expect(screen.getByRole("alert").textContent).toContain("Invalid regular expression");
	});

	it("converts a timestamp into a date and converts ISO date-time back", async () => {
		const user = userEvent.setup();
		render(<TimestampConverterTool />);
		await user.click(screen.getByRole("button", { name: "Convert" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("2025-01-01T00:00:00.000Z");
		await user.click(screen.getByRole("button", { name: "Date to timestamp" }));
		await user.click(screen.getByRole("button", { name: "Convert" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("1735689600");
	});
});
