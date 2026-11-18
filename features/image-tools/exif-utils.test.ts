import { describe, expect, it } from "vitest";
import { parseExif } from "@/features/image-tools/exif-utils";

type Entry = { tag: number; type: number; count: number; value: (offset: number) => number[] };

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;

const asciiEntry = (tag: number, text: string, offset: number): Entry => {
	const bytes = [...new TextEncoder().encode(`${text}\u0000`)];
	return {
		tag,
		type: ASCII,
		count: bytes.length,
		value: () => {
			if (bytes.length <= 4) return bytes.concat(new Array(4).fill(0)).slice(0, 4);
			const out = new Uint8Array(4);
			new DataView(out.buffer).setUint32(0, offset, true);
			return [...out];
		},
	};
};

const inlineShort = (tag: number, value: number): Entry => ({ tag, type: SHORT, count: 1, value: () => [value & 0xff, (value >> 8) & 0xff, 0, 0] });

const inlineLong = (tag: number, value: number): Entry => ({ tag, type: LONG, count: 1, value: () => {
	const out = new Uint8Array(4);
	new DataView(out.buffer).setUint32(0, value, true);
	return [...out];
} });

const rationalEntry = (tag: number, numerator: number, denominator: number, offset: number): Entry => ({
	tag,
	type: RATIONAL,
	count: 1,
	value: () => {
		const out = new Uint8Array(4);
		new DataView(out.buffer).setUint32(0, offset, true);
		return [...out];
	},
});

/** Build a little-endian TIFF/EXIF block with IFD0, an Exif IFD, and a GPS IFD. */
const buildLittleEndianTiff = () => {
	const ifd0Entries = 5;
	const exifEntries = 6;
	const gpsEntries = 4;
	const ifd0Offset = 8;
	const ifd0Size = 2 + ifd0Entries * 12 + 4;
	const exifOffset = ifd0Offset + ifd0Size;
	const exifSize = 2 + exifEntries * 12 + 4;
	const gpsOffset = exifOffset + exifSize;
	const gpsSize = 2 + gpsEntries * 12 + 4;
	let cursor = gpsOffset + gpsSize;
	const take = (length: number) => {
		const start = cursor;
		cursor += length;
		return start;
	};
	const makeOffset = take(8);
	const modelOffset = take(8);
	const dateOffset = take(20);
	const lensOffset = take(9);
	const exposureOffset = take(8);
	const apertureOffset = take(8);
	const focalOffset = take(8);
	const latitudeOffset = take(24);
	const longitudeOffset = take(24);
	const latitudeRefOffset = take(2);
	const longitudeRefOffset = take(2);

	const bytes = new Uint8Array(cursor);
	const view = new DataView(bytes.buffer);
	const writeAscii = (offset: number, text: string) => {
		const encoded = new TextEncoder().encode(`${text}\u0000`);
		bytes.set(encoded, offset);
	};
	const writeRational = (offset: number, numerator: number, denominator: number) => {
		view.setUint32(offset, numerator, true);
		view.setUint32(offset + 4, denominator, true);
	};

	bytes[0] = 0x49;
	bytes[1] = 0x49;
	view.setUint16(2, 42, true);
	view.setUint32(4, ifd0Offset, true);

	const writeIfd = (offset: number, entries: Entry[]) => {
		view.setUint16(offset, entries.length, true);
		entries.forEach((entry, index) => {
			const at = offset + 2 + index * 12;
			view.setUint16(at, entry.tag, true);
			view.setUint16(at + 2, entry.type, true);
			view.setUint32(at + 4, entry.count, true);
			bytes.set(entry.value(at + 8).slice(0, 4), at + 8);
		});
		view.setUint32(offset + 2 + entries.length * 12, 0, true);
	};

	// Strings that do not fit inline need their real values written to the data area.
	writeAscii(makeOffset, "TestCam");
	writeAscii(modelOffset, "Model X");
	writeAscii(dateOffset, "2024:05:01 12:33:00");
	writeAscii(lensOffset, "Prime 50");
	writeRational(exposureOffset, 1, 125);
	writeRational(apertureOffset, 28, 10);
	writeRational(focalOffset, 50, 1);
	writeRational(latitudeOffset, 51, 1);
	writeRational(latitudeOffset + 8, 30, 1);
	writeRational(latitudeOffset + 16, 2664, 100);
	writeRational(longitudeOffset, 0, 1);
	writeRational(longitudeOffset + 8, 7, 1);
	writeRational(longitudeOffset + 16, 4000, 100);
	writeAscii(latitudeRefOffset, "N");
	writeAscii(longitudeRefOffset, "W");

	writeIfd(ifd0Offset, [
		asciiEntry(0x010f, "TestCam", makeOffset),
		asciiEntry(0x0110, "Model X", modelOffset),
		inlineShort(0x0112, 6),
		inlineLong(0x8769, exifOffset),
		inlineLong(0x8825, gpsOffset),
	]);
	writeIfd(exifOffset, [
		rationalEntry(0x829a, 1, 125, exposureOffset),
		rationalEntry(0x829d, 28, 10, apertureOffset),
		inlineShort(0x8827, 800),
		rationalEntry(0x920a, 50, 1, focalOffset),
		asciiEntry(0xa434, "Prime 50", lensOffset),
		asciiEntry(0x9003, "2024:05:01 12:33:00", dateOffset),
	]);
	writeIfd(gpsOffset, [
		asciiEntry(0x0001, "N", latitudeRefOffset),
		{ tag: 0x0002, type: RATIONAL, count: 3, value: () => inlineLong(0, latitudeOffset).value(0) },
		asciiEntry(0x0003, "W", longitudeRefOffset),
		{ tag: 0x0004, type: RATIONAL, count: 3, value: () => inlineLong(0, longitudeOffset).value(0) },
	]);
	return bytes;
};

const buildJpeg = (tiff: Uint8Array) => {
	const app1Length = 2 + 6 + tiff.length;
	const jpeg = new Uint8Array(2 + 2 + app1Length + 2);
	jpeg.set([0xff, 0xd8], 0);
	jpeg.set([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff], 2);
	jpeg.set(new TextEncoder().encode("Exif\u0000\u0000"), 6);
	jpeg.set(tiff, 12);
	jpeg.set([0xff, 0xd9], 12 + tiff.length);
	return jpeg;
};

const buildBigEndianJpeg = () => {
	// Minimal MM file: IFD0 with a make string and an orientation of 1.
	const ifd0Offset = 8;
	const makeOffset = ifd0Offset + 2 + 2 * 12 + 4;
	const bytes = new Uint8Array(makeOffset + 6);
	const view = new DataView(bytes.buffer);
	bytes[0] = 0x4d;
	bytes[1] = 0x4d;
	view.setUint16(2, 42, false);
	view.setUint32(4, ifd0Offset, false);
	view.setUint16(ifd0Offset, 2, false);
	view.setUint16(ifd0Offset + 2, 0x010f, false);
	view.setUint16(ifd0Offset + 4, ASCII, false);
	view.setUint32(ifd0Offset + 6, 6, false);
	view.setUint32(ifd0Offset + 10, makeOffset, false);
	view.setUint16(ifd0Offset + 14, 0x0112, false);
	view.setUint16(ifd0Offset + 16, SHORT, false);
	view.setUint32(ifd0Offset + 18, 1, false);
	view.setUint16(ifd0Offset + 22, 1, false);
	view.setUint32(ifd0Offset + 2 + 2 * 12, 0, false);
	bytes.set(new TextEncoder().encode("Nikon\u0000"), makeOffset);
	return buildJpeg(bytes);
};

describe("EXIF reader", () => {
	it("reads camera, lens, exposure, and GPS from a little-endian JPEG", () => {
		const summary = parseExif(buildJpeg(buildLittleEndianTiff()));
		expect(summary).not.toBeNull();
		expect(summary?.camera).toBe("TestCam Model X");
		expect(summary?.lens).toBe("Prime 50");
		expect(summary?.taken).toBe("2024-05-01 12:33:00");
		expect(summary?.orientation).toBe("Rotated 90° clockwise");
		const values = Object.fromEntries(summary?.fields.map((field) => [field.label, field.value]) ?? []);
		expect(values.Exposure).toBe("1/125 s");
		expect(values.Aperture).toBe("f/2.8");
		expect(values.ISO).toBe("800");
		expect(values["Focal length"]).toBe("50 mm");
		expect(summary?.gps?.latitude).toBeCloseTo(51.5074, 3);
		expect(summary?.gps?.longitude).toBeCloseTo(-0.1278, 3);
	});

	it("handles big-endian files", () => {
		const summary = parseExif(buildBigEndianJpeg());
		expect(summary?.camera).toBe("Nikon");
		expect(summary?.orientation).toBe("Normal");
	});

	it("returns null for other formats and empty EXIF", () => {
		expect(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
		expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
		expect(parseExif(new Uint8Array([]))).toBeNull();
	});

	it("does not throw on a truncated EXIF block", () => {
		const jpeg = buildJpeg(buildLittleEndianTiff());
		expect(() => parseExif(jpeg.subarray(0, 40))).not.toThrow();
		// Whatever survives truncation must be coherent: no invented camera or GPS data.
		const partial = parseExif(jpeg.subarray(0, 40));
		expect(partial?.camera ?? "").toBe("");
		expect(partial?.gps ?? null).toBeNull();
		expect(parseExif(jpeg.subarray(0, 20))).toBeNull();
	});
});
