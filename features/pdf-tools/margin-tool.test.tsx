import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfMarginTool } from "@/features/pdf-tools/margin-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:margin/${next}`, blob);
			return `blob:margin/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages = 2, size: [number, number] = [600, 800]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage(size).drawText(`page ${index + 1}`, { x: 40, y: 40, size: 12, font });
	return new File([new Uint8Array(await doc.save())], "poster.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to give margins"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Add the margins" });
};

const addAndRead = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Add the margins" }));
	const link = await screen.findByRole("link", { name: /Download .*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

const sizes = (doc: PDFDocument) => doc.getPages().map((page) => [Math.round(page.getWidth()), Math.round(page.getHeight())]);

describe("pdf margin adder", () => {
	it("starts with a binding edge on the left", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		expect((screen.getByLabelText("Left (mm)") as HTMLInputElement).value).toBe("10");
		expect((screen.getByLabelText("Top (mm)") as HTMLInputElement).value).toBe("0");
	});

	it("grows the page by the margin and moves the content in", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		const { link, doc } = await addAndRead(user);
		expect(link).toHaveProperty("download", "poster-margins.pdf");
		// 10 mm is 28.35 pt, added once on the left only.
		expect(sizes(doc)).toEqual([
			[628, 800],
			[628, 800],
		]);
		// The text layer is untouched, so the page still carries its own font.
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("Font");
	});

	it("applies a preset to every side", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "20 mm" }));
		const { doc } = await addAndRead(user);
		expect(sizes(doc)[0]).toEqual([600 + 113, 800 + 113]);
	});

	it("takes a different margin on each side", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Left (mm)"), { target: { value: "0" } });
		fireEvent.change(screen.getByLabelText("Top (mm)"), { target: { value: "10" } });
		fireEvent.change(screen.getByLabelText("Right (mm)"), { target: { value: "5" } });
		const { doc } = await addAndRead(user);
		// Left 0, right 5 mm (14.17), top 10 mm (28.35), bottom 0.
		expect(sizes(doc)[0]).toEqual([614, 828]);
	});

	it("will not add nothing", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "None" }));
		expect(screen.getByRole("button", { name: "Add the margins" })).toHaveProperty("disabled", true);
	});

	it("saves under a name you choose", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		await addAndRead(user);
		fireEvent.change(screen.getByLabelText("Name for the file"), { target: { value: "spiral bound" } });
		expect(screen.getByRole("link", { name: "Download spiral bound.pdf" })).toBeTruthy();
	});

	it("says what it did in the note", async () => {
		const user = userEvent.setup();
		render(<PdfMarginTool />);
		await load(user);
		await addAndRead(user);
		expect(screen.getByText(/2 pages given 10 × 0 mm of margin/u)).toBeTruthy();
	});
});
