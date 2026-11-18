import { webcrypto } from "node:crypto";
import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CsvJsonTool,
	FileHashTool,
	GitignoreGeneratorTool,
	JsonPathTool,
	JsonSchemaValidatorTool,
} from "@/features/developer-tools/data-tools-components";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("next Developer utilities", () => {
	it("converts CSV reactively, supports delimiters, and reports malformed rows", async () => {
		const user = userEvent.setup();
		render(<CsvJsonTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"name": "Ari"');
		await user.click(screen.getByRole("button", { name: "JSON to CSV" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"likes commas, too"');
		await user.click(screen.getByRole("button", { name: "CSV to JSON" }));
		fireEvent.change(screen.getByLabelText("CSV input"), { target: { value: "a,b\n1" } });
		expect(screen.getByRole("alert").textContent).toContain("expected 2");
	});

	it("keeps typed input when switching conversion direction", async () => {
		const user = userEvent.setup();
		render(<CsvJsonTool />);
		fireEvent.change(screen.getByLabelText("CSV input"), { target: { value: "id,name\n1,Ada" } });
		await user.click(screen.getByRole("button", { name: "JSON to CSV" }));
		expect((screen.getByLabelText("JSON input") as HTMLTextAreaElement).value).toBe("id,name\n1,Ada");
	});

	it("updates JSONPath matches when the query changes", () => {
		render(<JsonPathTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"Small Worlds"');
		fireEvent.change(screen.getByLabelText("JSONPath query"), { target: { value: "$.store.book[*].price" } });
		const output = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output).toContain("8.95");
		expect(output).toContain("12.5");
	});

	it("validates data against Draft 2020-12 schema and shows validation feedback", () => {
		render(<JsonSchemaValidatorTool />);
		expect(screen.getByText(/schema issue/u).textContent).toContain("1 schema issue found.");
		fireEvent.change(screen.getByLabelText("JSON data"), {
			target: { value: '{"id":1,"email":"ada@example.com"}' },
		});
		expect(screen.getByText("JSON is valid against this schema.")).toBeTruthy();
	});

	it("hashes selected files locally and reports the digest", async () => {
		vi.stubGlobal("crypto", webcrypto);
		const user = userEvent.setup();
		render(<FileHashTool />);
		fireEvent.change(screen.getByLabelText("Choose a file (up to 64 MiB)"), {
			target: { files: [new File(["abc"], "hello.txt", { type: "text/plain" })] },
		});
		await user.click(screen.getByRole("button", { name: "Calculate file hash" }));
		expect((await screen.findByLabelText("Result") as HTMLTextAreaElement).value).toContain(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("generates a downloadable gitignore and updates selected templates", async () => {
		const user = userEvent.setup();
		render(<GitignoreGeneratorTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("node_modules/");
		expect(screen.getByRole("link", { name: "Download .gitignore" }).getAttribute("download")).toBe(".gitignore");
		await user.click(screen.getByLabelText("Python"));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("__pycache__/");
	});
});
