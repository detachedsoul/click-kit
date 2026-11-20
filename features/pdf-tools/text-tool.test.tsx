import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfTextTool } from "@/features/pdf-tools/text-tool";

const extractPdfText = vi.fn();

vi.mock("@/features/pdf-tools/pdf-render", () => ({ extractPdfText: (...args: Parameters<typeof extractPdfText>) => extractPdfText(...args) }));

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	extractPdfText.mockReset();
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:text/${next}`, blob);
			return `blob:text/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages = 3) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 300, size: 12, font });
	return new File([new Uint8Array(await doc.save())], "minutes.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to read"), await makePdf());
	await screen.findByRole("button", { name: "Read the text" });
};

describe("pdf text extractor", () => {
	it("reads every page and shows the words", async () => {
		extractPdfText.mockResolvedValue([
			{ page: 1, text: "first page words" },
			{ page: 2, text: "second page words" },
		]);
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		const output = (await screen.findByLabelText("Text found")) as HTMLTextAreaElement;
		expect(output.value).toContain("— page 1 —");
		expect(output.value).toContain("second page words");
		expect(screen.getByText("Characters").parentElement?.textContent).not.toContain("—");
	});

	it("reads only the pages asked for", async () => {
		extractPdfText.mockResolvedValue([{ page: 2, text: "just this" }]);
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.type(screen.getByLabelText("Pages to read"), "2");
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		expect(extractPdfText).toHaveBeenCalledWith(expect.any(Uint8Array), [2]);
	});

	it("drops the page markers when the box is unticked", async () => {
		extractPdfText.mockResolvedValue([{ page: 1, text: "plain words" }]);
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		await screen.findByLabelText("Text found");
		await user.click(screen.getByRole("checkbox"));
		expect((screen.getByLabelText("Text found") as HTMLTextAreaElement).value).toBe("plain words");
	});

	it("offers a text file and a copy button", async () => {
		extractPdfText.mockResolvedValue([{ page: 1, text: "hello there" }]);
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		const link = await screen.findByRole("link", { name: /Download minutes\.txt$/u });
		expect(link).toHaveProperty("download", "minutes.txt");
		await user.click(screen.getByRole("button", { name: "Copy all" }));
		expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
	});

	it("explains a scan with no text layer", async () => {
		extractPdfText.mockResolvedValue([{ page: 1, text: "" }]);
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/no text layer/u);
	});

	it("refuses a range past the end", async () => {
		const user = userEvent.setup();
		render(<PdfTextTool />);
		await load(user);
		await user.type(screen.getByLabelText("Pages to read"), "9");
		await user.click(screen.getByRole("button", { name: "Read the text" }));
		expect(extractPdfText).not.toHaveBeenCalled();
		expect(await screen.findByRole("alert")).toHaveProperty("textContent", "This PDF has 3 pages, so page 9 does not exist.");
	});
});
