import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CropTool } from "@/features/image-tools/crop-tool";
import { FaviconTool } from "@/features/image-tools/favicon-tool";
import { SvgPngTool } from "@/features/image-tools/svg-png-tool";
import { PaletteTool } from "@/features/image-tools/palette-tool";
import { MetadataTool } from "@/features/image-tools/metadata-tool";
import { FileTypeTool } from "@/features/image-tools/file-type-tool";

afterEach(cleanup);

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
});
