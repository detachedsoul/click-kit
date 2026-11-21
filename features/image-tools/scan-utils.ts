/**
 * Barcodes and QR codes: the formats the scanner asks for, the way each one is named on screen,
 * what a decoded value actually is, and what the history keeps.
 *
 * Nothing here touches a camera, a canvas, or the DOM. The decoding lives next door in
 * `scan-decoder.ts`, so all of this can be read and checked without a device.
 */

export type ScanFormat =
	| "qr_code"
	| "ean_13"
	| "ean_8"
	| "upc_a"
	| "upc_e"
	| "code_128"
	| "code_39"
	| "itf"
	| "codabar"
	| "data_matrix"
	| "aztec"
	| "pdf417"
	| "other";

export type ScanSource = "camera" | "image";

export type Scan = {
	at: number;
	detail: string;
	format: ScanFormat;
	label: string;
	source: ScanSource;
	value: string;
};

export const FORMAT_NAMES: Record<ScanFormat, string> = {
	qr_code: "QR code",
	ean_13: "EAN-13",
	ean_8: "EAN-8",
	upc_a: "UPC-A",
	upc_e: "UPC-E",
	code_128: "Code 128",
	code_39: "Code 39",
	itf: "ITF",
	codabar: "Codabar",
	data_matrix: "Data Matrix",
	aztec: "Aztec",
	pdf417: "PDF417",
	other: "Unknown format",
};

/** The formats a shop, a parcel, or a poster in the wild is most likely to use. */
export const WANTED_FORMATS: ScanFormat[] = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

/** Each detector spells its formats its own way: `qr_code`, `QRCode`, `EAN-13`, `EAN13`. All mean one thing. */
const ALIASES: Record<string, ScanFormat> = {
	qr: "qr_code",
	qrcode: "qr_code",
	ean13: "ean_13",
	ean8: "ean_8",
	upca: "upc_a",
	upce: "upc_e",
	code128: "code_128",
	code39: "code_39",
	interleaved2of5: "itf",
	itf: "itf",
	codabar: "codabar",
	datamatrix: "data_matrix",
	aztec: "aztec",
	pdf417: "pdf417",
};

export const normaliseFormat = (raw: string): ScanFormat => ALIASES[raw.toLowerCase().replace(/[^a-z0-9]/gu, "")] ?? "other";

export const formatName = (format: ScanFormat) => FORMAT_NAMES[format] ?? FORMAT_NAMES.other;

/** A link only when it would survive being opened: a scheme we trust, or a bare domain we can complete. */
export const webUrlOf = (value: string): string | null => {
	const text = value.trim();
	if (!text || /\s/u.test(text)) return null;
	const candidate = /^https?:\/\//iu.test(text) ? text : /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/iu.test(text) ? `https://${text}` : "";
	if (!candidate) return null;
	try {
		const url = new URL(candidate);
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
	} catch {
		return null;
	}
};

/** The readable part of a link, without the scheme or a `www.` that adds nothing. */
export const hostOf = (url: string) => {
	try {
		return new URL(url).host.replace(/^www\./u, "");
	} catch {
		return url;
	}
};

const inside = (value: string, pattern: RegExp) => value.match(pattern)?.[1]?.trim() ?? "";

/**
 * What the code holds, in the reader's words. A QR code can carry a link, a Wi-Fi password, or a
 * contact card, and saying which one it is matters more than showing the raw string alone.
 */
export const describeScan = (value: string): { label: string; detail: string } => {
	const text = value.trim();
	const url = webUrlOf(text);
	if (url) return { label: "Web link", detail: hostOf(url) };
	if (/^mailto:/iu.test(text)) return { label: "Email address", detail: inside(text, /^mailto:(.+)$/iu) };
	if (/^tel:/iu.test(text)) return { label: "Phone number", detail: inside(text, /^tel:(.+)$/iu) };
	if (/^sms(to)?:/iu.test(text)) return { label: "Text message", detail: inside(text, /^smsto?:([^:?]+)/iu) };
	if (/^WIFI:/iu.test(text)) {
		const network = inside(text, /S:([^;]*)/iu);
		const security = inside(text, /T:([^;]*)/iu);
		return { label: "Wi-Fi network", detail: [network || "hidden network", security].filter(Boolean).join(" · ") };
	}
	if (/^BEGIN:VCARD/iu.test(text)) {
		const name = inside(text, /\nFN:([^\r\n]*)/iu);
		return { label: "Contact card", detail: name || "a name card" };
	}
	if (/^BEGIN:VEVENT/iu.test(text)) return { label: "Calendar event", detail: inside(text, /\nSUMMARY:([^\r\n]*)/iu) || "an appointment" };
	if (/^geo:/iu.test(text)) return { label: "Place", detail: inside(text, /^geo:([^?]+)/iu) };
	return { label: "Text", detail: `${text.length} character${text.length === 1 ? "" : "s"}` };
};

/** One scan, ready to show and to keep: the value, how it was read, and what it turned out to be. */
export const makeScan = (value: string, format: ScanFormat, source: ScanSource, at = Date.now()): Scan => {
	const { label, detail } = describeScan(value);
	return { at, detail, format, label, source, value };
};

export const HISTORY_KEY = "clickkit-scan-history";
export const MAX_SCANS = 25;

const isScan = (value: unknown): value is Scan => {
	if (typeof value !== "object" || value === null) return false;
	const scan = value as Partial<Scan>;
	return typeof scan.value === "string" && typeof scan.at === "number" && typeof scan.format === "string" && typeof scan.label === "string";
};

export const reviveScans = (raw: unknown): Scan[] => (Array.isArray(raw) ? raw.filter(isScan).slice(0, MAX_SCANS) : []);

/** Newest first, and the same code scanned twice moves up rather than appearing twice. */
export const recordScan = (scans: Scan[], scan: Scan) =>
	[scan, ...scans.filter((kept) => kept.value !== scan.value || kept.format !== scan.format)].slice(0, MAX_SCANS);

/** The moment a scan was made, in the reader's own words. */
export const scanWhen = (at: number) => {
	const date = new Date(at);
	const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
	return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
};

/**
 * Photos from a phone are far larger than a decoder needs. This keeps the shape and brings the
 * long edge under the limit, because decoding a 12-megapixel frame on every camera tick is slower
 * than the camera itself.
 */
export const scaledTo = (width: number, height: number, limit: number) => {
	if (width <= 0 || height <= 0) return { width: 0, height: 0 };
	const longest = Math.max(width, height);
	if (longest <= limit) return { width: Math.round(width), height: Math.round(height) };
	const ratio = limit / longest;
	return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
};

/** A value long enough to fill a page still has to fit in a result box. */
export const shorten = (value: string, limit = 160) => (value.length <= limit ? value : `${value.slice(0, limit)}…`);
