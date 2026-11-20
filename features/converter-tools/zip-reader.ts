/**
 * Reading a ZIP in the browser.
 *
 * Word documents, EPUB books, and plenty of other "one file" formats are zip archives in
 * disguise. This reads the central directory, finds each file, and inflates the ones that
 * are compressed, using the browser's own DecompressionStream — no library, no upload.
 */

export type ZipEntry = { name: string; bytes: Uint8Array };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const u16 = (view: DataView, offset: number) => view.getUint16(offset, true);
const u32 = (view: DataView, offset: number) => view.getUint32(offset, true);

const findEndOfCentralDirectory = (view: DataView) => {
	// The record sits at the end, followed by a comment of up to 64 KB.
	for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 22 - 0xffff); offset -= 1) {
		if (u32(view, offset) === EOCD) return offset;
	}
	return -1;
};

const inflateRaw = async (bytes: Uint8Array) => {
	if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack that file. Try a newer browser.");
	const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};

/** Every file in the archive, by name. Stored (uncompressed) entries work too. */
export const readZipEntries = async (bytes: Uint8Array): Promise<ZipEntry[]> => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = findEndOfCentralDirectory(view);
	if (eocd === -1) throw new Error("That file is not a zip archive.");
	const total = u16(view, eocd + 10);
	let offset = u32(view, eocd + 16);
	const entries: ZipEntry[] = [];
	for (let index = 0; index < total; index += 1) {
		if (offset + 46 > view.byteLength || u32(view, offset) !== CENTRAL) break;
		const method = u16(view, offset + 10);
		const compressedSize = u32(view, offset + 20);
		const nameLength = u16(view, offset + 28);
		const extraLength = u16(view, offset + 30);
		const commentLength = u16(view, offset + 32);
		const localOffset = u32(view, offset + 42);
		const name = new TextDecoder("utf-8").decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
		offset += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith("/")) continue;
		if (localOffset + 30 > view.byteLength || u32(view, localOffset) !== LOCAL) continue;
		const localNameLength = u16(view, localOffset + 26);
		const localExtraLength = u16(view, localOffset + 28);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		const raw = bytes.subarray(dataStart, dataStart + compressedSize);
		if (method === 0) entries.push({ name, bytes: raw.slice() });
		else if (method === 8) entries.push({ name, bytes: await inflateRaw(raw) });
	}
	if (entries.length === 0) throw new Error("That archive is empty.");
	return entries;
};

/** One file out of the archive, or null when it is not there. */
export const readZipFile = async (bytes: Uint8Array, name: string): Promise<string | null> => {
	const entries = await readZipEntries(bytes);
	const wanted = name.toLowerCase();
	const found = entries.find((entry) => entry.name.toLowerCase() === wanted) ?? entries.find((entry) => entry.name.toLowerCase().endsWith(`/${wanted}`));
	return found ? new TextDecoder("utf-8").decode(found.bytes) : null;
};

export const readZipBytes = async (bytes: Uint8Array, name: string): Promise<Uint8Array | null> => {
	const entries = await readZipEntries(bytes);
	const wanted = name.toLowerCase();
	return entries.find((entry) => entry.name.toLowerCase() === wanted)?.bytes ?? null;
};
