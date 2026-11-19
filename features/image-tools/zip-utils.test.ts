import { describe, expect, it } from "vitest";
import { crc32, createZip, describeZip, dosDateTime } from "@/features/image-tools/zip-utils";

const encoder = new TextEncoder();

describe("zip archive builder", () => {
	it("computes the standard CRC-32", () => {
		expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
		expect(crc32(new Uint8Array([]))).toBe(0);
		expect(crc32(encoder.encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
	});

	it("encodes DOS date and time", () => {
		expect(dosDateTime(new Date(2024, 4, 1, 12, 33, 44))).toEqual({ time: (12 << 11) | (33 << 5) | 22, date: ((2024 - 1980) << 9) | (5 << 5) | 1 });
		expect(dosDateTime(new Date(1970, 0, 1)).date >> 9).toBe(0);
	});

	it("builds a valid stored archive", async () => {
		const zip = await createZip(
			[
				{ name: "notes.txt", data: encoder.encode("hello world") },
				{ name: "nested/data.json", data: encoder.encode('{"ok":true}') },
			],
			{ compress: false },
		);
		const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
		expect(view.getUint32(0, true)).toBe(0x04034b50);
		expect(view.getUint16(6, true)).toBe(0x0800);
		expect(view.getUint16(8, true)).toBe(0);
		expect(view.getUint32(14, true)).toBe(crc32(encoder.encode("hello world")));
		expect(view.getUint32(18, true)).toBe(11);
		expect(view.getUint32(22, true)).toBe(11);
		expect(view.getUint16(26, true)).toBe("notes.txt".length);
		const summary = describeZip(zip);
		expect(summary.entries).toBe(2);
		expect(summary.centralOffset).toBeGreaterThan(0);
		expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
	});

	it("puts UTF-8 names and the central directory in the right places", async () => {
		const zip = await createZip([{ name: "café.txt", data: encoder.encode("hi") }], { compress: false });
		const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
		const nameLength = view.getUint16(26, true);
		expect(new TextDecoder().decode(zip.subarray(30, 30 + nameLength))).toBe("café.txt");
		const { centralOffset } = describeZip(zip);
		expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
		expect(view.getUint32(centralOffset + 42, true)).toBe(0);
	});

	it("rejects empty archives and nameless entries", async () => {
		await expect(createZip([])).rejects.toThrow(/at least one/u);
		await expect(createZip([{ name: "", data: new Uint8Array([1]) }])).rejects.toThrow(/needs a name/u);
	});

	it("round-trips through any available compression", async () => {
		const zip = await createZip([{ name: "repeat.txt", data: encoder.encode("ab".repeat(500)) }]);
		expect(describeZip(zip).entries).toBe(1);
		expect(zip.length).toBeGreaterThan(0);
	});
});
