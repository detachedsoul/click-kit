import zlib from "node:zlib";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagesToPdfTool } from "@/features/pdf-tools/images-to-pdf-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:image/${next}`, blob);
			return `blob:image/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

/** A real, valid PNG of the given size, built by hand so the test needs no fixture files. */
const makePng = (width: number, height: number, name: string) => {
	const table = new Uint32Array(256).map((_, index) => {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		return value >>> 0;
	});
	const crc = (bytes: Uint8Array) => {
		let value = 0xffffffff;
		for (const byte of bytes) value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
		return (value ^ 0xffffffff) >>> 0;
	};
	const chunk = (type: string, data: Uint8Array) => {
		const out = new Uint8Array(12 + data.length);
		const view = new DataView(out.buffer);
		view.setUint32(0, data.length);
		out.set(new TextEncoder().encode(type), 4);
		out.set(data, 8);
		view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
		return out;
	};
	const header = new Uint8Array(13);
	const headerView = new DataView(header.buffer);
	headerView.setUint32(0, width);
	headerView.setUint32(4, height);
	header[8] = 8;
	header[9] = 2;
	const rows = new Uint8Array(height * (1 + width * 3));
	const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", new Uint8Array())];
	const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return new File([bytes], name, { type: "image/png" });
};

const load = async (user: ReturnType<typeof userEvent.setup>, files: File[]) => {
	await user.upload(screen.getByLabelText("Images, in page order"), files);
	await screen.findByRole("button", { name: "Create PDF" });
};

const build = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Create PDF" }));
	const link = await screen.findByRole("link", { name: /Download .*\.pdf$/u });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, doc: await PDFDocument.load(new Uint8Array(await blob.arrayBuffer())) };
};

const sizes = (doc: PDFDocument) => doc.getPages().map((page) => [Math.round(page.getWidth()), Math.round(page.getHeight())]);

describe("images to pdf", () => {
	it("turns one picture into one page its own size", async () => {
		const user = userEvent.setup();
		render(<ImagesToPdfTool />);
		await load(user, [makePng(120, 80, "card.png")]);
		const { link, doc } = await build(user);
		expect(link).toHaveProperty("download", "card-images.pdf");
		expect(sizes(doc)).toEqual([[120, 80]]);
	});

	it("keeps the list order after moving a picture", async () => {
		const user = userEvent.setup();
		render(<ImagesToPdfTool />);
		await load(user, [makePng(100, 100, "one.png"), makePng(200, 100, "two.png")]);
		await user.click(screen.getByRole("button", { name: "Move two.png up" }));
		expect(sizes((await build(user)).doc)).toEqual([[200, 100], [100, 100]]);
	});

	it("puts pictures on A4, upright for a tall one", async () => {
		const user = userEvent.setup();
		render(<ImagesToPdfTool />);
		await load(user, [makePng(80, 120, "tall.png")]);
		await user.selectOptions(screen.getByLabelText("Page size"), "a4");
		expect(sizes((await build(user)).doc)).toEqual([[595, 842]]);
	});

	it("drops a picture from the batch", async () => {
		const user = userEvent.setup();
		render(<ImagesToPdfTool />);
		await load(user, [makePng(10, 10, "one.png"), makePng(20, 20, "two.png")]);
		await user.click(screen.getByRole("button", { name: "Remove one.png" }));
		expect(screen.queryByText(/one\.png/u)).toBeNull();
		expect(sizes((await build(user)).doc)).toEqual([[20, 20]]);
	});

	it("warns about a file that is not an image", async () => {
		render(<ImagesToPdfTool />);
		const input = screen.getByLabelText("Images, in page order");
		Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "notes.txt", { type: "text/plain" })] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toBe("notes.txt: Choose an image file.");
		expect(screen.getByRole("button", { name: "Create PDF" })).toHaveProperty("disabled", true);
	});
});
