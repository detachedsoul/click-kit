import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfOverlayTool } from "@/features/pdf-tools/overlay-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:overlay/${next}`, blob);
			return `blob:overlay/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages: number, name: string, size: [number, number] = [400, 600]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage(size).drawText(`${name} ${index + 1}`, { x: 30, y: 30, size: 12, font });
	return new File([new Uint8Array(await doc.save())], `${name}.pdf`, { type: "application/pdf" });
};

const loadBoth = async (user: ReturnType<typeof userEvent.setup>, basePages = 3) => {
	await user.upload(screen.getByLabelText("Base PDF (the words)"), await makePdf(basePages, "letter"));
	await user.upload(screen.getByLabelText("Overlay PDF (the sheet on top)"), await makePdf(1, "head"));
	await screen.findByRole("button", { name: "Apply the overlay" });
};

const apply = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Apply the overlay" }));
	const link = await screen.findByRole("link", { name: /Download letter-overlaid\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf overlay tool", () => {
	it("asks for both documents", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await user.upload(screen.getByLabelText("Base PDF (the words)"), await makePdf(2, "letter"));
		expect(screen.getByText(/Choose both documents/u)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Apply the overlay" })).toBeNull();
	});

	it("stamps every page of the base", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		const { link, doc } = await apply(user);
		expect(link).toHaveProperty("download", "letter-overlaid.pdf");
		expect(doc.getPageCount()).toBe(3);
		expect(screen.getByText(/3 pages of 3 pages carry the overlay/u)).toBeTruthy();
	});

	it("stamps only the pages named in the range", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		fireEvent.change(screen.getByLabelText("Pages to stamp (blank for every page)"), { target: { value: "2" } });
		const { doc } = await apply(user);
		expect(doc.getPageCount()).toBe(3);
		expect(screen.getByText(/1 page of 3 pages carry the overlay/u)).toBeTruthy();
	});

	it("explains a range that runs past the document", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		fireEvent.change(screen.getByLabelText("Pages to stamp (blank for every page)"), { target: { value: "9" } });
		await user.click(screen.getByRole("button", { name: "Apply the overlay" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/page 9|does not exist|past/u);
		expect(screen.queryByRole("link", { name: /Download/u })).toBeNull();
	});

	it("switches how the overlay is sized", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Stretch to fill it" }));
		expect(screen.getByRole("button", { name: "Stretch to fill it" }).className).toContain("bg-forest");
		const { doc } = await apply(user);
		expect(doc.getPageCount()).toBe(3);
	});

	it("saves under a name you choose", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		await apply(user);
		fireEvent.change(screen.getByLabelText("Name for the file"), { target: { value: "branded" } });
		expect(screen.getByRole("link", { name: "Download branded.pdf" })).toBeTruthy();
	});

	it("starts again cleanly", async () => {
		const user = userEvent.setup();
		render(<PdfOverlayTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Start again" }));
		expect(screen.queryByRole("button", { name: "Apply the overlay" })).toBeNull();
	});
});
