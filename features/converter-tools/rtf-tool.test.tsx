import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RtfTool } from "@/features/converter-tools/rtf-tool";

const SAMPLE = String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Georgia;}}
\fs24 {\b Meeting notes}\par
Everyone agreed on {\i three} things.\par
}`;

const upload = (file: File) => {
	const input = document.querySelector('input[type="file"]') as HTMLInputElement;
	Object.defineProperty(input, "files", { configurable: true, value: [file] });
	fireEvent.change(input);
};

const output = () => screen.getByLabelText("Result") as HTMLTextAreaElement;

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("rtf tool", () => {
	it("waits for a file, with a sample on offer", () => {
		render(<RtfTool />);
		expect(screen.getByRole("button", { name: "Try a sample document" })).toBeTruthy();
		expect(screen.queryByLabelText("Result")).toBeNull();
	});

	it("reads an uploaded file as markdown", async () => {
		render(<RtfTool />);
		upload(new File([SAMPLE], "notes.rtf", { type: "application/rtf" }));
		await waitFor(() => expect(output().value).toContain("**Meeting notes**"));
		expect(output().value).toContain("Everyone agreed on *three* things.");
		expect(output().value).not.toContain("Georgia");
		expect(screen.getByRole("link", { name: "Download notes.md" })).toBeTruthy();
	});

	it("switches to plain text without rereading the file", async () => {
		render(<RtfTool />);
		upload(new File([SAMPLE], "notes.rtf", { type: "application/rtf" }));
		await waitFor(() => expect(output().value).toContain("**Meeting notes**"));
		fireEvent.click(screen.getByRole("button", { name: "Plain text" }));
		expect(output().value).toContain("Meeting notes");
		expect(output().value).not.toContain("**");
		expect(screen.getByRole("link", { name: "Download notes.txt" })).toBeTruthy();
	});

	it("converts the sample", () => {
		render(<RtfTool />);
		fireEvent.click(screen.getByRole("button", { name: "Try a sample document" }));
		expect(output().value).toContain("Meeting notes");
		expect(output().value).toContain("One owner per action.");
		expect(screen.getByText("Words").parentElement?.textContent).toMatch(/Words\d+/u);
		expect(screen.getByText("Paragraphs").parentElement?.textContent).toMatch(/Paragraphs\d+/u);
	});

	it("says plainly when a file is not RTF", async () => {
		render(<RtfTool />);
		upload(new File(["just some words"], "notes.rtf", { type: "application/rtf" }));
		await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("does not start with"));
		expect(screen.queryByLabelText("Result")).toBeNull();
	});

	it("refuses a file that is too large", async () => {
		render(<RtfTool />);
		const huge = new File(["{\\rtf1 x}"], "big.rtf", { type: "application/rtf" });
		Object.defineProperty(huge, "size", { configurable: true, value: 6 * 1024 * 1024 });
		upload(huge);
		await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("under 5 MB"));
	});

	it("clears the reading when asked", async () => {
		render(<RtfTool />);
		fireEvent.click(screen.getByRole("button", { name: "Try a sample document" }));
		expect(screen.getByLabelText("Result")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(screen.queryByLabelText("Result")).toBeNull();
	});
});
