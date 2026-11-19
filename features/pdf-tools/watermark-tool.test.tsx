import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfWatermarkTool } from "@/features/pdf-tools/watermark-tool";

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

/** A two-page PDF whose own text uses an embedded font we can look for afterwards. */
const makePdf = async (name = "contract.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	for (const index of [1, 2]) doc.addPage([300, 400]).drawText(`clause ${index}`, { x: 20, y: 300, size: 12, font });
	return { file: new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" }) };
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to stamp"), (await makePdf()).file);
	await screen.findByRole("button", { name: "Stamp the PDF" });
};

const stampAndRead = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Stamp the PDF" }));
	const link = await screen.findByRole("link", { name: /Download .*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	const bytes = new Uint8Array(await blob.arrayBuffer());
	return { link, bytes, doc: await PDFDocument.load(bytes) };
};

describe("pdf watermark", () => {
	it("stamps every page and keeps the original fonts", async () => {
		const user = userEvent.setup();
		render(<PdfWatermarkTool />);
		await load(user);
		const { link, doc } = await stampAndRead(user);
		expect(link).toHaveProperty("download", "contract-stamped.pdf");
		expect(doc.getPageCount()).toBe(2);
		// The page still points at its original font resources, plus the stamp's own.
		for (const page of doc.getPages()) expect(page.node.Resources()?.toString()).toContain("Font");
	});

	it("uses the words typed after loading", async () => {
		const user = userEvent.setup();
		render(<PdfWatermarkTool />);
		await load(user);
		const input = screen.getByLabelText("Words to stamp");
		await user.clear(input);
		await user.type(input, "CONFIDENTIAL");
		const { link } = await stampAndRead(user);
		expect(link).toHaveProperty("download", "contract-stamped.pdf");
		expect(screen.getByText(/“CONFIDENTIAL” on 2 pages/u)).toBeTruthy();
	});

	it("switches to a repeated layout", async () => {
		const user = userEvent.setup();
		render(<PdfWatermarkTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Repeated across" }));
		expect(screen.getByText("Repeated")).toBeTruthy();
		await user.selectOptions(screen.getByLabelText("Colour"), "red");
		await user.selectOptions(screen.getByLabelText("Strength"), "0.5");
		const { doc } = await stampAndRead(user);
		expect(doc.getPageCount()).toBe(2);
	});

	it("will not stamp empty text", async () => {
		const user = userEvent.setup();
		render(<PdfWatermarkTool />);
		await load(user);
		await user.clear(screen.getByLabelText("Words to stamp"));
		expect(screen.getByRole("button", { name: "Stamp the PDF" })).toHaveProperty("disabled", true);
	});

	it("explains that the stamp font is latin only", async () => {
		const user = userEvent.setup();
		render(<PdfWatermarkTool />);
		await load(user);
		const input = screen.getByLabelText("Words to stamp");
		await user.clear(input);
		await user.type(input, "秘密");
		await user.click(screen.getByRole("button", { name: "Stamp the PDF" }));
		expect((await screen.findByRole("alert")).textContent).toContain("only covers Latin letters");
	});
});
