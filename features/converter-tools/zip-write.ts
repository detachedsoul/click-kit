/**
 * Writing a ZIP in the browser.
 *
 * A .docx is a zip of XML parts, so turning text into a Word document means building one.
 * Every entry is stored rather than deflated: the parts are small, the saving would be a few
 * hundred bytes, and stored entries keep this free of CompressionStream and any library.
 */

const encoder = new TextEncoder();

const table = (() => {
	const rows = new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		rows[index] = value >>> 0;
	}
	return rows;
})();

/** The checksum a zip entry has to carry. */
export const crc32 = (bytes: Uint8Array) => {
	let value = 0xffffffff;
	for (const byte of bytes) value = table[(value ^ byte) & 0xff] ^ (value >>> 8);
	return (value ^ 0xffffffff) >>> 0;
};

export type ZipInput = { name: string; data: Uint8Array | string };

// A fixed timestamp (1 January 1980) keeps the same input producing the same bytes.
const DOS_TIME = 0;
const DOS_DATE = 33;
const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;

/** Builds a zip archive out of the files given, in order. */
export const writeZip = (files: ZipInput[]): Uint8Array => {
	const entries = files.map((file) => ({ data: typeof file.data === "string" ? encoder.encode(file.data) : file.data, name: encoder.encode(file.name) }));
	const body: Uint8Array[] = [];
	const directory: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const crc = crc32(entry.data);
		const local = new Uint8Array(30 + entry.name.length);
		const localView = new DataView(local.buffer);
		localView.setUint32(0, LOCAL, true);
		localView.setUint16(4, 20, true);
		localView.setUint16(6, 0x0800, true);
		localView.setUint16(8, 0, true);
		localView.setUint16(10, DOS_TIME, true);
		localView.setUint16(12, DOS_DATE, true);
		localView.setUint32(14, crc, true);
		localView.setUint32(18, entry.data.length, true);
		localView.setUint32(22, entry.data.length, true);
		localView.setUint16(26, entry.name.length, true);
		localView.setUint16(28, 0, true);
		local.set(entry.name, 30);
		body.push(local, entry.data);

		const record = new Uint8Array(46 + entry.name.length);
		const recordView = new DataView(record.buffer);
		recordView.setUint32(0, CENTRAL, true);
		recordView.setUint16(4, 20, true);
		recordView.setUint16(6, 20, true);
		recordView.setUint16(8, 0x0800, true);
		recordView.setUint16(10, 0, true);
		recordView.setUint16(12, DOS_TIME, true);
		recordView.setUint16(14, DOS_DATE, true);
		recordView.setUint32(16, crc, true);
		recordView.setUint32(20, entry.data.length, true);
		recordView.setUint32(24, entry.data.length, true);
		recordView.setUint16(28, entry.name.length, true);
		recordView.setUint16(30, 0, true);
		recordView.setUint16(32, 0, true);
		recordView.setUint16(34, 0, true);
		recordView.setUint16(36, 0, true);
		recordView.setUint32(38, 0, true);
		recordView.setUint32(42, offset, true);
		record.set(entry.name, 46);
		directory.push(record);

		offset += local.length + entry.data.length;
	}

	const directorySize = directory.reduce((total, part) => total + part.length, 0);
	const end = new Uint8Array(22);
	const endView = new DataView(end.buffer);
	endView.setUint32(0, END, true);
	endView.setUint16(8, entries.length, true);
	endView.setUint16(10, entries.length, true);
	endView.setUint32(12, directorySize, true);
	endView.setUint32(16, offset, true);

	const parts = [...body, ...directory, end];
	const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let cursor = 0;
	for (const part of parts) {
		out.set(part, cursor);
		cursor += part.length;
	}
	return out;
};
