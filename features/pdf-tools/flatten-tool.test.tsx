import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfFlattenTool } from "@/features/pdf-tools/flatten-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:flat/${next}`, blob);
			return `blob:flat/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

/** A page with its own font, an unfilled form field, and (optionally) a painted highlight. */
const makePdf = async ({ field = true, mark = true, appearance = true, name = "notes.pdf" } = {}) => {
	const doc = await PDFDocument.create();
	const page = doc.addPage([400, 600]);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	page.drawText("clause one", { x: 20, y: 560, size: 12, font });
	if (field) {
		const form = doc.getForm();
		const text = form.createTextField("name");
		text.setText("Ada");
		text.addToPage(page, { height: 24, width: 200, x: 50, y: 500 });
	}
	if (mark) {
		const paint = doc.context.stream("1 0.86 0.2 rg 0 0 100 20 re f", { BBox: [0, 0, 100, 20], Resources: doc.context.obj({}), Subtype: "Form", Type: "XObject" });
		const paintRef = doc.context.register(paint);
		const annot = doc.context.obj({ ...(appearance ? { AP: doc.context.obj({ N: paintRef }) } : {}), F: 4, Rect: [40, 400, 140, 420], Subtype: "Highlight", Type: "Annot" });
		page.node.addAnnot(doc.context.register(annot));
	}
	return new File([new Uint8Array(await doc.save())], name, { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PDF with annotations to flatten"), file ?? (await makePdf()));
	await screen.findByRole("button", { name: "Flatten the PDF" });
};

const flatten = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Flatten the PDF" }));
	const link = await screen.findByRole("link", { name: /Download notes-flat\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf flatten tool", () => {
	it("explains itself before a document arrives", () => {
		render(<PdfFlattenTool />);
		expect(screen.getByText(/no page is redrawn or turned into an image/u)).toBeTruthy();
	});

	it("counts the fields and marks first", async () => {
		const user = userEvent.setup();
		render(<PdfFlattenTool />);
		await load(user);
		expect(screen.getByText("Form fields").parentElement?.textContent).toContain("1");
		expect(screen.getByText("Markup marks").parentElement?.textContent).toContain("1");
		expect(screen.getByText(/2 things to bake into 1 page/u)).toBeTruthy();
	});

	it("bakes the marks into the pages", async () => {
		const user = userEvent.setup();
		render(<PdfFlattenTool />);
		await load(user);
		const { link, doc } = await flatten(user);
		expect(link).toHaveProperty("download", "notes-flat.pdf");
		expect(doc.getPage(0).node.Annots()).toBeUndefined();
		expect(doc.getForm().getFields()).toHaveLength(0);
		expect(screen.getByText("1 form field and 1 mark baked into the page")).toBeTruthy();
	});

	it("has nothing to do on a plain PDF", async () => {
		const user = userEvent.setup();
		render(<PdfFlattenTool />);
		await user.upload(screen.getByLabelText("PDF with annotations to flatten"), await makePdf({ field: false, mark: false }));
		expect(await screen.findByText(/Nothing to flatten/u)).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Flatten the PDF" })).toHaveProperty("disabled", true);
	});

	it("says when a mark had no appearance to bake", async () => {
		const user = userEvent.setup();
		render(<PdfFlattenTool />);
		await load(user, await makePdf({ field: false, appearance: false }));
		await user.click(screen.getByRole("button", { name: "Flatten the PDF" }));
		expect(await screen.findByText(/1 mark had no appearance to bake, so it stayed an annotation/u)).toBeTruthy();
	});
});
