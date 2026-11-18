import { describe, expect, it } from "vitest";
import { extensionOf, hexDump, identifyFile, sniffText } from "@/features/image-tools/file-type-utils";

const bytes = (...values: number[]) => new Uint8Array(values);
const textBytes = (text: string) => new TextEncoder().encode(text);

const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46);

describe("file type identifier", () => {
	it("reads the signature, not the file name", () => {
		const identity = identifyFile(png, "holiday.jpg", "image/jpeg");
		expect(identity.detected?.mime).toBe("image/png");
		expect(identity.detected?.extension).toBe("png");
		expect(identity.detected?.kind).toBe("image");
		expect(identity.declaredExtension).toBe("jpg");
		expect(identity.matches).toBe(false);
		expect(identity.note).toContain(".jpg");
	});

	it("accepts common extension aliases", () => {
		expect(identifyFile(jpeg, "photo.JPEG").matches).toBe(true);
		expect(identifyFile(png, "icon.PNG").matches).toBe(true);
		const tiff = bytes(0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00);
		expect(identifyFile(tiff, "scan.tiff").matches).toBe(true);
	});

	it("labels zip containers and says why they cannot be pinned down", () => {
		const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00);
		expect(identifyFile(zip, "report.docx").detected?.extension).toBe("zip");
		expect(identifyFile(zip, "report.docx").matches).toBe(true);
		expect(identifyFile(zip, "report.docx").note).toContain("docx");
	});

	it("recognises fonts, audio, video, and archives", () => {
		expect(identifyFile(textBytes("wOF2\u0000\u0001\u0000"), "inter.woff2").detected?.mime).toBe("font/woff2");
		expect(identifyFile(textBytes("ID3\u0004\u0000\u0000"), "track.mp3").detected?.kind).toBe("audio");
		expect(identifyFile(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00), "clip.webm").detected?.mime).toBe("video/webm");
		expect(identifyFile(bytes(0x1f, 0x8b, 0x08, 0x00), "logs.gz").detected?.kind).toBe("archive");
		expect(identifyFile(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37), "paper.pdf").detected?.mime).toBe("application/pdf");
	});

	it("falls back to text dialects when there is no binary signature", () => {
		expect(sniffText(textBytes('{"name":"ClickKit"}'))?.extension).toBe("json");
		expect(sniffText(textBytes("<?xml version=\"1.0\"?><svg viewBox=\"0 0 24 24\"></svg>"))?.mime).toBe("image/svg+xml");
		expect(sniffText(textBytes("<!doctype html><html><body>hi</body></html>"))?.extension).toBe("html");
		expect(sniffText(textBytes("name,role\nAda,engineer\nSam,designer\n"))?.extension).toBe("csv");
		expect(sniffText(textBytes("just a note\nwith two lines"))?.label).toBe("Plain text");
		expect(sniffText(bytes(0x00, 0x01, 0x02))).toBeNull();
	});

	it("reports an unknown blob without guessing", () => {
		const identity = identifyFile(bytes(0x13, 0x37, 0x13, 0x37), "mystery.bin");
		expect(identity.detected).toBeNull();
		expect(identity.matches).toBeNull();
	});

	it("extracts lower-case extensions and previews bytes", () => {
		expect(extensionOf("Photo.JPEG")).toBe("jpeg");
		expect(extensionOf("no-extension")).toBe("");
		const dump = hexDump(bytes(0x89, 0x50, 0x4e, 0x47), 4);
		expect(dump).toContain("89 50 4e 47");
		expect(dump).toContain(".PNG");
	});
});
