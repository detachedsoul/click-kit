import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfCropTool } from "@/features/pdf-tools/crop-tool";

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

const makePdf = async (name = "poster.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.addPage([600, 800]).drawText("wide margins", { x: 100, y: 400, size: 14, font });
	doc.addPage([600, 800]);
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to trim"), await makePdf());
	await screen.findByRole("button", { name: "Trim the margins" });
};

const crop = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Trim the margins" }));
	const link = await screen.findByRole("link", { name: /Download poster-trimmed\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf margin trimmer", () => {
	it("trims the crop box but leaves the page size alone", async () => {
		const user = userEvent.setup();
		render(<PdfCropTool />);
		await load(user);
		const { link, doc } = await crop(user);
		expect(link).toHaveProperty("download", "poster-trimmed.pdf");
		const page = doc.getPage(0);
		expect(Math.round(page.getWidth())).toBe(600);
		const box = page.getCropBox();
		// Default is 10 mm on every side, which is 28.35 points.
		expect(Math.round(box.width)).toBe(600 - 57);
		expect(Math.round(box.height)).toBe(800 - 57);
		expect(Math.round(box.x)).toBe(28);
	});

	it("applies a preset to every side", async () => {
		const user = userEvent.setup();
		render(<PdfCropTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "2 cm" }));
		expect((screen.getByLabelText("Top (mm)") as HTMLInputElement).value).toBe("20");
		expect((screen.getByLabelText("Left (mm)") as HTMLInputElement).value).toBe("20");
		const { doc } = await crop(user);
		const box = doc.getPage(1).getCropBox();
		expect(Math.round(box.width)).toBe(Math.round(600 - 2 * 20 * (72 / 25.4)));
	});

	it("keeps the text layer intact", async () => {
		const user = userEvent.setup();
		render(<PdfCropTool />);
		await load(user);
		const { doc } = await crop(user);
		expect(doc.getPageCount()).toBe(2);
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("Font");
	});

	it("refuses margins wider than the page", async () => {
		const user = userEvent.setup();
		render(<PdfCropTool />);
		await load(user);
		const top = screen.getByLabelText("Top (mm)");
		await user.clear(top);
		await user.type(top, "500");
		await user.click(screen.getByRole("button", { name: "Trim the margins" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/leave no page behind/u);
	});

	it("asks for at least one margin", async () => {
		const user = userEvent.setup();
		render(<PdfCropTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Nothing" }));
		await user.click(screen.getByRole("button", { name: "Trim the margins" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/at least one margin/u);
	});
});
