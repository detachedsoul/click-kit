import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocxPdfTool } from "@/features/converter-tools/docx-pdf-tool";
import { writeZip } from "@/features/converter-tools/zip-write";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:docx/${next}`, blob);
			return `blob:docx/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	cleanup();
});

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const docx = (body: string) => {
	const bytes = writeZip([
		{
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
			name: "word/document.xml",
		},
	]);
	return new File([bytes.slice().buffer], "report.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
};

const para = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

const uploaded = async (user: ReturnType<typeof userEvent.setup>, file: File) => {
	await user.upload(screen.getByLabelText("Word document (.docx)"), file);
};

const download = async (name: string) => {
	const link = await screen.findByRole("link", { name: `Download ${name}` });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return new Uint8Array(await blob.arrayBuffer());
};

describe("Word to PDF tool", () => {
	it("turns a .docx into a PDF you can download", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await uploaded(user, docx(para("Quarterly report") + para("The numbers are in.")));

		expect(await screen.findByText("Pages")).toBeTruthy();
		expect(screen.getByText("Words").parentElement?.textContent).toContain("6");
		const bytes = await download("report.pdf");
		const pdf = await PDFDocument.load(bytes);
		expect(pdf.getPageCount()).toBe(1);
		expect(Math.round(pdf.getPage(0).getSize().width)).toBe(595);
	});

	it("re-runs the conversion when the paper changes", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await uploaded(user, docx(para("Pocket sized")));
		await download("report.pdf");

		await user.click(screen.getByRole("button", { name: "Letter" }));
		const bytes = await download("report.pdf");
		const pdf = await PDFDocument.load(bytes);
		expect(Math.round(pdf.getPage(0).getSize().width)).toBe(612);
		expect(screen.getByText("Paper").parentElement?.textContent).toContain("Letter");
	});

	it("explains that only .docx files work", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		// A .docx name with something else inside it.
		await uploaded(user, new File(["not a zip"], "old.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
		expect(await screen.findByText(/Only \.docx files work/u)).toBeTruthy();
	});

	it("says when there is no text to set", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await uploaded(user, docx(""));
		expect(await screen.findByText(/no text to convert/u)).toBeTruthy();
		expect(screen.queryByRole("link", { name: /^Download /u })).toBeNull();
	});

	it("keeps the convert button off until a file is chosen", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		expect(screen.getByRole("button", { name: "Convert again" })).toHaveProperty("disabled", true);
		await uploaded(user, docx(para("Ready")));
		expect(await screen.findByRole("link", { name: "Download report.pdf" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Convert again" })).toHaveProperty("disabled", false);
	});

	it("clears the result without losing the file", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await uploaded(user, docx(para("Ready")));
		await screen.findByRole("link", { name: "Download report.pdf" });
		await user.click(screen.getByRole("button", { name: "Clear" }));
		expect(screen.queryByRole("link", { name: "Download report.pdf" })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Convert again" }));
		expect(await screen.findByRole("link", { name: "Download report.pdf" })).toBeTruthy();
	});
});
