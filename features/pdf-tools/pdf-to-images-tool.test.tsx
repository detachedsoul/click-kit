import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfToImagesTool } from "@/features/pdf-tools/pdf-to-images-tool";

const renderPageImages = vi.fn(async (_bytes: Uint8Array, pages: number[], options: { type?: string; scale?: number }) =>
	pages.map((page) => ({ page, blob: new Blob([`image-${page}-${options.type ?? "image/png"}-${options.scale ?? 1}`], { type: options.type ?? "image/png" }) })),
);

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

const makePdf = async (pages: number, name = "deck.pdf") => {
	const doc = await PDFDocument.create();
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]);
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, pages = 3) => {
	await user.upload(screen.getByLabelText("PDF to convert"), await makePdf(pages));
	await screen.findByRole("button", { name: "Convert pages to images" });
};

const download = async (pattern: RegExp) => {
	const link = await screen.findByRole("link", { name: pattern });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, text: await blob.text() };
};

describe("pdf to images", () => {
	it("counts the pages before converting", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user, 4);
		expect(screen.getByText("To convert").parentElement?.textContent).toContain("4");
	});

	it("turns every page into a png in a zip", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Convert pages to images" }));
		const { link } = await download(/Download deck-images\.zip$/u);
		expect(link).toHaveProperty("download", "deck-images.zip");
		expect(renderPageImages).toHaveBeenCalledWith(expect.any(Uint8Array), [1, 2, 3], expect.objectContaining({ type: "image/png" }));
	});

	it("downloads a single image directly when one page is picked", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user);
		await user.type(screen.getByLabelText("Pages"), "2");
		await user.click(screen.getByRole("button", { name: "Convert pages to images" }));
		const { link } = await download(/Download deck-page-2\.png$/u);
		expect(link).toHaveProperty("download", "deck-page-2.png");
	});

	it("uses the format and size picked after loading", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user);
		await user.selectOptions(screen.getByLabelText("Image format"), "image/jpeg");
		await user.selectOptions(screen.getByLabelText("Size"), "3");
		await user.type(screen.getByLabelText("Pages"), "1");
		await user.click(screen.getByRole("button", { name: "Convert pages to images" }));
		const { link } = await download(/Download deck-page-1\.jpg$/u);
		expect(link).toHaveProperty("download", "deck-page-1.jpg");
		expect(renderPageImages).toHaveBeenCalledWith(expect.any(Uint8Array), [1], expect.objectContaining({ type: "image/jpeg", scale: 3 }));
	});

	it("hides the quality control for png", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user);
		expect(screen.queryByLabelText("Quality")).toBeNull();
		await user.selectOptions(screen.getByLabelText("Image format"), "image/webp");
		expect(screen.getByLabelText("Quality")).toBeTruthy();
	});

	it("refuses a page past the end", async () => {
		const user = userEvent.setup();
		render(<PdfToImagesTool />);
		await load(user);
		await user.type(screen.getByLabelText("Pages"), "9");
		expect(screen.getAllByRole("alert").at(-1)?.textContent).toBe("This PDF has 3 pages, so page 9 does not exist.");
		expect(screen.getByRole("button", { name: "Convert pages to images" })).toHaveProperty("disabled", true);
	});
});
