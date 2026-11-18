import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropTool } from "@/features/image-tools/crop-tool";
import { FaviconTool } from "@/features/image-tools/favicon-tool";
import { SvgPngTool } from "@/features/image-tools/svg-png-tool";
import { PaletteTool } from "@/features/image-tools/palette-tool";
import { MetadataTool } from "@/features/image-tools/metadata-tool";
import { FileTypeTool } from "@/features/image-tools/file-type-tool";
import { RotateTool } from "@/features/image-tools/rotate-tool";
import { WatermarkTool } from "@/features/image-tools/watermark-tool";
import { FiltersTool } from "@/features/image-tools/filters-tool";
import { StripTool } from "@/features/image-tools/strip-tool";
import { PlaceholderTool } from "@/features/image-tools/placeholder-tool";
import { ZipTool } from "@/features/image-tools/zip-tool";

afterEach(cleanup);

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

describe("image & file tools", () => {
	it("renders the cropper with its aspect presets and empty state", () => {
		render(<CropTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(document.body.textContent).toContain("largest rectangle of the chosen ratio");
		expect(screen.queryByLabelText("Aspect ratio")).toBeNull();
	});

	it("renders the favicon builder and explains the icon set", () => {
		render(<FaviconTool />);
		expect(screen.getByLabelText("Source image")).toHaveProperty("type", "file");
		expect(screen.getByLabelText("Fit the image inside the square")).toHaveProperty("type", "checkbox");
		expect(screen.getByRole("button", { name: "Generate icon set" })).toHaveProperty("disabled", true);
		expect(document.body.textContent).toContain("16, 32, 48");
	});

	it("previews the SVG export size and warnings before converting", () => {
		render(<SvgPngTool />);
		expect(screen.getByLabelText("Output width (px)")).toHaveProperty("value", "512");
		expect(document.body.textContent).toContain("512 × 512 px");
		expect(document.body.textContent).toContain("4.27×");
	});

	it("renders the palette extractor with a colour-count control", () => {
		render(<PaletteTool />);
		expect(screen.getByLabelText("Colours to extract")).toHaveProperty("value", "6");
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(document.body.textContent).toContain("median-cut");
	});

	it("renders the metadata viewer", () => {
		render(<MetadataTool />);
		expect(screen.getByLabelText("File")).toHaveProperty("type", "file");
		expect(document.body.textContent).toContain("EXIF is read straight from the JPEG markers");
	});

	it("identifies a file from its bytes and flags a renamed file", async () => {
		const user = userEvent.setup();
		render(<FileTypeTool />);
		const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
		const file = new File([pngBytes], "holiday.jpg", { type: "image/jpeg" });
		await user.upload(screen.getByLabelText("File"), file);
		expect((await screen.findAllByText(/Mismatch — the file says \.jpg, the bytes say png\./u)).length).toBeGreaterThan(0);
		expect(screen.getByText("PNG image")).toBeTruthy();
		const report = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(report).toContain("PNG image");
		expect(report).toContain("89 50 4e 47");
	});
	it("renders the rotator with its transform controls greyed out until an image loads", () => {
		render(<RotateTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(screen.queryByRole("button", { name: "Rotate left" })).toBeNull();
		expect(document.body.textContent).toContain("Quarter turns are lossless in geometry");
	});

	it("renders the watermark form with every anchor position", () => {
		render(<WatermarkTool />);
		expect(screen.getByLabelText("Watermark text")).toHaveProperty("value", "© Your name");
		const position = screen.getByLabelText("Position") as HTMLSelectElement;
		expect(position.options.length).toBe(9);
		expect(position.value).toBe("bottom-right");
		expect(screen.getByLabelText("Repeat across the whole image")).toHaveProperty("type", "checkbox");
		expect(document.body.textContent).toContain("Text uses your system sans-serif font");
	});

	it("renders the filter controls at their neutral defaults", () => {
		render(<FiltersTool />);
		expect(screen.getByLabelText("Grayscale (0%)")).toHaveProperty("value", "0");
		expect(screen.getByLabelText("Brightness (100%)")).toHaveProperty("value", "100");
		expect(screen.getByLabelText("Saturation (100%)")).toHaveProperty("value", "100");
		expect(screen.getByRole("button", { name: "Export filtered image" })).toHaveProperty("disabled", true);
		expect(screen.getByRole("button", { name: "Reset filters" })).toHaveProperty("disabled", true);
		expect(document.body.textContent).toContain("No filters applied");
	});

	it("explains that rebuilding an image strips its metadata", () => {
		render(<StripTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(screen.getByRole("button", { name: "Remove metadata" })).toHaveProperty("disabled", true);
		expect(document.body.textContent).toContain("colour profiles");
	});

	it("generates a placeholder SVG at the chosen preset size", () => {
		render(<PlaceholderTool />);
		expect(screen.getByLabelText("Size preset")).toHaveProperty("value", "social");
		expect(screen.getByLabelText("Width (px)")).toHaveProperty("value", "1200");
		expect(screen.getByLabelText("Height (px)")).toHaveProperty("value", "630");
		const svg = (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(svg).toContain('viewBox="0 0 1200 630"');
		expect(svg).toContain(">Image coming soon<");
		expect(screen.getByText("Download SVG")).toHaveProperty("download", "image-coming-soon-1200x630.svg");
	});

	it("packs several files into a downloadable zip archive", async () => {
		const user = userEvent.setup();
		render(<ZipTool />);
		const input = screen.getByLabelText("Files to include");
		await user.upload(input, [new File(["alpha"], "one.txt", { type: "text/plain" }), new File(["beta"], "two.txt", { type: "text/plain" })]);
		expect(screen.getByText("one.txt")).toBeTruthy();
		expect(screen.getByText("two.txt")).toBeTruthy();
		await user.click(screen.getByLabelText("Compress files where it helps"));
		await user.click(screen.getByRole("button", { name: "Create ZIP" }));
		const link = await screen.findByText("Download archive.zip");
		expect(link).toHaveProperty("download", "archive.zip");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("one.txt  5 bytes");
	});
});
