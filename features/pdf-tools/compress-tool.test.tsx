import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfCompressTool } from "@/features/pdf-tools/compress-tool";

/** A real 1x1 JPEG, because pdf-lib parses the file it embeds. */
const JPEG = new Blob([Uint8Array.from(atob(`/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==`), (char) => char.charCodeAt(0))], { type: "image/jpeg" });

const renderPageImages = vi.fn(async (_bytes: Uint8Array, pages: number[]) => pages.map((page) => ({ page, blob: JPEG })));

vi.mock("@/features/pdf-tools/pdf-render", () => ({ renderPageImages: (...args: Parameters<typeof renderPageImages>) => renderPageImages(...args) }));

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	renderPageImages.mockClear();
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
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages: number, name = "thesis.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) {
		doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 300, size: 12, font });
	}
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, pages = 2) => {
	await user.upload(screen.getByLabelText("PDF to make smaller"), await makePdf(pages));
	await screen.findByRole("button", { name: "Make it smaller" });
};

const download = async () => {
	const link = await screen.findByRole("link", { name: /Download .*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf compressor", () => {
	it("keeps every page and its text in the sharp mode", async () => {
		const user = userEvent.setup();
		render(<PdfCompressTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Make it smaller" }));
		const { link, doc } = await download();
		expect(link).toHaveProperty("download", "thesis-smaller.pdf");
		expect(doc.getPageCount()).toBe(2);
		expect(renderPageImages).not.toHaveBeenCalled();
	});

	it("redraws the pages in scanned mode", async () => {
		const user = userEvent.setup();
		render(<PdfCompressTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Shrink scanned pages" }));
		await user.selectOptions(screen.getByLabelText("Resolution"), "96");
		await user.click(screen.getByRole("button", { name: "Make it smaller" }));
		const { link, doc } = await download();
		expect(link).toHaveProperty("download", "thesis-scanned.pdf");
		expect(doc.getPageCount()).toBe(2);
		expect(renderPageImages).toHaveBeenCalledWith(expect.any(Uint8Array), [1, 2], expect.objectContaining({ scale: 96 / 72, type: "image/jpeg" }));
	});

	it("explains the trade-off only in scanned mode", async () => {
		const user = userEvent.setup();
		render(<PdfCompressTool />);
		await load(user);
		expect(screen.getByText(/text stays selectable/u)).toBeTruthy();
		expect(screen.queryByLabelText("Resolution")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Shrink scanned pages" }));
		expect(screen.getByLabelText("Resolution")).toBeTruthy();
		expect(screen.getByText(/text stops being selectable/u)).toBeTruthy();
	});

	it("warns when the copy ends up no smaller", async () => {
		const user = userEvent.setup();
		render(<PdfCompressTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Make it smaller" }));
		await download();
		const note = screen.getByText(/Keep the original/u);
		expect(note.textContent).toContain("Keep the original");
	});
});
