import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetTool } from "@/features/image-tools/sheet-tool";

afterEach(cleanup);

const image = (name: string, type = "image/png") => new File([new Uint8Array([1])], name, { type });

/** Enough of a 2D context for the contact sheet, so the build path can be exercised in jsdom. */
const fakeContext = {
	beginPath: vi.fn(),
	clip: vi.fn(),
	drawImage: vi.fn(),
	fillRect: vi.fn(),
	fillText: vi.fn(),
	measureText: vi.fn(() => ({ width: 40 })),
	rect: vi.fn(),
	restore: vi.fn(),
	save: vi.fn(),
	fillStyle: "",
	font: "",
	textBaseline: "",
};

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
	HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeContext) as unknown as HTMLCanvasElement["getContext"];
	HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(new Blob(["sheet"], { type: "image/png" })));
});

vi.mock("@/features/image-tools/image-file-shared", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/features/image-tools/image-file-shared")>();
	return { ...actual, loadImage: vi.fn(async () => ({ naturalWidth: 800, naturalHeight: 600 }) as unknown as HTMLImageElement) };
});

const queue = async (user: ReturnType<typeof userEvent.setup>, count: number) => {
	await user.upload(
		screen.getByLabelText("Images for the sheet"),
		Array.from({ length: count }, (_, index) => image(`shot-${index + 1}.png`)),
	);
};

describe("contact sheet page", () => {
	it("defaults to a three-column PNG sheet with captions", () => {
		render(<SheetTool />);
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "3");
		expect(screen.getByLabelText("Cell size (px)")).toHaveProperty("value", "240");
		expect(screen.getByLabelText("Gap (px)")).toHaveProperty("value", "12");
		expect(screen.getByLabelText("Caption every picture with its file name")).toHaveProperty("checked", true);
		expect(screen.queryByLabelText(/Quality/u)).toBeNull();
		expect(screen.getByRole("button", { name: "Build contact sheet" })).toHaveProperty("disabled", true);
	});

	it("reports the grid and sheet size once images are queued", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 4);
		expect(document.body.textContent).toContain("3 × 2");
		// 3 columns of 240 px, two rows of 240 + 22 px captions, 12 px gaps, 24 px padding.
		expect(document.body.textContent).toContain("792 × 584 px");
		expect(screen.getByRole("button", { name: "Build contact sheet" })).toHaveProperty("disabled", false);
	});

	it("still changes columns once images are selected", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 4);
		await user.selectOptions(screen.getByLabelText("Columns"), "2");
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "2");
		expect(document.body.textContent).toContain("2 × 2");
		await user.selectOptions(screen.getByLabelText("Columns"), "6");
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "6");
		expect(document.body.textContent).toContain("6 × 1");
	});

	it("keeps a wide column choice even with a single picture", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 1);
		await user.selectOptions(screen.getByLabelText("Columns"), "4");
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "4");
		expect(document.body.textContent).toContain("4 × 1");
	});

	it("reshapes the sheet when the cell size or gap changes", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 4);
		const cell = screen.getByLabelText("Cell size (px)");
		fireEvent.change(cell, { target: { value: "120" } });
		fireEvent.change(screen.getByLabelText("Gap (px)"), { target: { value: "0" } });
		expect(screen.getByLabelText("Cell size (px)")).toHaveProperty("value", "120");
		// 3 columns of 120 px, 2 rows of 120 + 22 px, no gaps, 24 px padding.
		expect(document.body.textContent).toContain("408 × 332 px");
		// Values outside the allowed range are pulled back to the edges.
		fireEvent.change(cell, { target: { value: "5000" } });
		expect(screen.getByLabelText("Cell size (px)")).toHaveProperty("value", "1200");
	});

	it("drops the caption strip when captions are turned off", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 4);
		expect(document.body.textContent).toContain("792 × 584 px");
		await user.click(screen.getByLabelText("Caption every picture with its file name"));
		expect(document.body.textContent).toContain("792 × 540 px");
		await user.click(screen.getByLabelText("Caption every picture with its file name"));
		expect(document.body.textContent).toContain("792 × 584 px");
	});

	it("only offers a quality slider for lossy formats", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		const format = screen.getByLabelText("Output format");
		await user.selectOptions(format, "image/jpeg");
		const quality = screen.getByLabelText("Quality (90%)");
		expect(quality).toHaveProperty("value", "90");
		fireEvent.change(quality, { target: { value: "60" } });
		expect(screen.getByLabelText("Quality (60%)")).toHaveProperty("value", "60");
		await user.selectOptions(format, "image/png");
		expect(screen.queryByLabelText(/Quality/u)).toBeNull();
	});

	it("changes the background colour", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await user.selectOptions(screen.getByLabelText("Background"), "#252820");
		expect(screen.getByLabelText("Background")).toHaveProperty("value", "#252820");
	});

	it("skips files that are not images", () => {
		render(<SheetTool />);
		// A browser file picker would filter these out by accept; a drag and drop would not.
		const input = screen.getByLabelText("Images for the sheet");
		Object.defineProperty(input, "files", { configurable: true, value: [image("notes.txt", "text/plain")] });
		fireEvent.change(input);
		expect(document.body.textContent).toContain("Skipped files that are not PNG");
		expect(screen.getByRole("button", { name: "Build contact sheet" })).toHaveProperty("disabled", true);
	});

	it("keeps the first 48 pictures and says so", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 49);
		expect(document.body.textContent).toContain("A sheet fits 48 images");
		expect(document.body.textContent).toContain("Pictures48");
	});

	it("builds a sheet to download and retires it when the layout changes", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await queue(user, 2);
		await user.click(screen.getByRole("button", { name: "Build contact sheet" }));
		expect(await screen.findByRole("link", { name: "Download contact-sheet-3x1.png" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Download contact-sheet-3x1.png" })).toHaveProperty("download", "contact-sheet-3x1.png");
		// A new column count makes that download wrong, so it goes.
		await user.selectOptions(screen.getByLabelText("Columns"), "2");
		expect(screen.queryByRole("link", { name: /Download contact-sheet/u })).toBeNull();
	});
});
