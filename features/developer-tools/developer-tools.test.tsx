import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Base64Tool, JsonFormatterTool, JsonTypeScriptTool, RegexTesterTool, TimestampConverterTool, UuidGeneratorTool } from "@/features/developer-tools/developer-tool-components";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

	it("offers strict and flexible TypeScript inference modes", async () => {
		const user = userEvent.setup();
		render(<JsonTypeScriptTool />);
		fireEvent.change(screen.getByLabelText("JSON example"), { target: { value: '[{"id":1},{"enabled":true}]' } });
		await user.click(screen.getByRole("button", { name: "Generate TypeScript" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("} | {");
		await user.click(screen.getByRole("button", { name: "Flexible" }));
		await user.click(screen.getByRole("button", { name: "Generate TypeScript" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("id?: number;");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("enabled?: boolean;");
	});

	it("encodes while typing and decodes immediately after switching direction", async () => {
		const user = userEvent.setup();
		render(<Base64Tool />);
		fireEvent.change(screen.getByLabelText("Text to encode"), { target: { value: "Hello 🙂" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("SGVsbG8g8J+Zgg==");
		await user.click(screen.getByRole("button", { name: "Decode" }));
		fireEvent.change(screen.getByLabelText("Base64 to decode"), { target: { value: "SGVsbG8g8J+Zgg==" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("Hello 🙂");
		await user.click(screen.getByRole("button", { name: "Encode" }));
		fireEvent.change(screen.getByLabelText("Text to encode"), { target: { value: "Hello 🙂" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("SGVsbG8g8J+Zgg==");
	});

	it("encodes an image file as a MIME-labelled data URL", async () => {
		const file = new File([new Uint8Array([0, 255, 1])], "pixel.png", { type: "image/png" });
		Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array([0, 255, 1]).buffer });
		const user = userEvent.setup();
		render(<Base64Tool />);
		await user.click(screen.getByRole("button", { name: "File / binary" }));
		fireEvent.change(screen.getByLabelText("Choose any file to encode"), { target: { files: [file] } });
		const output = await screen.findByLabelText("Result");
		expect((output as HTMLTextAreaElement).value).toBe("data:image/png;base64,AP8B");
		await user.click(screen.getByLabelText("Include data URL prefix with MIME type"));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("AP8B");
	});

	it("represents an empty file with a valid empty-payload data URL", async () => {
		const file = new File([], "empty.bin", { type: "application/octet-stream" });
		Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(0) });
		const user = userEvent.setup();
		render(<Base64Tool />);
		await user.click(screen.getByRole("button", { name: "File / binary" }));
		fireEvent.change(screen.getByLabelText("Choose any file to encode"), { target: { files: [file] } });
		expect(((await screen.findByLabelText("Result")) as HTMLTextAreaElement).value).toBe(
			"data:application/octet-stream;base64,",
		);
	});

	it("decodes a MIME-labelled data URL into a downloadable file", async () => {
		const OriginalURL = globalThis.URL;
		class URLWithBlobSupport extends OriginalURL {
			static createObjectURL = vi.fn(() => "blob:decoded-file");
			static revokeObjectURL = vi.fn();
		}
		vi.stubGlobal("URL", URLWithBlobSupport);
		const user = userEvent.setup();
		render(<Base64Tool />);
		await user.click(screen.getByRole("button", { name: "File / binary" }));
		await user.click(screen.getByRole("button", { name: "Decode" }));
		fireEvent.change(screen.getByLabelText("Base64 data or data URL"), {
			target: { value: "data:application/pdf;base64,JVBERi0xLjQ=" },
		});
		await user.click(screen.getByRole("button", { name: "Decode file" }));
		expect(await screen.findByRole("link", { name: "Download decoded-file.pdf" })).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Base64 data or data URL"), { target: { value: "JVBERi0xLjQ=" } });
		expect(screen.queryByRole("link", { name: "Download decoded-file.pdf" })).toBeNull();
		await user.selectOptions(screen.getByLabelText("MIME type for raw Base64"), "application/pdf");
		await user.click(screen.getByRole("button", { name: "Decode file" }));
		expect(await screen.findByRole("link", { name: "Download decoded-file.pdf" })).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Base64 data or data URL"), {
			target: {
				value: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/jfcAAAAASUVORK5CYII=",
			},
		});
		await user.click(screen.getByRole("button", { name: "Decode file" }));
		expect(await screen.findByRole("img", { name: "Decoded image/png preview" })).toBeTruthy();
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
