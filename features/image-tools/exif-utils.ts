export type ExifField = { label: string; value: string };

export type ExifSummary = {
	fields: ExifField[];
	camera: string;
	lens: string;
	taken: string;
	orientation: string;
	pixelSize: { width: number; height: number } | null;
	gps: { latitude: number; longitude: number } | null;
};

type Rational = { numerator: number; denominator: number };
type ExifValue = string | number | number[] | Rational[];

const TAG_NAMES = {
	make: 0x010f,
	model: 0x0110,
	orientation: 0x0112,
	software: 0x0131,
	dateTime: 0x0132,
	exifIfd: 0x8769,
	gpsIfd: 0x8825,
	exposureTime: 0x829a,
	fNumber: 0x829d,
	iso: 0x8827,
	dateTimeOriginal: 0x9003,
	dateTimeDigitized: 0x9004,
	focalLength: 0x920a,
	lensModel: 0xa434,
	pixelX: 0xa002,
	pixelY: 0xa003,
} as const;

const ORIENTATIONS: Record<number, string> = {
	1: "Normal",
	2: "Mirrored horizontally",
	3: "Rotated 180°",
	4: "Mirrored vertically",
	5: "Mirrored and rotated 90° clockwise",
	6: "Rotated 90° clockwise",
	7: "Mirrored and rotated 90° counter-clockwise",
	8: "Rotated 90° counter-clockwise",
};

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

type Reader = { view: DataView; little: boolean };

const u16 = ({ view, little }: Reader, offset: number) => view.getUint16(offset, little);
const u32 = ({ view, little }: Reader, offset: number) => view.getUint32(offset, little);
const i32 = ({ view, little }: Reader, offset: number) => view.getInt32(offset, little);

const readAscii = (reader: Reader, offset: number, count: number) => {
	const bytes: string[] = [];
	for (let index = 0; index < count; index += 1) {
		const byte = reader.view.getUint8(offset + index);
		if (byte === 0) break;
		bytes.push(String.fromCharCode(byte));
	}
	return bytes.join("").trim();
};

const readValue = (reader: Reader, type: number, count: number, offset: number): ExifValue | null => {
	switch (type) {
		case 1:
		case 7: {
			return Array.from({ length: Math.min(count, 16) }, (_, index) => reader.view.getUint8(offset + index));
		}
		case 2:
			return readAscii(reader, offset, count);
		case 3: {
			return Array.from({ length: Math.min(count, 32) }, (_, index) => u16(reader, offset + index * 2));
		}
		case 4: {
			return Array.from({ length: Math.min(count, 32) }, (_, index) => u32(reader, offset + index * 4));
		}
		case 5: {
			return Array.from({ length: Math.min(count, 16) }, (_, index) => ({
				numerator: u32(reader, offset + index * 8),
				denominator: u32(reader, offset + index * 8 + 4),
			}));
		}
		case 9: {
			return Array.from({ length: Math.min(count, 32) }, (_, index) => i32(reader, offset + index * 4));
		}
		case 10: {
			return Array.from({ length: Math.min(count, 16) }, (_, index) => ({
				numerator: i32(reader, offset + index * 8),
				denominator: i32(reader, offset + index * 8 + 4),
			}));
		}
		default:
			return null;
	}
};

/** Read one IFD and return its tags by number. */
const readIfd = (reader: Reader, offset: number, tags: Map<number, ExifValue>) => {
	if (offset <= 0 || offset + 2 > reader.view.byteLength) return;
	const count = u16(reader, offset);
	if (count <= 0 || count > 512) return;
	for (let index = 0; index < count; index += 1) {
		const entry = offset + 2 + index * 12;
		if (entry + 12 > reader.view.byteLength) return;
		const tag = u16(reader, entry);
		const type = u16(reader, entry + 2);
		const valueCount = u32(reader, entry + 4);
		const size = (TYPE_SIZES[type] ?? 0) * valueCount;
		if (size <= 0) continue;
		const valueOffset = size <= 4 ? entry + 8 : u32(reader, entry + 8);
		if (valueOffset + Math.min(size, 4) > reader.view.byteLength) continue;
		const value = readValue(reader, type, valueCount, valueOffset);
		if (value !== null) tags.set(tag, value);
	}
};

const findExifStart = (bytes: Uint8Array) => {
	if (bytes.length < 16 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return -1;
	let pointer = 2;
	while (pointer + 4 <= bytes.length) {
		if (bytes[pointer] !== 0xff) return -1;
		const marker = bytes[pointer + 1];
		if (marker === 0xda || marker === 0xd9) return -1;
		const length = (bytes[pointer + 2] << 8) | bytes[pointer + 3];
		if (length < 2) return -1;
		const isExif = marker === 0xe1 && bytes[pointer + 4] === 0x45 && bytes[pointer + 5] === 0x78 && bytes[pointer + 6] === 0x69 && bytes[pointer + 7] === 0x66;
		if (isExif) return pointer + 10;
		pointer += 2 + length;
	}
	return -1;
};

const numberValue = (value: ExifValue | undefined): number | null => {
	if (typeof value === "number") return value;
	if (Array.isArray(value) && typeof value[0] === "number") return value[0];
	return null;
};

const textValue = (value: ExifValue | undefined): string => (typeof value === "string" ? value : "");

const rationalValue = (value: ExifValue | undefined): number | null => {
	if (!Array.isArray(value) || value.length === 0) return null;
	const first = value[0];
	if (typeof first === "number") return first;
	if (typeof first === "object" && "numerator" in first && first.denominator) return first.numerator / first.denominator;
	return null;
};

const trimNumber = (value: number, fractionDigits = 1) => {
	const fixed = value.toFixed(fractionDigits);
	return fixed.replace(/\.0+$/u, "");
};

const formatDate = (value: string) => value.replace(/^(\d{4}):(\d{2}):(\d{2})/u, "$1-$2-$3").trim();

const formatExposure = (value: number | null) => {
	if (!value || value <= 0) return "";
	if (value >= 1) return `${trimNumber(value, 2)} s`;
	return `1/${Math.round(1 / value)} s`;
};

const gpsCoordinate = (value: ExifValue | undefined, reference: string) => {
	if (!Array.isArray(value) || value.length < 3) return null;
	const parts = value.map((part) => (typeof part === "object" && "numerator" in part && part.denominator ? part.numerator / part.denominator : Number(part)));
	const [degrees, minutes, seconds] = parts;
	if (![degrees, minutes, seconds].every((part) => Number.isFinite(part))) return null;
	const decimal = degrees + minutes / 60 + seconds / 3600;
	return reference === "S" || reference === "W" ? -decimal : decimal;
};

/** Parse the EXIF block of a JPEG. Returns null when there is nothing to read. */
export const parseExif = (bytes: Uint8Array): ExifSummary | null => {
	const tiffStart = findExifStart(bytes);
	if (tiffStart < 0 || tiffStart + 8 > bytes.length) return null;
	const view = new DataView(bytes.buffer, bytes.byteOffset + tiffStart, bytes.length - tiffStart);
	const order = view.getUint16(0, false);
	const little = order === 0x4949;
	if (!little && order !== 0x4d4d) return null;
	const reader: Reader = { view, little };
	if (u16(reader, 2) !== 42) return null;
	const tags = new Map<number, ExifValue>();
	const ifd0 = u32(reader, 4);
	readIfd(reader, ifd0, tags);
	const exifPointer = numberValue(tags.get(TAG_NAMES.exifIfd));
	if (exifPointer) readIfd(reader, exifPointer, tags);
	const gpsPointer = numberValue(tags.get(TAG_NAMES.gpsIfd));
	const gpsTags = new Map<number, ExifValue>();
	if (gpsPointer) readIfd(reader, gpsPointer, gpsTags);
	if (tags.size === 0) return null;

	const make = textValue(tags.get(TAG_NAMES.make));
	const model = textValue(tags.get(TAG_NAMES.model));
	const lens = textValue(tags.get(TAG_NAMES.lensModel));
	const taken = formatDate(textValue(tags.get(TAG_NAMES.dateTimeOriginal)) || textValue(tags.get(TAG_NAMES.dateTime)));
	const orientationNumber = numberValue(tags.get(TAG_NAMES.orientation));
	const orientation = orientationNumber ? (ORIENTATIONS[orientationNumber] ?? `Value ${orientationNumber}`) : "";
	const exposure = formatExposure(rationalValue(tags.get(TAG_NAMES.exposureTime)));
	const aperture = rationalValue(tags.get(TAG_NAMES.fNumber));
	const iso = numberValue(tags.get(TAG_NAMES.iso));
	const focalLength = rationalValue(tags.get(TAG_NAMES.focalLength));
	const pixelX = numberValue(tags.get(TAG_NAMES.pixelX));
	const pixelY = numberValue(tags.get(TAG_NAMES.pixelY));
	const software = textValue(tags.get(TAG_NAMES.software));

	const latitude = gpsCoordinate(gpsTags.get(0x0002), textValue(gpsTags.get(0x0001)));
	const longitude = gpsCoordinate(gpsTags.get(0x0004), textValue(gpsTags.get(0x0003)));
	const gps = latitude !== null && longitude !== null ? { latitude, longitude } : null;

	const fields: ExifField[] = [];
	const push = (label: string, value: string) => {
		if (value) fields.push({ label, value });
	};
	push("Camera", [make, model].filter(Boolean).join(" "));
	push("Lens", lens);
	push("Taken", taken);
	push("Orientation", orientation);
	push("Exposure", exposure);
	push("Aperture", aperture ? `f/${trimNumber(aperture, 1)}` : "");
	push("ISO", iso ? String(iso) : "");
	push("Focal length", focalLength ? `${trimNumber(focalLength, 1)} mm` : "");
	push("Stored size", pixelX && pixelY ? `${pixelX} × ${pixelY} px` : "");
	push("Software", software);
	push("GPS", gps ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` : "");

	return {
		fields,
		camera: [make, model].filter(Boolean).join(" "),
		lens,
		taken,
		orientation,
		pixelSize: pixelX && pixelY ? { width: pixelX, height: pixelY } : null,
		gps,
	};
};
