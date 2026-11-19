export type ZipEntry = { name: string; data: Uint8Array; lastModified?: Date };

export type ZipOptions = { compress?: boolean };

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let index = 0; index < 256; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	return table;
})();

/** Standard ZIP CRC-32 (the same polynomial PNG and gzip use). */
export const crc32 = (data: Uint8Array) => {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
};

/** MS-DOS date and time, as stored in every ZIP header. */
export const dosDateTime = (date: Date) => {
	const year = Math.max(1980, date.getFullYear());
	return {
		time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
		date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
	};
};

const encoder = new TextEncoder();

const deflateRaw = async (data: Uint8Array) => {
	if (typeof CompressionStream === "undefined") return null;
	try {
		const stream = new Blob([data.slice().buffer]).stream().pipeThrough(new CompressionStream("deflate-raw"));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch {
		return null;
	}
};

/**
 * Build a ZIP archive. Entries are deflated when the browser supports
 * `CompressionStream` and the result is actually smaller; otherwise they are
 * stored, which is still a valid archive.
 */
export const createZip = async (entries: ZipEntry[], options: ZipOptions = {}): Promise<Uint8Array> => {
	if (entries.length === 0) throw new Error("Add at least one file to the archive.");
	const compress = options.compress ?? true;
	const prepared: { name: Uint8Array; data: Uint8Array; method: number; crc: number; time: number; date: number; originalSize: number }[] = [];
	for (const entry of entries) {
		const name = encoder.encode(entry.name);
		if (name.length === 0) throw new Error("Every file needs a name.");
		if (name.length > 0xffff) throw new Error("File names must be shorter than 65,535 bytes.");
		const crc = crc32(entry.data);
		const compressed = compress ? await deflateRaw(entry.data) : null;
		const useDeflate = compressed !== null && compressed.length < entry.data.length;
		const { time, date } = dosDateTime(entry.lastModified ?? new Date());
		prepared.push({
			name,
			data: useDeflate ? compressed : entry.data,
			method: useDeflate ? 8 : 0,
			crc,
			time,
			date,
			originalSize: entry.data.length,
		});
	}
	const localSize = prepared.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
	const centralSize = prepared.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
	const output = new Uint8Array(localSize + centralSize + 22);
	const view = new DataView(output.buffer);
	let offset = 0;
	const locals: number[] = [];
	prepared.forEach((entry) => {
		locals.push(offset);
		view.setUint32(offset, 0x04034b50, true);
		view.setUint16(offset + 4, 20, true);
		view.setUint16(offset + 6, 0x0800, true);
		view.setUint16(offset + 8, entry.method, true);
		view.setUint16(offset + 10, entry.time, true);
		view.setUint16(offset + 12, entry.date, true);
		view.setUint32(offset + 14, entry.crc, true);
		view.setUint32(offset + 18, entry.data.length, true);
		view.setUint32(offset + 22, entry.originalSize, true);
		view.setUint16(offset + 26, entry.name.length, true);
		view.setUint16(offset + 28, 0, true);
		output.set(entry.name, offset + 30);
		output.set(entry.data, offset + 30 + entry.name.length);
		offset += 30 + entry.name.length + entry.data.length;
	});
	const centralStart = offset;
	prepared.forEach((entry, index) => {
		view.setUint32(offset, 0x02014b50, true);
		view.setUint16(offset + 4, 20, true);
		view.setUint16(offset + 6, 20, true);
		view.setUint16(offset + 8, 0x0800, true);
		view.setUint16(offset + 10, entry.method, true);
		view.setUint16(offset + 12, entry.time, true);
		view.setUint16(offset + 14, entry.date, true);
		view.setUint32(offset + 16, entry.crc, true);
		view.setUint32(offset + 20, entry.data.length, true);
		view.setUint32(offset + 24, entry.originalSize, true);
		view.setUint16(offset + 28, entry.name.length, true);
		view.setUint16(offset + 30, 0, true);
		view.setUint16(offset + 32, 0, true);
		view.setUint16(offset + 34, 0, true);
		view.setUint16(offset + 36, 0, true);
		view.setUint32(offset + 38, 0, true);
		view.setUint32(offset + 42, locals[index], true);
		output.set(entry.name, offset + 46);
		offset += 46 + entry.name.length;
	});
	view.setUint32(offset, 0x06054b50, true);
	view.setUint16(offset + 4, 0, true);
	view.setUint16(offset + 6, 0, true);
	view.setUint16(offset + 8, prepared.length, true);
	view.setUint16(offset + 10, prepared.length, true);
	view.setUint32(offset + 12, offset - centralStart, true);
	view.setUint32(offset + 16, centralStart, true);
	view.setUint16(offset + 20, 0, true);
	return output;
};

/** Read a ZIP back just far enough to prove the structure is sound (used by tests and the UI). */
export const describeZip = (zip: Uint8Array) => {
	const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
	const endOffset = zip.length - 22;
	if (view.getUint32(endOffset, true) !== 0x06054b50) throw new Error("This is not a ZIP archive.");
	return {
		entries: view.getUint16(endOffset + 10, true),
		centralOffset: view.getUint32(endOffset + 16, true),
		centralSize: view.getUint32(endOffset + 12, true),
	};
};
