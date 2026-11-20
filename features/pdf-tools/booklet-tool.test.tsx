import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookletOrder } from "@/features/pdf-tools/pdf-engine";
import { PdfBookletTool } from "@/features/pdf-tools/booklet-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:booklet/${next}`, blob);
			return `blob:booklet/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (pages = 4, name = "zine.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]).drawText(`page ${index + 1}`, { x: 20, y: 360, size: 12, font });
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF to fold into a booklet"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Build the booklet" });
};

const build = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Build the booklet" }));
	const link = await screen.findByRole("link", { name: /Download zine-booklet\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("booklet order", () => {
	it("puts page four beside page one, and two beside three", () => {
		expect(bookletOrder(4)).toEqual([{ front: [4, 1], back: [2, 3] }]);
	});

	it("works through eight pages in two sheets", () => {
		expect(bookletOrder(8)).toEqual([
			{ front: [8, 1], back: [2, 7] },
			{ front: [6, 3], back: [4, 5] },
		]);
	});

	it("fills the last sheet with blanks", () => {
		// Six pages pad out to eight: the two missing pages are the outside of the booklet,
		// which lands as blank paper at the back.
		expect(bookletOrder(6)).toEqual([
			{ front: [null, 1], back: [2, null] },
			{ front: [6, 3], back: [4, 5] },
		]);
	});

	it("has nothing to say about an empty document", () => {
		expect(bookletOrder(0)).toEqual([]);
	});
});

describe("pdf booklet tool", () => {
	it("counts the sheets before you build", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user, await makePdf(6));
		expect(screen.getByText("Sheets").parentElement?.textContent).toContain("2");
		expect(screen.getByText("Blanks added").parentElement?.textContent).toContain("2");
		expect(screen.getByText(/does not divide by four/u)).toBeTruthy();
	});

	it("builds two sides per sheet on landscape paper", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user);
		const { link, doc } = await build(user);
		expect(link).toHaveProperty("download", "zine-booklet.pdf");
		expect(doc.getPageCount()).toBe(2);
		const sheet = doc.getPage(0);
		expect(Math.round(sheet.getWidth())).toBe(842);
		expect(Math.round(sheet.getHeight())).toBe(595);
		// The pages are embedded, so the sheet carries the source's font, not a picture of it.
		expect(doc.getPage(0).node.Resources()?.toString()).toContain("XObject");
	});

	it("takes the paper you pick", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "A5" }));
		const { doc } = await build(user);
		expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
	});

	it("draws the fold line only when asked", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user);
		const withFold = await build(user);
		const foldedSize = objectUrls.get(withFold.link.getAttribute("href") ?? "")?.size ?? 0;
		fireEvent.click(screen.getByLabelText("Draw a faint fold line down the spine"));
		const withoutFold = await build(user);
		const plainSize = objectUrls.get(withoutFold.link.getAttribute("href") ?? "")?.size ?? 0;
		expect(foldedSize).toBeGreaterThan(plainSize);
	});

	it("says how many sides and blanks it made", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user, await makePdf(6));
		await build(user);
		expect(screen.getByText(/4 sides on 2 sheets, with 2 blank pages added/u)).toBeTruthy();
	});

	it("saves under a name you choose", async () => {
		const user = userEvent.setup();
		render(<PdfBookletTool />);
		await load(user);
		await build(user);
		fireEvent.change(screen.getByLabelText("Name for the file"), { target: { value: "programme" } });
		expect(screen.getByRole("link", { name: "Download programme.pdf" })).toBeTruthy();
	});

	it("refuses something that is not a PDF", async () => {
		render(<PdfBookletTool />);
		const input = screen.getByLabelText("PDF to fold into a booklet");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["hello"], "notes.txt", { type: "text/plain" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toBeTruthy();
	});
});
