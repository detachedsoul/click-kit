import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfLongPageTool } from "@/features/pdf-tools/long-page-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:long/${next}`, blob);
			return `blob:long/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages = 3, name = "receipt.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 20, size: 11, font });
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to stack into one page"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Make one long page" });
};

const stack = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Make one long page" }));
	const link = await screen.findByRole("link", { name: /Download receipt-long-page\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf long page tool", () => {
	it("waits for a document", () => {
		render(<PdfLongPageTool />);
		expect(screen.getByText(/Every page is stacked top to bottom/u)).toBeTruthy();
	});

	it("makes one tall page out of three", async () => {
		const user = userEvent.setup();
		render(<PdfLongPageTool />);
		await load(user);
		const { link, doc } = await stack(user);
		expect(link).toHaveProperty("download", "receipt-long-page.pdf");
		expect(doc.getPageCount()).toBe(1);
		expect(Math.round(doc.getPage(0).getHeight())).toBe(400 * 3 + 24);
		expect(screen.getByText(/3 pages stacked into one page/u)).toBeTruthy();
	});

	it("takes the gap you set", async () => {
		const user = userEvent.setup();
		render(<PdfLongPageTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Gap between pages (pt)"), { target: { value: "0" } });
		const { doc } = await stack(user);
		expect(Math.round(doc.getPage(0).getHeight())).toBe(1200);
	});

	it("says when there is nothing to stack", async () => {
		const user = userEvent.setup();
		render(<PdfLongPageTool />);
		await load(user, await makePdf(1, "one.pdf"));
		expect(screen.getByText(/A single-page PDF has nothing to stack/u)).toBeTruthy();
		expect(screen.getByRole("button", { name: "Make one long page" })).toHaveProperty("disabled", true);
	});

	it("says how long the result will be", async () => {
		const user = userEvent.setup();
		render(<PdfLongPageTool />);
		await load(user);
		expect(screen.getByText(/The result is one page 3 pages long/u)).toBeTruthy();
	});

	it("refuses a document that would be too tall", async () => {
		const user = userEvent.setup();
		render(<PdfLongPageTool />);
		const doc = await PDFDocument.create();
		const font = await doc.embedFont(StandardFonts.Helvetica);
		for (let index = 0; index < 60; index += 1) doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 20, size: 10, font });
		await load(user, new File([new Uint8Array(await doc.save())], "tall.pdf", { type: "application/pdf" }));
		await user.click(screen.getByRole("button", { name: "Make one long page" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/limit|tall/iu);
	});
});
