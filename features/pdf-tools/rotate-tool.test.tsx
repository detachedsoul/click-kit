import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfRotateTool } from "@/features/pdf-tools/rotate-tool";

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

const makePdf = async (pageCount = 3, preRotation = 0) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pageCount; index += 1) {
		const page = doc.addPage([600, 800]);
		page.drawText(`page ${index + 1}`, { x: 60, y: 700, size: 14, font });
		if (preRotation) page.setRotation(degrees(preRotation));
	}
	return new File([new Uint8Array(await doc.save())], "scan.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to turn"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Turn the pages" });
};

const turn = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Turn the pages" }));
	const link = await screen.findByRole("link", { name: /Download scan-rotated\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

const rotations = (doc: Awaited<ReturnType<typeof PDFDocument.load>>) => doc.getPages().map((page) => page.getRotation().angle);

describe("pdf page rotator", () => {
	it("turns every page a quarter turn by default", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		const { link, doc } = await turn(user);
		expect(link).toHaveProperty("download", "scan-rotated.pdf");
		expect(rotations(doc)).toEqual([90, 90, 90]);
	});

	it("turns the pages the other way when asked", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "90° anticlockwise" }));
		const { doc } = await turn(user);
		expect(rotations(doc)).toEqual([270, 270, 270]);
	});

	it("only touches the pages picked", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Pages"), { target: { value: "1, 3" } });
		expect(screen.getByText("Pages turning").parentElement?.textContent).toContain("2");
		const { doc } = await turn(user);
		expect(rotations(doc)).toEqual([90, 0, 90]);
	});

	it("adds to a rotation the page already had", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user, await makePdf(1, 270));
		const { doc } = await turn(user);
		expect(rotations(doc)).toEqual([0]);
	});

	it("half turns", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "180°" }));
		const { doc } = await turn(user);
		expect(rotations(doc)).toEqual([180, 180, 180]);
	});

	it("explains a page range it cannot read", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		fireEvent.change(screen.getByLabelText("Pages"), { target: { value: "9" } });
		expect((screen.getByRole("button", { name: "Turn the pages" }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText(/does not exist/u)).toBeTruthy();
	});

	it("keeps the words on the page", async () => {
		const user = userEvent.setup();
		render(<PdfRotateTool />);
		await load(user);
		const { doc } = await turn(user);
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("Font");
	});
});
