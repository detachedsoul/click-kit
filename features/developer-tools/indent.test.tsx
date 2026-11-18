import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { convertIndentation, detectIndentation } from "@/features/developer-tools/indent-utils";
import { IndentTool } from "@/features/developer-tools/indent-tool";

afterEach(cleanup);

const options = { from: "auto" as const, to: 4 as const, trimTrailing: true, blankLines: false };

describe("indentation converter", () => {
	it("detects tabs and spaces", () => {
		expect(detectIndentation("a\n\tb\n\tc").unit).toBe("tab");
		expect(detectIndentation("a\n    b\n    c").unit).toBe(4);
		expect(detectIndentation("a\n  b").unit).toBe(2);
		expect(detectIndentation("a\nb").basis).toContain("No indented lines");
	});

	it("converts tabs to spaces", () => {
		const report = convertIndentation("if (a) {\n\treturn 1;\n\t\t// nested\n}", options);
		expect(report.output).toBe("if (a) {\n    return 1;\n        // nested\n}");
		expect(report.changedLines).toBe(2);
		expect(report.tabbedLines).toBe(2);
	});

	it("converts spaces to tabs", () => {
		const report = convertIndentation("if (a) {\n    return 1;\n}", { ...options, from: 4, to: "tab" });
		expect(report.output).toBe("if (a) {\n\treturn 1;\n}");
	});

	it("normalises mixed indentation and trims whitespace", () => {
		const report = convertIndentation("a\n \tb\n\t  c\n   \nd   ", { ...options, from: 2, to: 4 });
		expect(report.mixedLines).toBe(2);
		expect(report.output).toBe("a\n  b\n    c\n\nd");
		const kept = convertIndentation("a\n  \nb", { ...options, blankLines: true });
		expect(kept.output).toBe("a\n  \nb");
	});

	it("rejects empty input", () => {
		expect(() => convertIndentation("  \n ", options)).toThrow(/Paste text to re-indent/u);
	});

	it("renders the converted result", async () => {
		const user = userEvent.setup();
		render(<IndentTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('\n  if (!config) {');
		expect(screen.getByText(/of \d+ indented lines use tabs/u)).toBeTruthy();
		await user.selectOptions(screen.getByLabelText("Convert to"), "4");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('\n    if (!config) {');
		fireEvent.change(screen.getByLabelText("Text to re-indent"), { target: { value: "   " } });
		expect(screen.getByText(/Paste text to re-indent/u)).toBeTruthy();
	});
});
