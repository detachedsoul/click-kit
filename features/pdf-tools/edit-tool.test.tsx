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

/** Click a spot on the page, type straight onto it, and press Enter to place the words. */
const typeOnPage = async (user: ReturnType<typeof userEvent.setup>, words: string, x = 100, y = 300, page = 1) => {
	clickPage(x, y, page);
	await user.keyboard(words);
	await user.keyboard("{Enter}");
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
		await typeOnPage(user, "Signed");
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

	it("opens a box where you click and types right there", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		const box = screen.getByLabelText("Type on the page");
		expect(document.activeElement).toBe(box);
		await user.keyboard("Received");
		// What is typed is the mark on the page, not a value in a form elsewhere.
		expect((screen.getByLabelText("Type on the page") as HTMLInputElement).value).toBe("Received");
		await user.keyboard("{Enter}");
		expect(screen.queryByLabelText("Type on the page")).toBeNull();
		expect(screen.getByText("Note “Received” on page 1 at 25% / 50%")).toBeTruthy();
		expect(screen.getByRole("button", { name: /Edit Note “Received”/u })).toBeTruthy();
	});

	it("leaves nothing behind when the box is empty", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		await user.keyboard("{Escape}");
		expect(screen.queryByLabelText("Type on the page")).toBeNull();
		expect(screen.queryByText(/^Note “/u)).toBeNull();
		expect(screen.getByText(/No marks yet/u)).toBeTruthy();
	});

	it("drops the box without keeping the words when you escape", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		await user.keyboard("Half typed");
		await user.keyboard("{Escape}");
		expect(screen.queryByLabelText("Type on the page")).toBeNull();
		expect(screen.queryByText(/^Note “/u)).toBeNull();
	});

	it("keeps the words when you click away from the box", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		await user.keyboard("Dated");
		await user.click(screen.getByRole("heading", { name: "Choose a mark" }));
		expect(screen.queryByLabelText("Type on the page")).toBeNull();
		expect(screen.getByText("Note “Dated” on page 1 at 25% / 50%")).toBeTruthy();
	});

	it("re-opens a note by clicking it on the page", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await typeOnPage(user, "Draft");
		await user.click(screen.getByRole("button", { name: /Edit Note “Draft”/u }));
		const box = screen.getByLabelText("Type on the page") as HTMLInputElement;
		expect(box.value).toBe("Draft");
		await user.clear(box);
		await user.keyboard("Final");
		await user.keyboard("{Enter}");
		expect(screen.getByText("Note “Final” on page 1 at 25% / 50%")).toBeTruthy();
		expect(screen.queryByText(/Draft/u)).toBeNull();
	});

	it("saves words that are still in the box", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		clickPage(100, 300);
		await user.keyboard("Typed and saved");
		// No Enter first: clicking Save has to take the words with it.
		const { doc } = await saveAndRead(user);
		expect(contentOf(doc, 1)).toContain(Buffer.from("Typed and saved", "latin1").toString("hex").toUpperCase());
	});

	it("lines the three mark buttons up", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		const buttons = ["Text note", "Highlight", "Cover box", "Picture"].map((name) => screen.getByRole("button", { name }));
		const shape = (className: string) =>
			className
				.split(/\s+/u)
				.filter((token) => !/^(border-forest|bg-forest|text-white|text-ink|border-line|bg-surface|hover:)/u.test(token))
				.sort();
		for (const button of buttons) {
			// One row per button, centred: a column with no padding left the label pinned to the top edge.
			expect(button.className).toContain("items-center");
			expect(button.className).toContain("justify-start");
			expect(button.className).toContain("w-full");
			expect(button.className).not.toContain("flex-col");
		}
		expect(shape(buttons[0].className)).toEqual(shape(buttons[1].className));
		expect(shape(buttons[1].className)).toEqual(shape(buttons[2].className));
		expect(shape(buttons[2].className)).toEqual(shape(buttons[3].className));
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
		for (const heading of ["Choose a mark", "Work on the page", "Save"]) expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
		expect(screen.getByText(/Click the page where the words should begin, then type/u)).toBeTruthy();
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
		const image = await screen.findByAltText("Page 1 of contract.pdf");
		vi.spyOn(image, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
		// The text tool says what a click will do in the place it will do it.
		fireEvent.mouseMove(image, { clientX: 100, clientY: 300 });
		expect(screen.getByText("Type here")).toBeTruthy();
		fireEvent.mouseLeave(image);
		expect(screen.queryByText("Type here")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Highlight" }));
		fireEvent.mouseMove(image, { clientX: 40, clientY: 60 });
		expect(image.className).toContain("cursor-crosshair");
		expect(screen.queryByText("Type here")).toBeNull();
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
/** A 1 × 1 red PNG — real bytes, so the picture path can embed something. */
const PICTURE_BYTES = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (letter) => letter.charCodeAt(0));

/** The page image, measured so a click can be turned into fractions. */
const measurePage = (page = 1) => {
	const image = screen.getByAltText(`Page ${page} of contract.pdf`);
	vi.spyOn(image, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
	return image;
};

const follows = (first: Node, second: Node) => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("the page strip", () => {
	it("sits at the top, above the marks and the page itself", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		const first = screen.getByRole("button", { name: "Go to page 1" });
		const heading = screen.getByRole("heading", { name: "Choose a mark" });
		const image = screen.getByAltText("Page 1 of contract.pdf");
		// The pages come first now: a strip at the bottom made you scroll to find the page you wanted.
		expect(follows(first, heading)).toBe(true);
		expect(follows(heading, image)).toBe(true);
		expect(follows(screen.getByText("Page 1 of 2"), image)).toBe(true);
	});
});

describe("how the words look", () => {
	it("writes in the weight and colour you pick", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "bold" } });
		fireEvent.change(screen.getByLabelText("Text colour"), { target: { value: "#ff0000" } });
		await typeOnPage(user, "PAID");
		const { doc } = await saveAndRead(user);
		const content = contentOf(doc, 1);
		expect(content).toContain("1 0 0 rg");
		// A bold cut is embedded alongside the regular one rather than reusing it.
		expect(doc.getPage(0).node.Resources()?.toString() ?? "").toContain("Bold");
	});

	it("leaves the words with no background until one is chosen", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		// Plain words first, at the default: nothing but ink on the page.
		await typeOnPage(user, "plain", 40, 60);
		expect(screen.getByText("No background: the words sit straight on the page.")).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Lemon background" }));
		expect(screen.getByRole("button", { name: "Lemon background" }).getAttribute("aria-pressed")).toBe("true");
		await typeOnPage(user, "marked", 200, 300);

		const { doc } = await saveAndRead(user);
		const content = contentOf(doc, 1);
		const lemon = "0.9921568627450981 0.9529411764705882 0.7686274509803922 rg";
		// One filled box, for the second note only.
		expect(content.split(lemon).length - 1).toBe(1);
	});

	it("goes back to no background when you say so", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "White background" }));
		await user.click(screen.getByRole("button", { name: "No background" }));
		expect(screen.getByText("No background: the words sit straight on the page.")).toBeTruthy();
		const { doc } = await (async () => {
			await typeOnPage(user, "clean");
			return saveAndRead(user);
		})();
		// White would have been painted as a filled path; there is none.
		expect(contentOf(doc, 1)).not.toContain("\nh\nf\n");
	});
});

describe("pictures", () => {
	it("places a picture where you click and carries it into the PDF", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Picture" }));
		await user.upload(screen.getByLabelText("Picture to place"), new File([PICTURE_BYTES], "stamp.png", { type: "image/png" }));
		expect(await screen.findByText(/stamp\.png is ready/u)).toBeTruthy();
		clickPage(100, 300);
		expect(screen.getByText("Picture on page 1 at 25% / 50%")).toBeTruthy();
		// The picture is shown on the page from a local object URL, never uploaded.
		expect(document.querySelector('img[src^="blob:edit/"]')).toBeTruthy();

		const { doc } = await saveAndRead(user);
		const content = contentOf(doc, 1);
		// 30% of a 400 pt page is 120 pt, and a square picture stays square.
		expect(content).toContain("120 0 0 120 0 0 cm");
		// The click is the picture's top-left corner, and a 120 pt picture drops 120 pt from there.
		expect(content).toContain("1 0 0 1 100 180 cm");
		expect(content).toContain("Do");
	});

	it("asks for a picture before letting you click one onto the page", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Picture" }));
		clickPage(100, 300);
		expect(screen.getByText(/Choose a picture first/u)).toBeTruthy();
		expect(screen.queryByText(/^Picture on page/u)).toBeNull();
	});

	it("resizes a picture from its row", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Picture" }));
		await user.upload(screen.getByLabelText("Picture to place"), new File([PICTURE_BYTES], "stamp.png", { type: "image/png" }));
		await screen.findByText(/is ready/u);
		clickPage(100, 300);
		fireEvent.change(screen.getByLabelText("Width of the picture on page 1"), { target: { value: "50" } });
		const { doc } = await saveAndRead(user);
		expect(contentOf(doc, 1)).toContain("200 0 0 200 0 0 cm");
	});
});

describe("moving a mark on the page", () => {
	it("drags a note to a new spot", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await typeOnPage(user, "Sign here");
		const image = measurePage();
		const note = screen.getByRole("button", { name: /Edit Note “Sign here”/u });
		// Press on the note, move the pointer, and it follows the pointer.
		fireEvent.mouseDown(note, { clientX: 100, clientY: 300 });
		fireEvent.mouseMove(image.parentElement as HTMLElement, { clientX: 200, clientY: 480 });
		fireEvent.mouseUp(image.parentElement as HTMLElement);
		expect(screen.getByText("Note “Sign here” on page 1 at 50% / 80%")).toBeTruthy();
		// A drag is not a click: the box does not open under the pointer.
		expect(screen.queryByLabelText("Type on the page")).toBeNull();
	});

	it("pulls a band wider by its corner", async () => {
		const user = userEvent.setup();
		render(<PdfEditorTool />);
		await load(user);
		await screen.findByAltText("Page 1 of contract.pdf");
		await user.click(screen.getByRole("button", { name: "Highlight" }));
		clickPage(40, 60);
		const image = measurePage();
		const handle = document.querySelector('[data-handle="resize"]') as HTMLElement;
		const shape = handle.parentElement as HTMLElement;
		const before = Number.parseFloat(shape.style.width);
		// 34% of 400 pt is 136 pt; pulling 40 pt to the right adds 10% of the page.
		fireEvent.mouseDown(handle, { clientX: 40 + 136, clientY: 60 + 36 });
		fireEvent.mouseMove(image.parentElement as HTMLElement, { clientX: 40 + 136 + 40, clientY: 60 + 36 });
		expect(Number.parseFloat(shape.style.width)).toBeCloseTo(before + 10, 5);
	});
});
});
