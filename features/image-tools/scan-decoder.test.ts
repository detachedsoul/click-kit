import * as zxingPackage from "@zxing/library";
import QRCode from "qrcode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cameraNote, decodePixels, luminance, supportsTorch, type Pixels, type Zxing } from "@/features/image-tools/scan-decoder";

/** In the app zxing arrives as a script; in a test it is already here, so the loader is handed over. */
const load = async () => zxingPackage as unknown as Zxing;

/**
 * A QR code as pixels, drawn the way a camera would see it: black modules on white, with the quiet
 * zone that tells a reader where the code starts and stops. Generated here rather than shipped as a
 * fixture, so the test proves the decoder against text it has never seen.
 */
const qrPixels = (text: string, scale = 4, quiet = 4): Pixels => {
	const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
	const size = qr.modules.size;
	const side = (size + quiet * 2) * scale;
	const data = new Uint8ClampedArray(side * side * 4).fill(255);
	for (let row = 0; row < size; row += 1) {
		for (let column = 0; column < size; column += 1) {
			if (!qr.modules.get(row, column)) continue;
			for (let y = 0; y < scale; y += 1) {
				for (let x = 0; x < scale; x += 1) {
					const pixel = ((row + quiet) * scale + y) * side + (column + quiet) * scale + x;
					data[pixel * 4] = 0;
					data[pixel * 4 + 1] = 0;
					data[pixel * 4 + 2] = 0;
					data[pixel * 4 + 3] = 255;
				}
			}
		}
	}
	return { data, height: side, width: side };
};

describe("reading pixels", () => {
	it("finds the text in a QR code drawn as pixels", async () => {
		const found = await decodePixels(qrPixels("https://clickkit.tools/qr"), load);
		expect(found).toEqual([{ format: "qr_code", value: "https://clickkit.tools/qr" }]);
	});

	it("reads a code that carries nothing but text", async () => {
		const found = await decodePixels(qrPixels("the quick brown fox"), load);
		expect(found).toEqual([{ format: "qr_code", value: "the quick brown fox" }]);
	});

	it("returns nothing for a picture with no code in it", async () => {
		const blank: Pixels = { data: new Uint8ClampedArray(40 * 40 * 4).fill(255), height: 40, width: 40 };
		expect(await decodePixels(blank, load)).toEqual([]);
	});

	it("refuses pixels that do not fill the picture", async () => {
		expect(await decodePixels({ data: new Uint8ClampedArray(4), height: 10, width: 10 }, load)).toEqual([]);
	});

	it("turns colour into the grey a decoder thinks in", () => {
		const red = luminance({ data: new Uint8ClampedArray([255, 0, 0, 255]), height: 1, width: 1 });
		expect(red[0]).toBe(76);
		const green = luminance({ data: new Uint8ClampedArray([0, 255, 0, 255]), height: 1, width: 1 });
		expect(green[0]).toBe(149);
		const white = luminance({ data: new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]), height: 1, width: 2 });
		expect(Array.from(white)).toEqual([255, 255]);
	});
});

describe("camera trouble", () => {
	it("turns a refused permission into something a visitor can act on", () => {
		expect(cameraNote({ name: "NotAllowedError" })).toContain("Camera access was refused");
		expect(cameraNote({ name: "NotAllowedError" })).toContain("upload a picture");
		expect(cameraNote({ name: "NotFoundError" })).toContain("No camera answered");
		expect(cameraNote({ name: "NotReadableError" })).toContain("busy in another app");
		expect(cameraNote(new Error("Something odd happened"))).toBe("Something odd happened");
		expect(cameraNote(undefined)).toContain("could not be started");
	});

	it("only offers a torch where the camera says it has one", () => {
		const withTorch = { getVideoTracks: () => [{ getCapabilities: () => ({ torch: true }) }] } as unknown as MediaStream;
		const withoutTorch = { getVideoTracks: () => [{ getCapabilities: () => ({}) }] } as unknown as MediaStream;
		const noCapabilities = { getVideoTracks: () => [{}] } as unknown as MediaStream;
		expect(supportsTorch(withTorch)).toBe(true);
		expect(supportsTorch(withoutTorch)).toBe(false);
		expect(supportsTorch(noCapabilities)).toBe(false);
		expect(supportsTorch(null)).toBe(false);
	});
});

describe("the decoder script", () => {
	const scriptOf = () => document.head.querySelector<HTMLScriptElement>('script[src="/zxing/index.min.js"]');
	const scriptsOf = () => document.head.querySelectorAll<HTMLScriptElement>('script[src="/zxing/index.min.js"]');
	const fakeZxing = { BarcodeFormat: {}, DecodeHintType: {}, MultiFormatReader: class {} } as unknown as Zxing;

	/** A fresh copy of the module, so one test cannot inherit the promise another one cached. */
	const freshLoader = async () => {
		vi.resetModules();
		const fresh = await import("@/features/image-tools/scan-decoder");
		return fresh.loadZxing;
	};

	beforeEach(() => {
		document.head.innerHTML = "";
		delete (globalThis as { ZXing?: Zxing }).ZXing;
	});

	it("fetches the decoder once and hands the same copy to every caller", async () => {
		const load = await freshLoader();
		const first = load();
		const script = scriptOf();
		expect(script).not.toBeNull();
		expect(script?.async).toBe(true);

		(globalThis as { ZXing?: Zxing }).ZXing = fakeZxing;
		script?.onload?.call(script, new Event("load"));
		expect(await first).toBe(fakeZxing);

		// A second code, a second scan: no second download.
		expect(await load()).toBe(fakeZxing);
		expect(scriptsOf()).toHaveLength(1);
	});

	it("does not download anything when the decoder is already on the page", async () => {
		const load = await freshLoader();
		(globalThis as { ZXing?: Zxing }).ZXing = fakeZxing;
		expect(await load()).toBe(fakeZxing);
		expect(scriptOf()).toBeNull();
	});

	it("gives up on a download that fails, and tries again next time", async () => {
		const load = await freshLoader();
		const first = load();
		const script = scriptOf();
		script?.onerror?.call(script, new Event("error"));
		await expect(first).rejects.toThrow(/could not be downloaded/u);

		// The failure is not remembered: a fresh attempt asks for the script again.
		const retry = load();
		expect(scriptsOf()).toHaveLength(2);
		const second = scriptsOf()[1];
		(globalThis as { ZXing?: Zxing }).ZXing = fakeZxing;
		second.onload?.call(second, new Event("load"));
		await expect(retry).resolves.toBe(fakeZxing);
	});

	it("complains when the script runs but registers nothing", async () => {
		const load = await freshLoader();
		const pending = load();
		const script = scriptOf();
		script?.onload?.call(script, new Event("load"));
		await expect(pending).rejects.toThrow(/did not start/u);
	});
});
