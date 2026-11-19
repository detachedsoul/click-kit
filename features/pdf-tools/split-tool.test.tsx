import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfSplitTool } from "@/features/pdf-tools/split-tool";

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

const makePdf = async (pages: number, name = "report.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) {
		doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 300, size: 12, font });
	}
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file: File) => {
	await user.upload(screen.getByLabelText("PDF to split"), file);
	await screen.findByRole("button", { name: "Split PDF" });
};

const download = async (label: RegExp) => {
	const link = await screen.findByRole("link", { name: label });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, bytes: new Uint8Array(await blob.arrayBuffer()) };
};

describe("pdf splitter", () => {
	it("waits for a file before offering a plan", () => {
		render(<PdfSplitTool />);
		expect(screen.queryByRole("button", { name: "Split PDF" })).toBeNull();
	});

	it("splits a three-page pdf into the ranges given", async () => {
		const user = userEvent.setup();
		render(<PdfSplitTool />);
		await load(user, await makePdf(3));
		await user.clear(screen.getByLabelText("Ranges, one file each"));
		await user.type(screen.getByLabelText("Ranges, one file each"), "1; 2-3");
		await user.click(screen.getByRole("button", { name: "Split PDF" }));
		const { link, bytes } = await download(/Download report-split\.zip/u);
		expect(link).toHaveProperty("download", "report-split.zip");
		expect(bytes.length).toBeGreaterThan(300);
	});

	it("gives one file per page after switching mode", async () => {
		const user = userEvent.setup();
		render(<PdfSplitTool />);
		await load(user, await makePdf(3));
		await user.click(screen.getByRole("button", { name: "One file per page" }));
		expect(screen.getByText("3 files to download.")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Split PDF" }));
		const { bytes } = await download(/Download report-split\.zip/u);
		expect(bytes.length).toBeGreaterThan(300);
	});

	it("splits every two pages with the chunk control", async () => {
		const user = userEvent.setup();
		render(<PdfSplitTool />);
		await load(user, await makePdf(5));
		await user.click(screen.getByRole("button", { name: "Every N pages" }));
		const size = screen.getByLabelText("Pages per file");
		await user.clear(size);
		await user.type(size, "2");
		expect(screen.getByText("3 files to download.")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Split PDF" }));
		const { bytes } = await download(/Download report-split\.zip/u);
		expect(bytes.length).toBeGreaterThan(300);
	});

	it("downloads a single pdf directly when there is one range", async () => {
		const user = userEvent.setup();
		render(<PdfSplitTool />);
		await load(user, await makePdf(3));
		await user.clear(screen.getByLabelText("Ranges, one file each"));
		await user.type(screen.getByLabelText("Ranges, one file each"), "2-3");
		await user.click(screen.getByRole("button", { name: "Split PDF" }));
		const { link, bytes } = await download(/Download report-part-1\.pdf/u);
		expect(link).toHaveProperty("download", "report-part-1.pdf");
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(2);
	});

	it("explains a range that runs past the end", async () => {
		const user = userEvent.setup();
		render(<PdfSplitTool />);
		await load(user, await makePdf(2));
		await user.clear(screen.getByLabelText("Ranges, one file each"));
		await user.type(screen.getByLabelText("Ranges, one file each"), "1-9");
		expect(screen.getByRole("alert").textContent).toBe("This PDF has 2 pages, so page 9 does not exist.");
		expect(screen.getByRole("button", { name: "Split PDF" })).toHaveProperty("disabled", true);
	});

	it("rejects a file that is not a pdf", async () => {
		render(<PdfSplitTool />);
		const input = screen.getByLabelText("PDF to split");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "notes.txt", { type: "text/plain" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toBe("Choose a PDF file.");
		expect(screen.queryByRole("button", { name: "Split PDF" })).toBeNull();
	});
});
