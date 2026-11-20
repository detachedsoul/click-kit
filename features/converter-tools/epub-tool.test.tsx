import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { EpubTool } from "@/features/converter-tools/epub-tool";

const encoder = new TextEncoder();
const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:book/${next}`, blob);
			return `blob:book/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makeEpub = async (name = "walk.epub") => {
	const container = `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
	const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Long Walk</dc:title><dc:creator>Ada</dc:creator></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`;
	const page = (title: string, body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body><h2>${title}</h2><p>${body}</p></body></html>`;
	const zip = await createZip([
		{ name: "META-INF/container.xml", data: encoder.encode(container) },
		{ name: "content.opf", data: encoder.encode(opf) },
		{ name: "a.xhtml", data: encoder.encode(page("Start", "It began here.")) },
		{ name: "b.xhtml", data: encoder.encode(page("Middle", "It continued.")) },
	]);
	return new File([zip.slice().buffer], name, { type: "application/epub+zip" });
};

const upload = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("EPUB book"), await makeEpub());
	await screen.findByLabelText("Markdown");
};

const output = () => (screen.getByLabelText("Markdown") as HTMLTextAreaElement).value;

describe("epub tool", () => {
	it("reads the whole book into one document", async () => {
		const user = userEvent.setup();
		render(<EpubTool />);
		await upload(user);
		expect(output().startsWith("# Long Walk")).toBe(true);
		expect(output()).toContain("## Start");
		expect(output()).toContain("## Middle");
		expect(screen.getByText("Author").parentElement?.textContent).toContain("Ada");
	});

	it("offers the markdown file", async () => {
		const user = userEvent.setup();
		render(<EpubTool />);
		await upload(user);
		const link = await screen.findByRole("link", { name: "Download walk.md" });
		const blob = objectUrls.get(link.getAttribute("href") ?? "");
		expect(await (blob as Blob).text()).toContain("## Middle");
	});

	it("picks a single chapter after loading", async () => {
		const user = userEvent.setup();
		render(<EpubTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "One chapter" }));
		await user.selectOptions(screen.getByLabelText("Chapter"), "1");
		expect(output()).toContain("## Middle");
		expect(output()).not.toContain("## Start");
		expect(await screen.findByRole("link", { name: "Download walk-2.md" })).toBeTruthy();
	});

	it("goes back to the whole book", async () => {
		const user = userEvent.setup();
		render(<EpubTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "One chapter" }));
		await user.selectOptions(screen.getByLabelText("Chapter"), "1");
		await user.click(screen.getByRole("button", { name: "Whole book again" }));
		expect(output()).toContain("## Start");
	});

	it("explains a file that is not a book", async () => {
		render(<EpubTool />);
		const input = screen.getByLabelText("EPUB book");
		const zip = await createZip([{ name: "readme.txt", data: encoder.encode("hi") }]);
		Object.defineProperty(input, "files", { configurable: true, value: [new File([zip.slice().buffer], "notes.epub", { type: "application/epub+zip" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toMatch(/not an EPUB/u);
	});
});
