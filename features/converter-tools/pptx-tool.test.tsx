import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { PptxTool } from "@/features/converter-tools/pptx-tool";

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
			objectUrls.set(`blob:deck/${next}`, blob);
			return `blob:deck/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const slideXml = (title: string, bullets: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld><p:spTree>
		<p:sp><p:nvSpPr><p:nvPr><p:ph type="title" /></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${title}</a:t></a:r></a:p></p:txBody></p:sp>
		<p:sp><p:txBody>${bullets.map((bullet) => `<a:p><a:r><a:t>${bullet}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>
	</p:spTree></p:cSld>
</p:sld>`;

const deck = async (name = "quarterly.pptx") => {
	const zip = await createZip(
		[
			{ name: "ppt/slides/slide1.xml", data: encoder.encode(slideXml("Why we are here", ["The quarter in numbers", "What changed"])) },
			{ name: "ppt/slides/slide2.xml", data: encoder.encode(slideXml("Next steps", ["Ship the beta"])) },
		],
		{ compress: false },
	);
	return new File([zip.slice().buffer], name, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, file?: File) => {
	await user.upload(screen.getByLabelText("PowerPoint deck (.pptx)"), file ?? (await deck()));
	await screen.findByLabelText("Result");
};

const result = () => screen.getByLabelText("Result") as HTMLTextAreaElement;

describe("powerpoint to markdown", () => {
	it("waits for a deck", () => {
		render(<PptxTool />);
		expect(screen.getByText(/Choose a deck and its words appear here/u)).toBeTruthy();
	});

	it("turns the slides into markdown", async () => {
		const user = userEvent.setup();
		render(<PptxTool />);
		await load(user);
		expect(result().value).toContain("## Slide 1: Why we are here");
		expect(result().value).toContain("- The quarter in numbers");
		expect(result().value).toContain("## Slide 2: Next steps");
		expect(screen.getByText("Slides").parentElement?.textContent).toContain("2");
	});

	it("writes plain text when asked", async () => {
		const user = userEvent.setup();
		render(<PptxTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(result().value).toContain("Slide 1 — Why we are here");
		expect(result().value).not.toContain("## ");
	});

	it("offers the markdown as a .md file", async () => {
		const user = userEvent.setup();
		render(<PptxTool />);
		await load(user);
		const link = screen.getByRole("link", { name: "Download quarterly.md" });
		expect(link).toHaveProperty("download", "quarterly.md");
		expect(link.getAttribute("href")?.startsWith("data:")).toBe(true);
	});

	it("renames the download when the format changes", async () => {
		const user = userEvent.setup();
		render(<PptxTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(screen.getByRole("link", { name: "Download quarterly.txt" })).toHaveProperty("download", "quarterly.txt");
		expect(screen.queryByRole("link", { name: "Download quarterly.md" })).toBeNull();
	});

	it("explains when the file is not a deck", async () => {
		render(<PptxTool />);
		const input = screen.getByLabelText("PowerPoint deck (.pptx)");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["notes"], "notes.ppt", { type: "application/vnd.ms-powerpoint" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toContain("not a .pptx file");
	});

	it("says plainly when the archive is damaged", async () => {
		render(<PptxTool />);
		const input = screen.getByLabelText("PowerPoint deck (.pptx)");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["not a zip"], "broken.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })] });
		fireEvent.change(input);
		await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be opened"));
	});
});
