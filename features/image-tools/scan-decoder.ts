/**
 * Reading codes: the browser's own `BarcodeDetector` when it exists, zxing when it does not.
 *
 * The detector API is the fast path and it is not everywhere — Firefox and Safari do not ship it,
 * and on Android it is often the only one that can use the camera's own hardware. So it is tried
 * first and zxing picks up the pieces.
 *
 * zxing is a script in `public/zxing/`, fetched the first time a code actually needs reading on a
 * browser that cannot read it alone. Bundling it would put a megabyte of barcode readers on every
 * other tool page, and on Chrome and Android it would never be used.
 */

import { normaliseFormat, scaledTo, WANTED_FORMATS, type ScanFormat } from "@/features/image-tools/scan-utils";

export type Raw = { format: ScanFormat; value: string };
export type Pixels = { data: Uint8ClampedArray; height: number; width: number };

type DetectorResult = { format: string; rawValue: string };
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectorResult[]> };
type DetectorApi = (new (options?: { formats?: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> };

const detectorApi = () => (globalThis as { BarcodeDetector?: DetectorApi }).BarcodeDetector ?? null;

export const hasNativeDetector = () => detectorApi() !== null;

/** Undetectable pixels are the decoder's problem, not the visitor's: a failed frame is an empty frame. */
const EMPTY: Raw[] = [];

/** The browser's own detector, asked only for the formats it says it knows. */
const nativeDecode = async (source: CanvasImageSource): Promise<Raw[]> => {
	const Api = detectorApi();
	if (!Api) return EMPTY;
	try {
		const known = typeof Api.getSupportedFormats === "function" ? await Api.getSupportedFormats() : null;
		const formats = known ? WANTED_FORMATS.filter((format) => known.includes(format)) : WANTED_FORMATS;
		if (!formats.length) return EMPTY;
		const found = await new Api({ formats }).detect(source);
		return found.map((detection) => ({ format: normaliseFormat(detection.format), value: detection.rawValue })).filter((raw) => raw.value.length > 0);
	} catch {
		return EMPTY;
	}
};

/**
 * Grey, weighted for the way an eye favours green. Barcode reading is only ever about dark and
 * light, so colour is thrown away once, here, rather than in every decoder.
 */
export const luminance = ({ data, height, width }: Pixels) => {
	const grey = new Uint8ClampedArray(width * height);
	for (let pixel = 0; pixel < grey.length; pixel += 1) {
		const at = pixel * 4;
		grey[pixel] = ((data[at] ?? 0) * 77 + (data[at + 1] ?? 0) * 150 + (data[at + 2] ?? 0) * 29) >> 8;
	}
	return grey;
};

/** The part of zxing this file uses, so the script can be swapped without a type from the package. */
type ZxingReader = { decode: (bitmap: unknown, hints: Map<unknown, unknown>) => { getBarcodeFormat: () => number; getText: () => string } };
export type Zxing = {
	BarcodeFormat: Record<string, number>;
	BinaryBitmap: new (source: unknown) => unknown;
	DecodeHintType: { POSSIBLE_FORMATS: unknown; TRY_HARDER: unknown };
	HybridBinarizer: new (source: unknown) => unknown;
	MultiFormatReader: new () => ZxingReader;
	RGBLuminanceSource: new (grey: Uint8ClampedArray, width: number, height: number) => unknown;
};

export type ZxingLoader = () => Promise<Zxing>;

let pending: Promise<Zxing> | null = null;

/** Fetch the decoder script once, and hand every later caller the same copy. */
export const loadZxing: ZxingLoader = () => {
	if (pending) return pending;
	pending = new Promise<Zxing>((resolve, reject) => {
		const already = (globalThis as { ZXing?: Zxing }).ZXing;
		if (already) {
			resolve(already);
			return;
		}
		const script = document.createElement("script");
		script.src = "/zxing/index.min.js";
		script.async = true;
		script.onload = () => {
			const loaded = (globalThis as { ZXing?: Zxing }).ZXing;
			if (loaded) resolve(loaded);
			else reject(new Error("The barcode decoder loaded but did not start. Try again."));
		};
		script.onerror = () => reject(new Error("The barcode decoder could not be downloaded. Check the connection and try again."));
		document.head.append(script);
	});
	// A failed download should not be remembered as a failure: the next attempt gets a new script.
	pending = pending.catch((error: unknown) => {
		pending = null;
		throw error;
	});
	return pending;
};

/** One pass of the JavaScript decoder over a grey image: the fallback, and the only path on Safari. */
export const decodePixels = async (pixels: Pixels, load: ZxingLoader = loadZxing): Promise<Raw[]> => {
	if (!pixels.width || !pixels.height || pixels.data.length < pixels.width * pixels.height * 4) return EMPTY;
	const zxing = await load();
	const formats: Record<number, ScanFormat> = {
		[zxing.BarcodeFormat.AZTEC]: "aztec",
		[zxing.BarcodeFormat.CODABAR]: "codabar",
		[zxing.BarcodeFormat.CODE_39]: "code_39",
		[zxing.BarcodeFormat.CODE_128]: "code_128",
		[zxing.BarcodeFormat.DATA_MATRIX]: "data_matrix",
		[zxing.BarcodeFormat.EAN_8]: "ean_8",
		[zxing.BarcodeFormat.EAN_13]: "ean_13",
		[zxing.BarcodeFormat.ITF]: "itf",
		[zxing.BarcodeFormat.PDF_417]: "pdf417",
		[zxing.BarcodeFormat.QR_CODE]: "qr_code",
		[zxing.BarcodeFormat.UPC_A]: "upc_a",
		[zxing.BarcodeFormat.UPC_E]: "upc_e",
	};
	try {
		const hints = new Map();
		hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
			zxing.BarcodeFormat.QR_CODE,
			zxing.BarcodeFormat.EAN_13,
			zxing.BarcodeFormat.EAN_8,
			zxing.BarcodeFormat.UPC_A,
			zxing.BarcodeFormat.UPC_E,
			zxing.BarcodeFormat.CODE_128,
			zxing.BarcodeFormat.CODE_39,
		]);
		hints.set(zxing.DecodeHintType.TRY_HARDER, true);
		const reader = new zxing.MultiFormatReader();
		const source = new zxing.RGBLuminanceSource(luminance(pixels), pixels.width, pixels.height);
		const result = reader.decode(new zxing.BinaryBitmap(new zxing.HybridBinarizer(source)), hints);
		const value = result.getText();
		if (!value) return EMPTY;
		return [{ format: formats[result.getBarcodeFormat()] ?? "other", value }];
	} catch {
		// A frame with no code in it is the normal case, not an error.
		return EMPTY;
	}
};

/** One scratch canvas, reused: a live camera asks for pixels three times a second. */
let scratch: HTMLCanvasElement | null = null;

const scratchCanvas = () => {
	if (!scratch) scratch = document.createElement("canvas");
	return scratch;
};

/** Any picture — a video frame, a canvas, an upload — as pixels a decoder can read. */
export const pixelsOf = (source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap): Pixels | null => {
	const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
	const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
	if (!width || !height) return null;
	const size = scaledTo(width, height, 1600);
	const canvas = scratchCanvas();
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return null;
	// Transparent corners of a PNG read as black, which is the same as a dark barcode bar. White fakes honesty.
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, size.width, size.height);
	context.drawImage(source, 0, 0, size.width, size.height);
	const image = context.getImageData(0, 0, size.width, size.height);
	return { data: image.data, height: size.height, width: size.width };
};

/** A camera frame or a drawn canvas, through whichever decoder this browser has. */
export const decodeSource = async (source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap): Promise<Raw[]> => {
	const native = await nativeDecode(source);
	if (native.length) return native;
	const pixels = pixelsOf(source);
	return pixels ? decodePixels(pixels) : EMPTY;
};

/** A picture from the file picker. Bitmaps are cheaper than an `<img>` and can be released. */
const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
	if (typeof createImageBitmap === "function") {
		try {
			return await createImageBitmap(file);
		} catch {
			// SVG and a few odd formats cannot become a bitmap; the <img> route still can.
		}
	}
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		return image;
	} finally {
		// The image has already been decoded into memory, so the URL is no longer needed.
		URL.revokeObjectURL(url);
	}
};

export const readImageFile = async (file: File): Promise<Raw[]> => {
	const bitmap = await loadBitmap(file);
	const width = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
	const height = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
	const size = scaledTo(width, height, 1600);
	const canvas = document.createElement("canvas");
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) throw new Error("This browser cannot read pictures. Try a different one.");
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, size.width, size.height);
	context.drawImage(bitmap, 0, 0, size.width, size.height);
	if ("close" in bitmap) bitmap.close();
	const native = await nativeDecode(canvas);
	if (native.length) return native;
	const image = context.getImageData(0, 0, size.width, size.height);
	return decodePixels({ data: image.data, height: size.height, width: size.width });
};

export const openCamera = async (): Promise<MediaStream> => {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
		throw new Error("This browser cannot open a camera. Upload a picture of the code instead.");
	}
	return navigator.mediaDevices.getUserMedia({
		audio: false,
		video: { facingMode: { ideal: "environment" }, height: { ideal: 720 }, width: { ideal: 1280 } },
	});
};

/** Whatever went wrong with the camera, in words a visitor can act on. */
export const cameraNote = (error: unknown): string => {
	const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name: unknown }).name) : "";
	if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
		return "Camera access was refused. Allow the camera for this site in your browser settings, then start it again — or upload a picture of the code instead.";
	}
	if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
		return "No camera answered. Check that one is connected and not in use by another app, or upload a picture of the code instead.";
	}
	if (name === "NotReadableError" || name === "TrackStartError") return "The camera is busy in another app. Close it and try again.";
	if (error instanceof Error && error.message) return error.message;
	return "The camera could not be started. Upload a picture of the code instead.";
};

/** A torch is only worth a button where the camera admits it has one. */
export const supportsTorch = (stream: MediaStream | null) => {
	const track = stream?.getVideoTracks()[0];
	const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
	return capabilities?.torch === true;
};

export const setTorch = async (stream: MediaStream | null, on: boolean) => {
	const track = stream?.getVideoTracks()[0];
	if (!track || typeof track.applyConstraints !== "function") return false;
	try {
		await track.applyConstraints({ advanced: [{ torch: on }] as unknown as MediaTrackConstraintSet[] });
		return true;
	} catch {
		return false;
	}
};
