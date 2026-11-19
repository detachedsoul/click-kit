import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { DocxTool } from "@/features/converter-tools/docx-tool";

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
			objectUrls.set(`blob:doc/${next}`, blob);
			return `blob:doc/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makeDocx = async (name = "minutes.docx") => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Weekly minutes</w:t></w:r></w:p>
<w:p><w:r><w:t>Attendees: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>everyone</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr/></w:pPr><w:r><w:t>Budget signed off</w:t></w:r></w:p>
</w:body></w:document>`;
	const zip = await createZip([
		{ name: "[Content_Types].xml", data: encoder.encode("<Types/>") },
		{ name: "word/document.xml", data: encoder.encode(xml) },
	]);
	return new File([zip.slice().buffer], name, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
};

const upload = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("Word document (.docx)"), file ?? (await makeDocx()));
	await screen.findByLabelText("Markdown");
};

const output = () => (screen.getByLabelText("Markdown") as HTMLTextAreaElement).value;

describe("word to markdown tool", () => {
	it("converts as soon as a document is chosen", async () => {
		const user = userEvent.setup();
		render(<DocxTool />);
		await upload(user);
		expect(output()).toContain("# Weekly minutes");
		expect(output()).toContain("Attendees: **everyone**");
		expect(output()).toContain("- Budget signed off");
	});

	it("re-runs when the format switches", async () => {
		const user = userEvent.setup();
		render(<DocxTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect((screen.getByLabelText("Plain text") as HTMLTextAreaElement).value).toBe("Weekly minutes\n\nAttendees: everyone\n\nBudget signed off");
	});

	it("offers the converted file to download", async () => {
		const user = userEvent.setup();
		render(<DocxTool />);
		await upload(user);
		const link = await screen.findByRole("link", { name: "Download minutes.md" });
		expect(link).toHaveProperty("download", "minutes.md");
		const blob = objectUrls.get(link.getAttribute("href") ?? "");
		expect(await (blob as Blob).text()).toContain("# Weekly minutes");
	});

	it("explains a file that will not open", async () => {
		render(<DocxTool />);
		const input = screen.getByLabelText("Word document (.docx)");
		Object.defineProperty(input, "files", { configurable: true, value: [new File([new Uint8Array([1, 2, 3, 4])], "old.doc", { type: "application/msword" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toMatch(/Only \.docx files work/u);
	});

	it("clears the result", async () => {
		const user = userEvent.setup();
		render(<DocxTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "Clear" }));
		expect(screen.queryByLabelText("Markdown")).toBeNull();
	});
});
