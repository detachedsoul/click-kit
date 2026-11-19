import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { movePage, PdfOrganiseTool } from "@/features/pdf-tools/organise-tool";

vi.mock("@/features/pdf-tools/pdf-render", () => ({
	renderPageThumbnail: vi.fn(async (_bytes: Uint8Array, page: number) => `data:image/jpeg;base64,page-${page}`),
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
			objectUrls.set(`blob:pdf/${next}`, blob);
			return `blob:pdf/${next}`;
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

/** Three pages, each a different width so the saved order is readable. */
const makePdf = async (name = "album.pdf") => {
	const doc = await PDFDocument.create();
	doc.addPage([300, 400]);
	doc.addPage([400, 400]);
	doc.addPage([500, 400]);
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to arrange"), await makePdf());
	await screen.findByRole("button", { name: "Save rearranged PDF" });
};

const save = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Save rearranged PDF" }));
	const link = await screen.findByRole("link", { name: /Download album-arranged\.pdf/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
};

const widths = (doc: PDFDocument) => doc.getPages().map((page) => Math.round(page.getWidth()));

describe("pdf page organiser", () => {
	it("renders a card per page with a preview", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		expect(screen.getAllByText(/^Page \d/u)).toHaveLength(3);
		const preview = await screen.findByAltText("Page 1");
		expect(preview.getAttribute("src")).toBe("data:image/jpeg;base64,page-1");
	});

	it("saves pages in their new order", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Move page 3 left" }));
		await user.click(screen.getByRole("button", { name: "Move page 3 left" }));
		expect(widths(await save(user))).toEqual([500, 300, 400]);
	});

	it("turns a single page", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Rotate page 2" }));
		expect(screen.getByAltText("Page 2, turned 90°")).toBeTruthy();
		const doc = await save(user);
		expect(doc.getPage(1).getRotation().angle).toBe(90);
		expect(doc.getPage(0).getRotation().angle).toBe(0);
	});

	it("drops and restores a page", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Remove page 2" }));
		expect(screen.getByText("Page 2 · removed")).toBeTruthy();
		expect(widths(await save(user))).toEqual([300, 500]);
		await user.click(screen.getByRole("button", { name: "Keep page 2" }));
		expect(widths(await save(user))).toEqual([300, 400, 500]);
	});

	it("turns every page at once", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: /Rotate all right/u }));
		const doc = await save(user);
		expect(doc.getPages().map((page) => page.getRotation().angle)).toEqual([90, 90, 90]);
	});

	it("restores removed pages in one click", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Remove page 1" }));
		await user.click(screen.getByRole("button", { name: "Remove page 3" }));
		await user.click(screen.getByRole("button", { name: "Restore removed" }));
		expect(widths(await save(user))).toEqual([300, 400, 500]);
	});

	it("says what is left when every page is removed", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		for (const page of [1, 2, 3]) await user.click(screen.getByRole("button", { name: `Remove page ${page}` }));
		expect(screen.getAllByRole("alert").at(-1)?.textContent).toBe("Keep at least one page.");
		expect(screen.getByRole("button", { name: "Save rearranged PDF" })).toHaveProperty("disabled", true);
	});
});

describe("dragging pages", () => {
	it("moves a page to the position it is dropped on", () => {
		expect(movePage(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
		expect(movePage(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
		expect(movePage(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
		expect(movePage(["a", "b", "c"], 0, 5)).toEqual(["a", "b", "c"]);
	});

	it("reorders the cards when one is dropped on another", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		const cards = () => screen.getAllByText(/^Page \d/u).map((node) => node.textContent);
		expect(cards()).toEqual(["Page 1", "Page 2", "Page 3"]);

		const stored = new Map<string, string>();
		const dataTransfer = { setData: (type: string, value: string) => stored.set(type, value), getData: (type: string) => stored.get(type) ?? "", effectAllowed: "" };
		const [first, , third] = screen.getAllByText(/^Page \d/u).map((node) => node.closest("li") as HTMLLIElement);
		fireEvent.dragStart(first, { dataTransfer });
		fireEvent.dragOver(third, { dataTransfer });
		fireEvent.drop(third, { dataTransfer });
		fireEvent.dragEnd(third, { dataTransfer });

		expect(cards()).toEqual(["Page 2", "Page 3", "Page 1"]);
		// And the saved file follows the cards.
		const doc = await save(user);
		expect(widths(doc)).toEqual([400, 500, 300]);
	});

	it("marks the card being dragged", async () => {
		const user = userEvent.setup();
		render(<PdfOrganiseTool />);
		await load(user);
		const dataTransfer = { setData: vi.fn(), getData: vi.fn(() => ""), effectAllowed: "" };
		const first = screen.getAllByText(/^Page \d/u)[0].closest("li") as HTMLLIElement;
		fireEvent.dragStart(first, { dataTransfer });
		expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "0");
		expect(first.className).toContain("opacity-60");
		fireEvent.dragEnd(first, { dataTransfer });
		expect(first.className).not.toContain("opacity-60");
	});
});
