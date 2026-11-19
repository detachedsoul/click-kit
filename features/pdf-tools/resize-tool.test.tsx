import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfResizeTool } from "@/features/pdf-tools/resize-tool";

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
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

/** One portrait page and one landscape page, both with real text. */
const makePdf = async () => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.addPage([300, 400]).drawText("portrait page", { x: 20, y: 300, size: 12, font });
	doc.addPage([400, 300]).drawText("landscape page", { x: 20, y: 200, size: 12, font });
	return new File([new Uint8Array(await doc.save())], "scan.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to resize"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: /Fit every page to/u });
};

const resize = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: /Fit every page to/u }));
	const link = await screen.findByRole("link", { name: /Download scan-.*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return { link, bytes, doc: await PDFDocument.load(bytes) };
};

const sizes = (doc: PDFDocument) => doc.getPages().map((page) => [Math.round(page.getWidth()), Math.round(page.getHeight())]);

describe("pdf page resizer", () => {
	it("fits a portrait page and turns a wide one to A4", async () => {
		const user = userEvent.setup();
		render(<PdfResizeTool />);
		await load(user);
		const { link, doc } = await resize(user);
		expect(link).toHaveProperty("download", "scan-a4.pdf");
		expect(sizes(doc)).toEqual([[595, 842], [842, 595]]);
	});

	it("keeps the page content, adding only a scale and a shift", async () => {
		const user = userEvent.setup();
		render(<PdfResizeTool />);
		await load(user);
		const { doc } = await resize(user);
		// Each page still points at its own font resources: the words were never redrawn.
		expect(doc.getPageCount()).toBe(2);
		for (const page of doc.getPages()) expect(page.node.Resources()?.toString()).toContain("Font");
	});

	it("switches paper after loading", async () => {
		const user = userEvent.setup();
		render(<PdfResizeTool />);
		await load(user);
		await user.selectOptions(screen.getByLabelText("Paper size"), "letter");
		expect(screen.getAllByText("US Letter").length).toBeGreaterThan(0);
		const { link, doc } = await resize(user);
		expect(link).toHaveProperty("download", "scan-us-letter.pdf");
		expect(sizes(doc)).toEqual([[612, 792], [792, 612]]);
	});

	it("handles a page that the viewer turns", async () => {
		const user = userEvent.setup();
		const doc = await PDFDocument.create();
		const page = doc.addPage([300, 400]);
		page.setRotation(degrees(90));
		render(<PdfResizeTool />);
		await load(user, new File([new Uint8Array(await doc.save())], "scan.pdf", { type: "application/pdf" }));
		const { doc: out } = await resize(user);
		// The box is written pre-rotation, so the viewer still shows it A4-sideways.
		expect(sizes(out)).toEqual([[842, 595]]);
	});

	it("rejects a file that is not a pdf", async () => {
		render(<PdfResizeTool />);
		const input = screen.getByLabelText("PDF to resize");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["nope"], "notes.txt", { type: "text/plain" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toBe("Choose a PDF file.");
		expect(screen.queryByRole("button", { name: /Fit every page to/u })).toBeNull();
	});
});
