import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfSplitHalvesTool } from "@/features/pdf-tools/split-halves-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:halves/${next}`, blob);
			return `blob:halves/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages = 2, name = "spread.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage([400, 600]).drawText(`page ${index + 1}`, { x: 20, y: 560, size: 12, font });
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to split in half"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Split into halves" });
};

const split = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Split into halves" }));
	const link = await screen.findByRole("link", { name: /Download spread-halves\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())), link };
};

const boxes = (doc: PDFDocument) =>
	doc.getPages().map((page) => {
		const box = page.getCropBox();
		return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)];
	});

describe("pdf split halves tool", () => {
	it("explains itself before a document arrives", () => {
		render(<PdfSplitHalvesTool />);
		expect(screen.getByText(/never redrawn, so text stays selectable/u)).toBeTruthy();
	});

	it("says how big each half will be", async () => {
		const user = userEvent.setup();
		render(<PdfSplitHalvesTool />);
		await load(user);
		expect(screen.getByText("Pages out").parentElement?.textContent).toContain("4");
		expect(screen.getByText("Each half").parentElement?.textContent).toContain("400 × 300 pt");
		expect(screen.getByText(/full page size is 400 × 600 pt/u)).toBeTruthy();
	});

	it("follows the cut you choose", async () => {
		const user = userEvent.setup();
		render(<PdfSplitHalvesTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Cut each page"), { target: { value: "vertical" } });
		expect(screen.getByText("Each half").parentElement?.textContent).toContain("200 × 600 pt");
		const { doc } = await split(user);
		expect(doc.getPageCount()).toBe(4);
		expect(boxes(doc)).toEqual([
			[0, 0, 200, 600],
			[200, 0, 200, 600],
			[0, 0, 200, 600],
			[200, 0, 200, 600],
		]);
	});

	it("keeps each page's halves together by default", async () => {
		const user = userEvent.setup();
		render(<PdfSplitHalvesTool />);
		await load(user);
		const { doc } = await split(user);
		expect(boxes(doc)).toEqual([
			[0, 300, 400, 300],
			[0, 0, 400, 300],
			[0, 300, 400, 300],
			[0, 0, 400, 300],
		]);
		expect(screen.getByText(/4 pages, each 400 × 300 pt/u)).toBeTruthy();
	});

	it("puts all the first halves first when asked", async () => {
		const user = userEvent.setup();
		render(<PdfSplitHalvesTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Page order"), { target: { value: "grouped" } });
		expect(screen.getByText(/first run holds one half of every page/u)).toBeTruthy();
		const { doc } = await split(user);
		expect(boxes(doc)).toEqual([
			[0, 300, 400, 300],
			[0, 300, 400, 300],
			[0, 0, 400, 300],
			[0, 0, 400, 300],
		]);
	});

	it("reports a mark that was left on the other half", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		const font = await doc.embedFont(StandardFonts.Helvetica);
		page.drawText("top", { x: 20, y: 560, size: 12, font });
		page.node.addAnnot(doc.context.register(doc.context.obj({ F: 4, Rect: [40, 520, 140, 540], Subtype: "Highlight", Type: "Annot" })));
		const file = new File([new Uint8Array(await doc.save())], "spread.pdf", { type: "application/pdf" });
		const user = userEvent.setup();
		render(<PdfSplitHalvesTool />);
		await load(user, file);
		await user.click(screen.getByRole("button", { name: "Split into halves" }));
		expect(await screen.findByText(/1 mark stayed on the half that was left out/u)).toBeTruthy();
	});
});
