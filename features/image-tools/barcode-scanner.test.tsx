import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "@/features/image-tools/barcode-scanner";
import { HISTORY_KEY, makeScan } from "@/features/image-tools/scan-utils";

const decoder = vi.hoisted(() => ({
	decodeSource: vi.fn(async () => [] as { format: string; value: string }[]),
	openCamera: vi.fn(),
	readImageFile: vi.fn(),
	setTorch: vi.fn(async () => true),
	supportsTorch: vi.fn(() => false),
}));

vi.mock("@/features/image-tools/scan-decoder", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/image-tools/scan-decoder")>()),
	...decoder,
}));

const store = new Map<string, string>();

const stopped = vi.fn();

/** One stream, with spies that stay put: a camera is a thing, not a factory. */
const fakeStream = () =>
	({
		getTracks: () => [{ stop: stopped }],
		getVideoTracks: () => [{ applyConstraints: vi.fn(), getCapabilities: () => ({ torch: true }), stop: stopped }],
	}) as unknown as MediaStream;

beforeEach(() => {
	store.clear();
	vi.stubGlobal("localStorage", {
		clear: () => store.clear(),
		getItem: (key: string) => store.get(key) ?? null,
		removeItem: (key: string) => store.delete(key),
		setItem: (key: string, value: string) => store.set(key, value),
	});
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } });
	decoder.decodeSource.mockResolvedValue([]);
	decoder.openCamera.mockResolvedValue(fakeStream());
	decoder.supportsTorch.mockReturnValue(false);
	decoder.setTorch.mockResolvedValue(true);
	stopped.mockClear();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const setup = () => {
	const user = userEvent.setup();
	render(<BarcodeScanner />);
	return user;
};

/** The result panel, which is where a fresh scan is shown. */
const authoritative = () => document.querySelector("section[aria-live='polite']");

const uploadPicture = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("button", { name: "Picture" }));
	const file = new File([new Uint8Array([1, 2, 3])], "code.png", { type: "image/png" });
	await user.upload(screen.getByLabelText(/Picture of a code/u), file);
};

describe("the barcode scanner", () => {
	it("starts on the camera and asks for it only when told to", async () => {
		const user = await setup();
		expect(screen.getByText(/Point the camera at a QR code/u)).toBeTruthy();
		expect(decoder.openCamera).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Start camera" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Stop camera" })).toBeTruthy());
		expect(decoder.openCamera).toHaveBeenCalledTimes(1);

		await user.click(screen.getByRole("button", { name: "Stop camera" }));
		expect(screen.getByRole("button", { name: "Start camera" })).toBeTruthy();
	});

	it("explains a refused camera instead of failing silently", async () => {
		decoder.openCamera.mockRejectedValue({ name: "NotAllowedError" });
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Start camera" }));
		expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Camera access was refused"));
		expect(screen.getByRole("button", { name: "Start camera" })).toBeTruthy();
	});

	it("offers the light only where the camera has one", async () => {
		decoder.supportsTorch.mockReturnValue(true);
		const user = await setup();
		expect(screen.queryByRole("button", { name: /Turn light on/u })).toBeNull();
		await user.click(screen.getByRole("button", { name: "Start camera" }));
		await user.click(await screen.findByRole("button", { name: /Turn light on/u }));
		expect(decoder.setTorch).toHaveBeenCalledWith(expect.anything(), true);
		expect(await screen.findByRole("button", { name: /Turn light off/u })).toBeTruthy();
	});

	it("reads a code out of an uploaded picture and offers the link", async () => {
		decoder.readImageFile.mockResolvedValue([{ format: "qr_code", value: "https://example.com/hello" }]);
		const user = await setup();
		await uploadPicture(user);

		expect(await screen.findByRole("heading", { name: "Your scan" })).toBeTruthy();
		expect(authoritative()?.textContent).toContain("https://example.com/hello");
		expect(screen.getByText("Format").parentElement?.textContent).toContain("QR code");
		expect(screen.getByText("Contains").parentElement?.textContent).toContain("Web link");
		expect(screen.getByText("Read from").parentElement?.textContent).toContain("Picture");
		const link = screen.getByRole("link", { name: /Open link/u });
		expect(link.getAttribute("href")).toBe("https://example.com/hello");
		expect(link.getAttribute("target")).toBe("_blank");
	});

	it("copies the value and keeps the scan in the history", async () => {
		decoder.readImageFile.mockResolvedValue([{ format: "ean_13", value: "4901234567894" }]);
		const user = await setup();
		await uploadPicture(user);

		expect(await screen.findByRole("heading", { name: "Your scan" })).toBeTruthy();
		expect(authoritative()?.textContent).toContain("4901234567894");
		expect(screen.getAllByText(/1 scan kept on this device/u).length).toBe(1);
		expect(screen.getByText("Format").parentElement?.textContent).toContain("EAN-13");
		// A number is not a link, so nothing offers to open one.
		expect(screen.queryByRole("link", { name: /Open link/u })).toBeNull();

		const [copy] = screen.getAllByRole("button", { name: "Copy" });
		await user.click(copy);
		// userEvent keeps its own clipboard, so read back what the button wrote.
		expect(await navigator.clipboard.readText()).toBe("4901234567894");
		expect(JSON.parse(store.get(HISTORY_KEY) ?? "[]")).toHaveLength(1);
	});

	it("keeps every code found in one picture", async () => {
		decoder.readImageFile.mockResolvedValue([
			{ format: "qr_code", value: "https://one.example" },
			{ format: "code_128", value: "PARCEL-42" },
		]);
		const user = await setup();
		await uploadPicture(user);
		expect(await screen.findByText(/2 scans kept on this device/u)).toBeTruthy();
		// The first code stays the one on display.
		expect(authoritative()?.textContent).toContain("https://one.example");
		expect(authoritative()?.textContent).toContain("QR code");
	});

	it("says so when a picture holds no code", async () => {
		decoder.readImageFile.mockResolvedValue([]);
		const user = await setup();
		await uploadPicture(user);
		expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("No barcode or QR code was found"));
		expect(screen.queryByRole("heading", { name: "Your scan" })).toBeNull();
	});

	it("keeps the history on the device and clears it when asked", async () => {
		store.set(HISTORY_KEY, JSON.stringify([makeScan("https://example.com/kept", "qr_code", "camera")]));
		const user = await setup();
		expect(screen.getByText(/1 scan kept on this device/u)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("https://example.com/kept");

		await user.click(screen.getByRole("button", { name: "Clear history" }));
		expect(store.get(HISTORY_KEY)).toBe("[]");
		expect(screen.getByText(/No scans yet/u)).toBeTruthy();
	});

	it("stops the camera when the visitor moves to a picture", async () => {
		const user = await setup();
		await user.click(screen.getByRole("button", { name: "Start camera" }));
		await waitFor(() => expect(screen.getByRole("button", { name: "Stop camera" })).toBeTruthy());
		await user.click(screen.getByRole("button", { name: "Picture" }));
		expect(stopped).toHaveBeenCalled();
	});
});
