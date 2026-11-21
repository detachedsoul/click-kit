import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageToText } from "@/features/image-tools/image-to-text";

vi.mock("@/features/image-tools/ocr-utils", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/image-tools/ocr-utils")>()),
	makeOcrCanvas: vi.fn(() => document.createElement("canvas")),
}));
vi.mock("tesseract.js", () => ({
	OEM: { LSTM_ONLY: 1 },
	createWorker: vi.fn(async (_language: string, _oem: number, options: { logger: (message: { status: string; progress: number }) => void }) => {
		options.logger({ status: "recognizing text", progress: 0.5 });
		return { recognize: vi.fn(async () => ({ data: { text: "Hello from OCR" } })), terminate: vi.fn(async () => undefined) };
	}),
}));

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:ocr-test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});
const NativeImage = window.Image;
afterEach(() => { cleanup(); Object.defineProperty(window, "Image", { configurable: true, value: NativeImage }); });

describe("image to text OCR tool", () => {
	it("accepts an uploaded image and exposes language, rotation, crop, and preprocessing controls", () => {
		render(<ImageToText />);
		const file = new File(["image bytes"], "receipt.png", { type: "image/png" });
		fireEvent.change(screen.getByLabelText("Choose an image"), { target: { files: [file] } });
		expect(screen.getByLabelText("Text language")).toHaveProperty("value", "eng");
		expect(screen.getByRole("button", { name: "Rotate 90°" })).toBeTruthy();
		expect(screen.getByLabelText("Crop left percent")).toHaveProperty("value", "0");
		expect(screen.getByLabelText("Crop width percent")).toHaveProperty("value", "100");
		const thresholdToggle = screen.getByLabelText("Improve contrast with black-and-white thresholding");
		expect(thresholdToggle.className).toContain("checkbox-input");
		expect(screen.queryByText(/Web Worker|language model is downloaded|cached by Tesseract|is uploaded/u)).toBeNull();
		expect(screen.getByRole("button", { name: "Extract text" })).toHaveProperty("disabled", false);
	});

	it("runs the selected OCR language and offers editable text and a TXT download", async () => {
		class LoadedImage {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			naturalWidth = 320;
			naturalHeight = 200;
			set src(_value: string) { this.onload?.(); }
		}
		Object.defineProperty(window, "Image", { configurable: true, value: LoadedImage as unknown as typeof Image });
		const { default: userEvent } = await import("@testing-library/user-event");
		const user = userEvent.setup();
		render(<ImageToText />);
		const file = new File(["image bytes"], "receipt.png", { type: "image/png" });
		fireEvent.change(screen.getByLabelText("Choose an image"), { target: { files: [file] } });
		await user.selectOptions(screen.getByLabelText("Text language"), "fra");
		await user.click(screen.getByRole("button", { name: "Extract text" }));
		const result = await screen.findByLabelText("Extracted text");
		expect(result).toHaveProperty("value", "Hello from OCR");
		expect((await screen.findByRole("link", { name: "Download TXT" })).getAttribute("download")).toBe("receipt-text.txt");
	});

	it("documents a keyboard paste target for screenshots", () => {
		render(<ImageToText />);
		expect(screen.getByLabelText("Paste screenshot here").getAttribute("tabindex")).toBe("0");
		expect(screen.getByText(/Paste a screenshot here with Ctrl\+V/u)).toBeTruthy();
	});
});
