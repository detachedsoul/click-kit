import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfMetadataTool } from "@/features/pdf-tools/metadata-tool";
import { splitKeywords } from "@/features/pdf-tools/pdf-utils";

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

const makePdf = async () => {
	const doc = await PDFDocument.create();
	doc.setTitle("Old title");
	doc.setAuthor("Old author");
	doc.setSubject("Old subject");
	doc.setKeywords(["old", "words"]);
	doc.addPage([300, 400]);
	return new File([new Uint8Array(await doc.save())], "brief.pdf", { type: "application/pdf" });
};

const load = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("PDF to describe"), await makePdf());
	await screen.findByRole("button", { name: "Save details" });
};

const save = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Save details" }));
	const link = await screen.findByRole("link", { name: /Download brief-tagged\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

describe("pdf metadata editor", () => {
	it("loads the details the file already has", async () => {
		const user = userEvent.setup();
		render(<PdfMetadataTool />);
		await load(user);
		expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Old title");
		expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("Old author");
		expect((screen.getByLabelText("Keywords") as HTMLInputElement).value).toBe("old, words");
	});

	it("saves edited details into a new file", async () => {
		const user = userEvent.setup();
		render(<PdfMetadataTool />);
		await load(user);
		const title = screen.getByLabelText("Title");
		await user.clear(title);
		await user.type(title, "Quarterly brief");
		const keywords = screen.getByLabelText("Keywords");
		await user.clear(keywords);
		await user.type(keywords, "money, plans");
		const { link, doc } = await save(user);
		expect(link).toHaveProperty("download", "brief-tagged.pdf");
		expect(doc.getTitle()).toBe("Quarterly brief");
		expect(splitKeywords(doc.getKeywords())).toEqual(["money", "plans"]);
	});

	it("clears every field at once", async () => {
		const user = userEvent.setup();
		render(<PdfMetadataTool />);
		await load(user);
		await user.click(screen.getByRole("button", { name: "Clear all fields" }));
		expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");
		const { doc } = await save(user);
		expect(doc.getTitle()).toBe("");
		expect(screen.getByText("Every field cleared")).toBeTruthy();
	});

	it("counts filled fields as they change", async () => {
		const user = userEvent.setup();
		render(<PdfMetadataTool />);
		await load(user);
		expect(screen.getByText("Filled").parentElement?.textContent).toContain("4/4");
		await user.click(screen.getByRole("button", { name: "Clear all fields" }));
		expect(screen.getByText("Filled").parentElement?.textContent).toContain("0/4");
	});
});
