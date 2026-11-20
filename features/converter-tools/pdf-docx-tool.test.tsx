import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfDocxTool } from "@/features/converter-tools/pdf-docx-tool";
import { readZipEntries } from "@/features/converter-tools/zip-reader";

const extractPdfText = vi.fn();

vi.mock("@/features/pdf-tools/pdf-render", () => ({ extractPdfText: (...args: Parameters<typeof extractPdfText>) => extractPdfText(...args) }));

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	extractPdfText.mockReset();
	extractPdfText.mockResolvedValue([
		{ page: 1, text: "Terms of service\nThe parties agree." },
		{ page: 2, text: "Signed at Lagos" },
	]);
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:pdfdocx/${next}`, blob);
			return `blob:pdfdocx/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	cleanup();
});

const makePdf = async (name = "minutes.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.addPage([300, 400]).drawText("hello", { x: 20, y: 300, size: 12, font });
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const download = async (name: string) => {
	const link = await screen.findByRole("link", { name: `Download ${name}` });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const entries = await readZipEntries(bytes);
	const document = entries.find((entry) => entry.name === "word/document.xml");
	return { names: entries.map((entry) => entry.name).sort(), xml: document ? new TextDecoder().decode(document.bytes) : "" };
};

describe("PDF to Word tool", () => {
	it("turns the pages into a .docx you can download", async () => {
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());

		expect(await screen.findByText("Blank pages")).toBeTruthy();
		const { names, xml } = await download("minutes.docx");
		expect(names).toContain("word/document.xml");
		expect(names).toContain("[Content_Types].xml");
		expect(xml).toContain("Terms of service");
		expect(xml).toContain("The parties agree.");
		expect(xml).toContain("Signed at Lagos");
		// One page break between the two pages.
		expect((xml.match(/<w:br w:type="page"\/>/gu) ?? []).length).toBe(1);
	});

	it("says how much text it carried across", async () => {
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());
		expect(await screen.findByText("Words")).toBeTruthy();
		expect(screen.getByText("Words").parentElement?.textContent).toContain("9");
		expect(screen.getByText(/2 pages written as Word paragraphs/u)).toBeTruthy();
	});

	it("warns about pages that were blank", async () => {
		extractPdfText.mockResolvedValue([
			{ page: 1, text: "Covered" },
			{ page: 2, text: "" },
		]);
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());
		expect(await screen.findByText(/pages 2 had no text/u)).toBeTruthy();
	});

	it("points at OCR when the PDF is a scan", async () => {
		extractPdfText.mockResolvedValue([
			{ page: 1, text: "  " },
			{ page: 2, text: "" },
		]);
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());
		expect(await screen.findByText(/probably a scan/u)).toBeTruthy();
		expect(screen.queryByRole("link", { name: /^Download /u })).toBeNull();
	});

	it("asks for the PDF to be unlocked first", async () => {
		extractPdfText.mockRejectedValue(new Error("No password given"));
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());
		expect(await screen.findByText(/locked. Unlock it first/u)).toBeTruthy();
	});

	it("keeps the convert button off until a file is chosen", async () => {
		const user = userEvent.setup();
		render(<PdfDocxTool />);
		expect(screen.getByRole("button", { name: "Convert again" })).toHaveProperty("disabled", true);
		await user.upload(screen.getByLabelText("PDF to convert"), await makePdf());
		await screen.findByRole("link", { name: "Download minutes.docx" });
		expect(screen.getByRole("button", { name: "Convert again" })).toHaveProperty("disabled", false);
	});
});
