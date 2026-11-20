import zlib from "node:zlib";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, PDFRawStream, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clickFraction, describeEdit, PdfEditorTool } from "@/features/pdf-tools/edit-tool";

vi.mock("@/features/pdf-tools/pdf-render", () => ({
	renderPageThumbnail: vi.fn(async (_bytes: Uint8Array, page: number, size = 180) => `data:image/jpeg;base64,page-${page}-${size}`),
}));

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:edit/${next}`, blob);
			return `blob:edit/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string) => {
			const blob = objectUrls.get(url);
			if (!blob) throw new Error(`unknown blob url ${url}`);
			return { ok: true, arrayBuffer: () => blob.arrayBuffer() };
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

/** A two-page PDF, each page 400 × 600, with its own embedded font. */
const makePdf = async (name = "contract.pdf") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	for (const index of [1, 2]) doc.addPage([400, 600]).drawText(`clause ${index}`, { x: 20, y: 560, size: 12, font });
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to edit"), await makePdf());
	await screen.findByLabelText("Add");
};

/** A click at the given point of the page image, with the image given a size to measure against. */
const clickPage = (x: number, y: number, page = 1) => {
	const image = screen.getByAltText(`Page ${page} of contract.pdf`);
	vi.spyOn(image, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
	fireEvent.click(image, { clientX: x, clientY: y });
};

/** The decoded page content, so the marks and the original text can both be looked for. */
const contentOf = (doc: PDFDocument, page: number) => {
	const node = doc.getPage(page - 1).node;
	const contents = node.Contents() as unknown as { asArray?: () => unknown[] };
	const items = contents?.asArray ? contents.asArray() : [contents];
	let text = "";
	for (const item of items) {
		const stream = doc.context.lookup(item as never);
		if (!(stream instanceof PDFRawStream)) continue;
		const data = stream.getContents();
		try {
			text += new TextDecoder().decode(zlib.inflateSync(Buffer.from(data)));
		} catch {
			text += new TextDecoder().decode(data);
		}
	}
	return text;
};

const saveAndRead = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Save the edited PDF" }));
	const link = await screen.findByRole("link", { name: /Download .*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("editing a page", () => {
	it("works out where a click landed", () => {
		const rect = { left: 10, top: 20, width: 200, height: 400 };
		expect(clickFraction(rect, 60, 120)).toEqual({ x: 0.25, y: 0.25 });
		expect(clickFraction(rect, -50, -50)).toEqual({ x: 0, y: 0 });
		expect(clickFraction({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toEqual({ x: 0.5, y: 0.25 });
	});

	it("reads a mark back in plain words", () => {
		expect(describeEdit({ kind: "text", page: 2, x: 0.25, y: 0.5, text: " Signed " })).toBe("Note “Signed” on page 2 at 25% / 50%");
		expect(describeEdit({ kind: "highlight", page: 1, x: 0.1, y: 0.2 })).toBe("Highlight on page 1 at 10% / 20%");
	});

	it("shows the pages it can see", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		expect(await screen.findByAltText("Page 1")).toBeTruthy();
		expect(screen.getByAltText("Page 2")).toBeTruthy();
		expect(await screen.findByAltText("Page 1 of contract.pdf")).toHaveProperty("src", "data:image/jpeg;base64,page-1-800");
	});

	it("puts a note where you click and keeps the original font", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.type(screen.getByLabelText("Words for the note"), "Signed");
		clickPage(100, 300);
		expect(screen.getByText("Note “Signed” on page 1 at 25% / 50%")).toBeTruthy();

		const { doc } = await saveAndRead(user);
		expect(doc.getPageCount()).toBe(2);
		const content = contentOf(doc, 1);
		// The note lands at 25% across and half way down a 400 × 600 page.
		expect(content).toContain("1 0 0 1 100 300 Tm");
		expect(content.toUpperCase()).toContain(Buffer.from("Signed", "latin1").toString("hex").toUpperCase());
		// The page's own font is still there beside the note's.
		const fonts = doc.getPage(0).node.Resources()?.toString() ?? "";
		expect((fonts.match(/\/Font/gu) ?? []).length).toBeGreaterThan(0);
		expect(fonts).toContain("Times");
	});

	it("will not place an empty note", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		expect((await screen.findByRole("alert")).textContent).toContain("Type the words for the note first");
		expect(screen.queryByText(/^Note “/u)).toBeNull();
	});

	it("highlights a band and covers one", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		expect(screen.getByText("Highlight on page 1 at 10% / 10%")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Cover box" }));
		clickPage(200, 480);
		expect(screen.getByText("Cover box on page 1 at 50% / 80%")).toBeTruthy();

		const { doc } = await saveAndRead(user);
		const content = contentOf(doc, 1);
		// A highlight keeps the page visible through it; a cover box paints solid white.
		expect(content).toContain("1 0.86 0.2 rg");
		expect(content).toContain("1 1 1 rg");
	});

	it("marks the page you are looking at", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		await user.click(screen.getByRole("button", { name: "Go to page 2" }));
		expect(await screen.findByAltText("Page 2 of contract.pdf")).toHaveProperty("src", "data:image/jpeg;base64,page-2-800");
		expect(screen.getByText("On this page").parentElement?.textContent).toContain("0");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(100, 100, 2);
		expect(screen.getByText("Highlight on page 2 at 25% / 17%")).toBeTruthy();
	});

	it("undoes and clears marks", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		clickPage(200, 300);
		expect(screen.getByText("Marks").parentElement?.textContent).toContain("2");

		await user.click(screen.getByRole("button", { name: "Undo last" }));
		expect(screen.getByText("Marks").parentElement?.textContent).toContain("1");
		await user.click(screen.getByRole("button", { name: "Clear all marks" }));
		expect(screen.getByText("Marks").parentElement?.textContent).toContain("0");
		expect(screen.getByText(/No marks yet/u)).toBeTruthy();
	});

	it("removes one mark from the list", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		await user.click(screen.getByRole("button", { name: "Remove Highlight on page 1 at 10% / 10%" }));
		expect(screen.queryByText("Highlight on page 1 at 10% / 10%")).toBeNull();
	});

	it("saves under a name you choose", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		await saveAndRead(user);
		expect(screen.getByRole("link", { name: "Download contract-edited.pdf" })).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Name for the file"), { target: { value: "signed copy" } });
		expect(screen.getByRole("link", { name: "Download signed copy.pdf" })).toBeTruthy();
	});

	it("explains that a cover box is not a redaction", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Cover box" }));
		expect(screen.getByText(/hides what is there rather than removing it/u)).toBeTruthy();
	});

	it("walks you through the three steps", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		for (const heading of ["Choose a mark", "Click the page", "Save"]) expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
		expect(screen.getByText(/Click the spot where the note should sit/u)).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		expect(screen.getByText(/Click where the band should begin/u)).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Cover box" }));
		expect(screen.getByText(/Click where the white box should begin/u)).toBeTruthy();
	});

	it("shows which mark is loaded", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		const note = screen.getByRole("button", { name: "Text note" });
		const band = screen.getByRole("button", { name: "Highlight" });
		// The loaded mark is filled dark and the empty ones stay light: a filled button that
		// loses its background would read as white-on-white, so the class is pinned here.
		expect(note.getAttribute("aria-pressed")).toBe("true");
		expect(note.className).toContain("bg-forest");
		expect(note.className).toContain("text-white");
		expect(band.getAttribute("aria-pressed")).toBe("false");
		expect(band.className).not.toContain("bg-forest");
		await user.click(band);
		expect(band.getAttribute("aria-pressed")).toBe("true");
		expect(note.getAttribute("aria-pressed")).toBe("false");
		expect(screen.getByRole("button", { name: "Place a highlight on page 1" })).toBeTruthy();
	});

	it("steps between pages with buttons", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		expect(screen.getByRole("button", { name: "Previous page" }).getAttribute("disabled")).not.toBeNull();
		await user.click(screen.getByRole("button", { name: "Next page" }));
		await screen.findByAltText("Page 2 of contract.pdf");
		expect(screen.getByRole("button", { name: "Next page" }).getAttribute("disabled")).not.toBeNull();
		await user.click(screen.getByRole("button", { name: "Previous page" }));
		await screen.findByAltText("Page 1 of contract.pdf");
	});

	it("shows where the mark will land before the click", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await user.type(screen.getByLabelText("Words for the note"), "Paid");
		const image = await screen.findByAltText("Page 1 of contract.pdf");
		vi.spyOn(image, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
		fireEvent.mouseMove(image, { clientX: 100, clientY: 300 });
		expect(screen.getByText("Paid")).toBeTruthy();
		fireEvent.mouseLeave(image);
		expect(screen.queryByText("Paid")).toBeNull();
	});

	it("places a mark from the keyboard", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		const image = await screen.findByAltText("Page 1 of contract.pdf");
		fireEvent.keyDown(image, { key: "Enter" });
		expect(screen.getByText("Highlight on page 1 at 50% / 50%")).toBeTruthy();
	});

	it("drops a mark from the row under the page", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		clickPage(200, 300);
		expect(screen.getByText("Highlight at 10% / 10%")).toBeTruthy();
		expect(screen.getByText("Highlight at 50% / 50%")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Remove Highlight on page 1 at 10% / 10% from the page" }));
		expect(screen.queryByText("Highlight at 10% / 10%")).toBeNull();
		expect(screen.queryByText("Highlight on page 1 at 10% / 10%")).toBeNull();
		expect(screen.getByText("Highlight at 50% / 50%")).toBeTruthy();
	});

	it("jumps to the page a mark sits on", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		await user.click(screen.getByRole("button", { name: "Next page" }));
		await screen.findByAltText("Page 2 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Show" }));
		expect(await screen.findByAltText("Page 1 of contract.pdf")).toBeTruthy();
	});

	it("keeps saving switched off until there is a mark", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		expect(screen.getByRole("button", { name: "Save the edited PDF" })).toHaveProperty("disabled", true);
		expect(screen.getByText(/Nothing to save yet/u)).toBeTruthy();
		await waitFor(() => expect(screen.getByText(/No marks yet/u)).toBeTruthy());
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		expect(screen.getByRole("button", { name: "Save the edited PDF" })).toHaveProperty("disabled", false);
	});
});
