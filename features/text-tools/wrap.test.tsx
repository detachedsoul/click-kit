import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { unwrapParagraph, wrapText } from "@/features/text-tools/wrap-utils";
import { WrapTool } from "@/features/text-tools/wrap-tool";

afterEach(cleanup);

describe("text wrap and unwrap", () => {
	it("wraps at the requested width without splitting words", () => {
		const report = wrapText("The quick brown fox jumps over the lazy dog", { width: 15 });
		expect(report.text.split("\n")).toEqual(["The quick brown", "fox jumps over", "the lazy dog"]);
		expect(report.longestLine).toBeLessThanOrEqual(15);
		expect(report.lines).toBe(3);
	});

	it("breaks long words only when asked", () => {
		const word = "supercalifragilisticexpialidocious";
		expect(wrapText(`a ${word} b`, { width: 10 }).text.split("\n")[1]).toBe(word);
		const broken = wrapText(`a ${word} b`, { width: 10, breakLongWords: true });
		expect(broken.text.split("\n").every((line) => line.length <= 10)).toBe(true);
	});

	it("keeps paragraphs and unwraps them", () => {
		const source = "First line\nsecond line\n\nThird paragraph\nwraps here";
		const unwrapped = wrapText(source, { mode: "unwrap" });
		expect(unwrapped.text).toBe("First line second line\n\nThird paragraph wraps here");
		expect(unwrapped.paragraphs).toBe(2);
		expect(wrapText(source, { mode: "unwrap", keepBlankLines: false }).text).toBe("First line second line\nThird paragraph wraps here");
		expect(unwrapParagraph("docu-\nment it")).toBe("document it");
	});

	it("handles CRLF and collapses stray whitespace", () => {
		const report = wrapText("one   two\r\nthree\r\n\r\nfour", { width: 40 });
		expect(report.text).toBe("one two three\n\nfour");
	});

	it("validates input and width", () => {
		expect(() => wrapText("   ")).toThrow(/Paste some text to wrap/u);
		expect(() => wrapText("hello", { width: 2 })).toThrow(/between 3 and 200/u);
		expect(() => wrapText("hello", { width: 500 })).toThrow(/between 3 and 200/u);
	});

	it("renders wrapped output and switches mode", async () => {
		const user = userEvent.setup();
		render(<WrapTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output().split("\n").every((line) => line.length <= 72)).toBe(true);
		await user.selectOptions(screen.getByLabelText("Action"), "unwrap");
		expect(output().split("\n\n")).toHaveLength(2);
		fireEvent.change(screen.getByLabelText("Column width"), { target: { value: "1" } });
		expect(screen.getByRole("alert").textContent).toContain("between 3 and 200");
	});
});
