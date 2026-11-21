import { describe, expect, it } from "vitest";
import {
	describeScan,
	formatName,
	hostOf,
	HISTORY_KEY,
	makeScan,
	MAX_SCANS,
	normaliseFormat,
	recordScan,
	reviveScans,
	scaledTo,
	scanWhen,
	shorten,
	WANTED_FORMATS,
	webUrlOf,
	type Scan,
} from "@/features/image-tools/scan-utils";

const at = new Date("2026-11-20T09:32:00Z").getTime();

const scanOf = (value: string, format: Scan["format"] = "qr_code"): Scan => makeScan(value, format, "camera", at);

describe("scan formats", () => {
	it("reads the same format the way each detector spells it", () => {
		expect(normaliseFormat("qr_code")).toBe("qr_code");
		expect(normaliseFormat("QRCode")).toBe("qr_code");
		expect(normaliseFormat("QR_CODE")).toBe("qr_code");
		expect(normaliseFormat("EAN-13")).toBe("ean_13");
		expect(normaliseFormat("EAN13")).toBe("ean_13");
		expect(normaliseFormat("ean_8")).toBe("ean_8");
		expect(normaliseFormat("UPC_A")).toBe("upc_a");
		expect(normaliseFormat("UPC-E")).toBe("upc_e");
		expect(normaliseFormat("CODE_128")).toBe("code_128");
		expect(normaliseFormat("code128")).toBe("code_128");
		expect(normaliseFormat("Data Matrix")).toBe("data_matrix");
		expect(normaliseFormat("PDF_417")).toBe("pdf417");
	});

	it("admits when it does not know a format", () => {
		expect(normaliseFormat("moon_symbol")).toBe("other");
		expect(formatName("other")).toBe("Unknown format");
	});

	it("names every format it asks for", () => {
		expect(WANTED_FORMATS).toContain("qr_code");
		expect(WANTED_FORMATS).toContain("code_128");
		for (const format of WANTED_FORMATS) expect(formatName(format)).not.toBe("Unknown format");
	});
});

describe("what a code holds", () => {
	it("takes a scheme it trusts, and completes a bare domain", () => {
		expect(webUrlOf("https://example.com")).toBe("https://example.com/");
		expect(webUrlOf("HTTP://Example.COM/a?b=1")).toBe("http://example.com/a?b=1");
		expect(webUrlOf("clickkit.tools/tools")).toBe("https://clickkit.tools/tools");
		expect(hostOf("https://www.example.com/x")).toBe("example.com");
	});

	it("refuses anything it would not open", () => {
		expect(webUrlOf("javascript:alert(1)")).toBeNull();
		expect(webUrlOf("mailto:hello@example.com")).toBeNull();
		expect(webUrlOf("two words")).toBeNull();
		expect(webUrlOf("example")).toBeNull();
		expect(webUrlOf("1.5")).toBeNull();
	});

	it("says which kind of thing was scanned", () => {
		expect(describeScan("https://example.com/page")).toEqual({ label: "Web link", detail: "example.com" });
		expect(describeScan("mailto:hi@example.com")).toEqual({ label: "Email address", detail: "hi@example.com" });
		expect(describeScan("tel:+2348012345678")).toEqual({ label: "Phone number", detail: "+2348012345678" });
		expect(describeScan("WIFI:T:WPA;S:ClickKit Guest;P:hunter2;;")).toEqual({ label: "Wi-Fi network", detail: "ClickKit Guest · WPA" });
		expect(describeScan("BEGIN:VCARD\nVERSION:3.0\nFN:Ada Lovelace\nEND:VCARD")).toEqual({ label: "Contact card", detail: "Ada Lovelace" });
		expect(describeScan("BEGIN:VEVENT\nSUMMARY:Standup\nEND:VEVENT")).toEqual({ label: "Calendar event", detail: "Standup" });
		expect(describeScan("geo:6.5244,3.3792")).toEqual({ label: "Place", detail: "6.5244,3.3792" });
		expect(describeScan("plain words")).toEqual({ label: "Text", detail: "11 characters" });
		expect(describeScan("x")).toEqual({ label: "Text", detail: "1 character" });
	});

	it("gives a scan everything the panel shows", () => {
		const scan = scanOf("https://example.com");
		expect(scan).toMatchObject({ at, detail: "example.com", format: "qr_code", label: "Web link", source: "camera", value: "https://example.com" });
	});
});

describe("the scan history", () => {
	it("keeps the newest first", () => {
		const older = scanOf("first", "ean_13");
		const newer = scanOf("second", "code_128");
		expect(recordScan([older], newer)).toEqual([newer, older]);
	});

	it("moves a code that was scanned again to the top instead of listing it twice", () => {
		const one = scanOf("4901234567894", "ean_13");
		const two = scanOf("hello");
		const again = { ...one, at: at + 1000 };
		const kept = recordScan([one, two], again);
		expect(kept).toHaveLength(2);
		expect(kept[0]).toEqual(again);
	});

	it("keeps the same value as a separate row when the format differs", () => {
		const kept = recordScan([scanOf("12345", "code_128")], scanOf("12345", "ean_8"));
		expect(kept).toHaveLength(2);
	});

	it("never grows past the shelf", () => {
		let kept: Scan[] = [];
		for (let index = 0; index < MAX_SCANS + 10; index += 1) kept = recordScan(kept, scanOf(`code ${index}`));
		expect(kept).toHaveLength(MAX_SCANS);
		expect(kept[0].value).toBe(`code ${MAX_SCANS + 9}`);
	});

	it("reads back only what it wrote", () => {
		const kept = [scanOf("https://example.com"), { value: 42 }, null, "junk"];
		expect(reviveScans(kept)).toEqual([scanOf("https://example.com")]);
		expect(reviveScans("not a list")).toEqual([]);
		expect(HISTORY_KEY).toBe("clickkit-scan-history");
	});

	it("stamps a scan with the date and time it happened", () => {
		expect(scanWhen(at)).toMatch(/\d{2}:\d{2}$/u);
	});
});

describe("pictures", () => {
	it("brings a large photo down to size without changing its shape", () => {
		expect(scaledTo(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
		expect(scaledTo(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
		expect(scaledTo(320, 240, 1600)).toEqual({ width: 320, height: 240 });
		expect(scaledTo(0, 0, 1600)).toEqual({ width: 0, height: 0 });
	});

	it("shortens a long value for a list row without losing the start", () => {
		expect(shorten("abc", 10)).toBe("abc");
		expect(shorten("abcdefghijkl", 5)).toBe("abcde…");
	});
});
