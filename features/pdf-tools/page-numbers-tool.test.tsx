import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fillLabel } from "@/features/pdf-tools/pdf-engine";
import { PdfPageNumbersTool } from "@/features/pdf-tools/page-numbers-tool";

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

const makePdf = async (pages: number, title = "Field notes") => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.setTitle(title);
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]).drawText(`page body ${index + 1}`, { x: 20, y: 300, size: 12, font });
	return new File([new Uint8Array(await doc.save())], "notes.pdf", { type: "application/pdf" });
};

const makePdfWithoutTitle = async (pages: number) => {
	const doc = await PDFDocument.create();
	for (let index = 0; index < pages; index += 1) doc.addPage([300, 400]);
	return new File([new Uint8Array(await doc.save())], "notes.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, pages = 3) => {
	await user.upload(screen.getByLabelText("PDF to number"), await makePdf(pages));
	await screen.findByRole("button", { name: "Add headers and numbers" });
};

const apply = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Add headers and numbers" }));
	const link = await screen.findByRole("link", { name: /Download notes-numbered\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("page labels", () => {
	it("fills the placeholders", () => {
		expect(fillLabel("Page {page} of {pages}", { page: 3, pages: 12, title: "Notes", date: "2026-11-15" })).toBe("Page 3 of 12");
		expect(fillLabel("{title} · {date}", { page: 1, pages: 1, title: "Notes", date: "2026-11-15" })).toBe("Notes · 2026-11-15");
		expect(fillLabel("  {page}  ", { page: 1, pages: 1, title: "", date: "" })).toBe("1");
		expect(fillLabel("no placeholders", { page: 1, pages: 1, title: "", date: "" })).toBe("no placeholders");
	});
});

describe("pdf page numbers", () => {
	it("starts with the document title in the header, and a preview of the footer", async () => {
		const user = userEvent.setup();
		render(<PdfPageNumbersTool />);
		await load(user, 3);
		expect((screen.getByLabelText("Header") as HTMLInputElement).value).toBe("{title}");
		expect(screen.getByText("Page 2 of 3")).toBeTruthy();
	});

	it("numbers the pages and keeps every one of them", async () => {
		const user = userEvent.setup();
		render(<PdfPageNumbersTool />);
		await load(user, 3);
		const { link, doc } = await apply(user);
		expect(link).toHaveProperty("download", "notes-numbered.pdf");
		expect(doc.getPageCount()).toBe(3);
		expect(screen.getByText(/Numbers 2–3, first page left clean/u)).toBeTruthy();
	});

	it("counts from the first number given", async () => {
		const user = userEvent.setup();
		render(<PdfPageNumbersTool />);
		await load(user, 3);
		const start = screen.getByLabelText("First number");
		await user.clear(start);
		await user.type(start, "5");
		await user.click(screen.getByRole("checkbox"));
		const { doc } = await apply(user);
		expect(doc.getPageCount()).toBe(3);
		expect(screen.getByText(/Numbers 5–7/u)).toBeTruthy();
	});

	it("refuses to run with both lines empty", async () => {
		const user = userEvent.setup();
		render(<PdfPageNumbersTool />);
		await load(user);
		await user.clear(screen.getByLabelText("Header"));
		await user.clear(screen.getByLabelText("Footer"));
		expect(screen.getByRole("button", { name: "Add headers and numbers" })).toHaveProperty("disabled", true);
	});

	it("works on a pdf with no title of its own", async () => {
		const user = userEvent.setup();
		render(<PdfPageNumbersTool />);
		await user.upload(screen.getByLabelText("PDF to number"), await makePdfWithoutTitle(2));
		await screen.findByRole("button", { name: "Add headers and numbers" });
		await user.click(screen.getByRole("button", { name: "Add headers and numbers" }));
		expect(await screen.findByRole("link", { name: /Download notes-numbered\.pdf$/u })).toBeTruthy();
	});
});
