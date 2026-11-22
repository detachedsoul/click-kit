import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfMergeTool } from "@/features/pdf-tools/merge-tool";

vi.mock("@/features/pdf-tools/pdf-render", () => ({
	renderPageThumbnail: vi.fn(async (_bytes: Uint8Array, page: number) => `data:image/jpeg;base64,merged-page-${page}`),
}));

/** jsdom has no blob URLs and cannot fetch them, so keep the bytes the tool produced. */
const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:pdf/${next}`, blob);
			return `blob:pdf/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			const blob = objectUrls.get(url);
			if (!blob) throw new Error(`unknown blob url ${url}`);
			return { ok: true, arrayBuffer: () => blob.arrayBuffer() };
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

/** A real one- or two-page PDF, with a distinctive page size so order is checkable. */
const makePdf = async (pages: number, name: string, size: [number, number] = [300, 400]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) {
		const page = doc.addPage(size);
		page.drawText(`${name} page ${index + 1}`, { x: 20, y: 300, size: 12, font });
	}
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const upload = async (user: ReturnType<typeof userEvent.setup>, files: File[]) => {
	await user.upload(screen.getByLabelText("PDFs to merge"), files);
};

describe("pdf merger", () => {
	it("starts empty and disabled", () => {
		render(<PdfMergeTool />);
		expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", true);
		expect(screen.queryByText("Pages in total")).toBeNull();
	});

	it("lists the files it will join, with page counts", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(2, "two.pdf")]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		expect(document.body.textContent).toContain("1 page");
		expect(document.body.textContent).toContain("2 pages");
		expect(document.body.textContent).toContain("Pages in total3");
	});

	it("adds separately chosen PDFs instead of replacing the earlier selection", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "first.pdf")]);
		expect(await screen.findByText("first.pdf")).toBeTruthy();
		await upload(user, [await makePdf(1, "second.pdf")]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		expect(screen.getByText("first.pdf")).toBeTruthy();
		expect(screen.getByText("second.pdf")).toBeTruthy();
		expect(document.body.textContent).toContain("Files2");
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		const link = await screen.findByRole("link", { name: /Download first-merged\.pdf/u });
		const response = await fetch(link.getAttribute("href") ?? "");
		const merged = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
		expect(merged.getPageCount()).toBe(2);
	});

	it("merges in list order and downloads a real PDF", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(2, "two.pdf", [400, 300])]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		const link = await screen.findByRole("link", { name: "Download one-merged.pdf" });
		expect(link).toHaveProperty("download", "one-merged.pdf");
		const response = await fetch(link.getAttribute("href") ?? "");
		const merged = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
		expect(merged.getPageCount()).toBe(3);
		const sizes = merged.getPages().map((page) => [Math.round(page.getWidth()), Math.round(page.getHeight())]);
		expect(sizes).toEqual([[300, 400], [400, 300], [400, 300]]);
		// The text layer came across with its font resources.
		expect(merged.getPages()[0].node.Resources()?.toString()).toContain("Font");
	});

	it("reorders before merging", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(1, "two.pdf", [400, 300])]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Move two.pdf up" }));
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		const link = await screen.findByRole("link", { name: /Download .*merged\.pdf/u });
		const response = await fetch(link.getAttribute("href") ?? "");
		const merged = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
		expect(Math.round(merged.getPages()[0].getWidth())).toBe(400);
		expect(screen.getByRole("button", { name: "Move two.pdf up" })).toHaveProperty("disabled", true);
	});

	it("drops a file from the batch", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(1, "two.pdf")]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Remove two.pdf" }));
		expect(screen.queryByText("two.pdf")).toBeNull();
	});

	it("previews the first pages of the merged file, in order", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(2, "two.pdf", [400, 300])]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		expect(await screen.findByAltText("Merged page 1")).toHaveProperty("src", "data:image/jpeg;base64,merged-page-1");
		expect(await screen.findByAltText("Merged page 3")).toBeTruthy();
		expect(screen.queryByAltText("Merged page 4")).toBeNull();
	});

	it("saves under a name you choose", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(1, "two.pdf")]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		await screen.findByRole("link", { name: "Download one-merged.pdf" });
		await user.type(screen.getByLabelText("Name for the file"), "Annual report / 2026");
		expect(screen.getByText("Saved as Annual report - 2026.pdf")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Download Annual report - 2026.pdf" })).toBeTruthy();
	});

	it("falls back to the default name when the box is cleared", async () => {
		const user = userEvent.setup();
		render(<PdfMergeTool />);
		await upload(user, [await makePdf(1, "one.pdf"), await makePdf(1, "two.pdf")]);
		await waitFor(() => expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", false));
		await user.click(screen.getByRole("button", { name: "Merge PDFs" }));
		await screen.findByRole("link", { name: "Download one-merged.pdf" });
		fireEvent.change(screen.getByLabelText("Name for the file"), { target: { value: "   " } });
		expect(screen.getByRole("link", { name: "Download one-merged.pdf" })).toBeTruthy();
	});

	it("warns when a file is not a PDF", async () => {
		render(<PdfMergeTool />);
		const input = screen.getByLabelText("PDFs to merge");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "notes.txt", { type: "text/plain" })] });
		fireEvent.change(input);
		expect(await screen.findByRole("alert")).toHaveProperty("textContent", "notes.txt: Choose a PDF file.");
		expect(screen.getByRole("button", { name: "Merge PDFs" })).toHaveProperty("disabled", true);
	});
});
