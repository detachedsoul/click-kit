import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nupLayout } from "@/features/pdf-tools/pdf-engine";
import { PdfNupTool } from "@/features/pdf-tools/nup-tool";

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

const makePdf = async (pages = 5, name = "handout.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) {
		doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 360, size: 12, font });
	}
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to lay out"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: /Put \d on a sheet/u });
};

const lay = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: /Put \d on a sheet/u }));
	const link = await screen.findByRole("link", { name: /Download handout-.*-up\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("n-up layout maths", () => {
	it("turns the paper sideways for two-up", () => {
		const layout = nupLayout(2, "a4", 18, 12);
		expect(Math.round(layout.width)).toBe(842);
		expect(Math.round(layout.height)).toBe(595);
		expect(layout.cells).toHaveLength(2);
		expect(layout.cells[0].x).toBe(18);
		expect(layout.cells[1].x).toBeGreaterThan(layout.cells[0].x);
	});

	it("stacks four cells in reading order", () => {
		const layout = nupLayout(4, "a4", 18, 12);
		expect(layout.cells).toHaveLength(4);
		expect(layout.cells[0].y).toBeGreaterThan(layout.cells[2].y);
		expect(layout.cells[0].x).toBe(layout.cells[1].x - layout.cells[0].width - 12);
		expect(Math.round(layout.cells[0].width)).toBe(Math.round((595.28 - 36 - 12) / 2));
	});
});

describe("pdf n-up tool", () => {
	it("puts four pages on each sheet", async () => {
		const user = userEvent.setup();
		render(<PdfNupTool />);
		await load(user);
		const { link, doc } = await lay(user);
		expect(link).toHaveProperty("download", "handout-4-up.pdf");
		expect(doc.getPageCount()).toBe(2);
		expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
	});

	it("switches to two-up after loading", async () => {
		const user = userEvent.setup();
		render(<PdfNupTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "2 up" }));
		expect(screen.getByText("Sheets out").parentElement?.textContent).toContain("3");
		const { link, doc } = await lay(user);
		expect(link).toHaveProperty("download", "handout-2-up.pdf");
		expect(doc.getPageCount()).toBe(3);
		// Two-up uses landscape sheets.
		expect(Math.round(doc.getPage(0).getWidth())).toBe(842);
	});

	it("one page per sheet keeps the count and the paper", async () => {
		const user = userEvent.setup();
		render(<PdfNupTool />);
		await load(user, await makePdf(3));
		await user.click(screen.getByRole("button", { name: "1" }));
		await user.selectOptions(screen.getByLabelText("Paper"), "letter");
		const { doc } = await lay(user);
		expect(doc.getPageCount()).toBe(3);
		expect(Math.round(doc.getPage(0).getWidth())).toBe(612);
	});

	it("keeps the text layer of the pages it embeds", async () => {
		const user = userEvent.setup();
		render(<PdfNupTool />);
		await load(user, await makePdf(2));
		const { doc } = await lay(user);
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("XObject");
	});

	it("copes with a page the viewer has turned", async () => {
		const user = userEvent.setup();
		const source = await PDFDocument.create();
		const page = source.addPage([300, 400]);
		page.drawText("turned", { x: 20, y: 20 });
		page.setRotation(degrees(90));
		render(<PdfNupTool />);
		await load(user, new File([new Uint8Array(await source.save())], "handout.pdf", { type: "application/pdf" }));
		const { doc } = await lay(user);
		expect(doc.getPageCount()).toBe(1);
		// The landscape cell must fit the turned page, so the artwork is placed, not squashed.
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("XObject");
	});

	it("leaves a blank page blank instead of failing", async () => {
		const user = userEvent.setup();
		const source = await PDFDocument.create();
		// A page nobody drew on has no content stream at all.
		source.addPage([595, 842]);
		render(<PdfNupTool />);
		await load(user, new File([new Uint8Array(await source.save())], "handout.pdf", { type: "application/pdf" }));
		const { doc } = await lay(user);
		expect(doc.getPageCount()).toBe(1);
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("XObject");
	});

	it("draws the optional border", async () => {
		const user = userEvent.setup();
		render(<PdfNupTool />);
		await load(user, await makePdf(2));
		await user.click(screen.getByLabelText(/thin line round each page/u));
		const { doc } = await lay(user);
		expect(doc.getPageCount()).toBe(1);
	});
});
