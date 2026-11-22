import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocxPdfTool } from "@/features/converter-tools/docx-pdf-tool";
import { readZipFile } from "@/features/converter-tools/zip-reader";
import { writeZip } from "@/features/converter-tools/zip-write";

const mocks = vi.hoisted(() => ({ renderAsync: vi.fn(), html2canvas: vi.fn() }));
vi.mock("docx-preview", () => ({ renderAsync: mocks.renderAsync }));
vi.mock("html2canvas", () => ({ default: mocks.html2canvas }));

const objectUrls = new Map<string, Blob>();
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:docx/${next}`, blob);
			return `blob:docx/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
	mocks.renderAsync.mockReset();
	mocks.renderAsync.mockImplementation(async (_bytes: ArrayBuffer, root: HTMLElement, styleHost: HTMLElement) => {
		styleHost.innerHTML = "<style>.docx { color: #111; }</style>";
		const wrapper = document.createElement("div");
		wrapper.className = "docx-wrapper";
		for (const [index, [width, height]] of [[816, 1056], [816, 1056], [1056, 816]].entries()) {
			const page = document.createElement("section");
			page.className = "docx";
			page.style.width = `${width}px`;
			page.style.height = `${height}px`;
			page.innerHTML = index === 1 ? "" : `<h1>Styled page ${index + 1}</h1><p>Source page content</p><img alt="Embedded document picture" src="data:image/png;base64,${Buffer.from(png).toString("base64")}">`;
			Object.defineProperty(page, "getBoundingClientRect", { value: () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) });
			wrapper.append(page);
		}
		root.append(wrapper);
	});
	mocks.html2canvas.mockReset();
	mocks.html2canvas.mockImplementation(async () => {
		const canvas = document.createElement("canvas");
		Object.defineProperty(canvas, "toBlob", { configurable: true, value: (callback: BlobCallback) => callback(new Blob([png], { type: "image/png" })) });
		return canvas;
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const docx = (body = '<w:p><w:pPr><w:spacing w:line="240"/></w:pPr><w:r><w:t>Quarterly report</w:t></w:r></w:p>') => {
	const bytes = writeZip([
		{ data: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr/></w:body></w:document>`, name: "word/document.xml" },
	]);
	return new File([bytes.slice().buffer], "report.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
};

const upload = async (user: ReturnType<typeof userEvent.setup>, file = docx()) => user.upload(screen.getByLabelText("Word document (.docx)"), file);
const download = async (name = "report.pdf") => {
	const link = await screen.findByRole("link", { name: `Download ${name}` });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no PDF behind the download link");
	return PDFDocument.load(await blob.arrayBuffer());
};

describe("Word to PDF tool", () => {
	it("defaults to a visual, page-sized PDF and renders the document's pictures", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await upload(user);

		const pdf = await download();
		expect(pdf.getPageCount()).toBe(2);
		expect(Math.round(pdf.getPage(0).getSize().width)).toBe(612);
		expect(Math.round(pdf.getPage(0).getSize().height)).toBe(792);
		expect(Math.round(pdf.getPage(1).getSize().width)).toBe(792);
		expect(Math.round(pdf.getPage(1).getSize().height)).toBe(612);
		expect(mocks.renderAsync).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.any(HTMLElement), expect.any(HTMLElement), expect.objectContaining({ breakPages: true, ignoreFonts: false, renderHeaders: true }));
		const renderedDocx = new Uint8Array(mocks.renderAsync.mock.calls[0][0] as ArrayBuffer);
		expect(await readZipFile(renderedDocx, "word/document.xml")).toContain('w:lineRule="auto"');
		expect(mocks.html2canvas).toHaveBeenCalledTimes(2);
		expect(mocks.html2canvas.mock.calls[0][1]).toMatchObject({ backgroundColor: "#ffffff", scale: 3, useCORS: true });
		const sourceParagraph = mocks.html2canvas.mock.calls[0][0].querySelector("p");
		if (!sourceParagraph) throw new Error("The fixture needs a paragraph to test line spacing.");
		sourceParagraph.style.lineHeight = "28px";
		const clone = document.implementation.createHTMLDocument();
		clone.body.innerHTML = '<section id="docx-render-preview" style="max-height: 480px; overflow: auto"><div class="docx-wrapper"><section class="docx"><p>Source page content</p></section></div></section>';
		mocks.html2canvas.mock.calls[0][1].onclone(clone, clone.body);
		expect(clone.getElementById("docx-render-preview")?.getAttribute("style")).toContain("overflow: visible");
		expect(clone.querySelector(".docx p")?.getAttribute("style")).toContain("line-height: 28px");
		expect(mocks.html2canvas.mock.calls[0][0].querySelector("img")?.getAttribute("alt")).toBe("Embedded document picture");
		expect(screen.getByText(/not selectable or searchable/u)).toBeTruthy();
	});

	it("offers a clearly labelled selectable-text alternative", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await user.click(screen.getByRole("button", { name: "Selectable text" }));
		await upload(user);
		const pdf = await download();
		expect(pdf.getPageCount()).toBe(1);
		expect(screen.getByText(/does not preserve the Word page layout/u)).toBeTruthy();
		expect(mocks.renderAsync).not.toHaveBeenCalled();
	});

	it("uses the original render dimensions rather than imposing A4 or Letter on visual output", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await upload(user);
		const pdf = await download();
		expect(Math.round(pdf.getPage(1).getSize().width)).toBe(792);
	});

	it("explains that only .docx files work", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		mocks.renderAsync.mockRejectedValueOnce(new Error("not a Word document"));
		await upload(user, new File(["not a zip"], "old.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
		expect(await screen.findByText(/Only \.docx files work/u)).toBeTruthy();
	});

	it("re-renders a selected file when the PDF mode changes", async () => {
		const user = userEvent.setup();
		render(<DocxPdfTool />);
		await upload(user);
		await download();
		await user.click(screen.getByRole("button", { name: "Selectable text" }));
		const textPdf = await download();
		expect(textPdf.getPageCount()).toBe(1);
	});
});
