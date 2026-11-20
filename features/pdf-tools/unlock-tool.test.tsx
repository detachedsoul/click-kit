import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfUnlockTool } from "@/features/pdf-tools/unlock-tool";

const pdfPageCount = vi.fn();
const renderPageImages = vi.fn();

vi.mock("@/features/pdf-tools/pdf-render", () => ({
	pdfPageCount: (...args: Parameters<typeof pdfPageCount>) => pdfPageCount(...args),
	renderPageImages: (...args: Parameters<typeof renderPageImages>) => renderPageImages(...args),
}));

const JPEG = new Blob([Uint8Array.from(atob(`/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==`), (char) => char.charCodeAt(0))], { type: "image/jpeg" });

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	pdfPageCount.mockReset();
	renderPageImages.mockReset();
	renderPageImages.mockImplementation(async (_bytes: Uint8Array, pages: number[]) => pages.map((page) => ({ page, blob: JPEG })));
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

const upload = async (user: ReturnType<typeof userEvent.setup>) => {
	const doc = await PDFDocument.create();
	doc.addPage([300, 400]);
	await user.upload(screen.getByLabelText("Password-protected PDF"), new File([new Uint8Array(await doc.save())], "locked.pdf", { type: "application/pdf" }));
	await screen.findByRole("button", { name: "Check the password" });
};

describe("pdf unlock", () => {
	it("asks for a password and says how many pages it found", async () => {
		pdfPageCount.mockResolvedValue(2);
		const user = userEvent.setup();
		render(<PdfUnlockTool />);
		await upload(user);
		await user.type(screen.getByLabelText("Password"), "secret");
		await user.click(screen.getByRole("button", { name: "Check the password" }));
		expect(pdfPageCount).toHaveBeenCalledWith(expect.any(Uint8Array), "secret");
		expect(await screen.findByRole("button", { name: "Make an unlocked copy" })).toBeTruthy();
		expect(screen.getByText("Opens with").parentElement?.textContent).toContain("That password");
	});

	it("says plainly when the password is wrong", async () => {
		pdfPageCount.mockRejectedValue(new Error("No password given"));
		const user = userEvent.setup();
		render(<PdfUnlockTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "Check the password" }));
		expect((await screen.findByRole("alert")).textContent).toMatch(/password does not open this file/u);
		expect(screen.queryByRole("button", { name: "Make an unlocked copy" })).toBeNull();
	});

	it("builds an unlocked copy at the chosen quality", async () => {
		pdfPageCount.mockResolvedValue(2);
		const user = userEvent.setup();
		render(<PdfUnlockTool />);
		await upload(user);
		await user.type(screen.getByLabelText("Password"), "secret");
		await user.click(screen.getByRole("button", { name: "Check the password" }));
		await user.selectOptions(screen.getByLabelText("Picture quality for the copy"), "200");
		await user.click(screen.getByRole("button", { name: "Make an unlocked copy" }));
		const link = await screen.findByRole("link", { name: /Download locked-unlocked\.pdf$/u });
		expect(link).toHaveProperty("download", "locked-unlocked.pdf");
		expect(renderPageImages).toHaveBeenCalledWith(expect.any(Uint8Array), [1, 2], expect.objectContaining({ password: "secret", scale: 200 / 72 }));
		const blob = objectUrls.get(link.getAttribute("href") ?? "");
		const doc = await PDFDocument.load(new Uint8Array(await (blob as Blob).arrayBuffer()));
		expect(doc.getPageCount()).toBe(2);
	});

	it("tries an empty password for files that only restrict copying", async () => {
		pdfPageCount.mockResolvedValue(1);
		const user = userEvent.setup();
		render(<PdfUnlockTool />);
		await upload(user);
		await user.click(screen.getByRole("button", { name: "Check the password" }));
		expect(pdfPageCount).toHaveBeenCalledWith(expect.any(Uint8Array), "");
		expect(await screen.findByText("No password")).toBeTruthy();
	});
});
