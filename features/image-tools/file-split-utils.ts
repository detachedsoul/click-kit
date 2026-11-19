export const MB = 1024 * 1024;
export const MAX_SPLIT_BYTES = 400 * MB;
export const MAX_JOIN_PARTS = 60;

export const CHUNK_SIZES: { id: number; label: string }[] = [
	{ id: 1 * MB, label: "1 MB" },
	{ id: 2 * MB, label: "2 MB" },
	{ id: 5 * MB, label: "5 MB" },
	{ id: 10 * MB, label: "10 MB" },
	{ id: 20 * MB, label: "20 MB" },
];

export type Chunk = { index: number; start: number; end: number; size: number };

/** Byte ranges that cover the file exactly, in order. */
export const planChunks = (totalBytes: number, chunkBytes: number): Chunk[] => {
	if (!Number.isFinite(totalBytes) || totalBytes < 1) throw new Error("Choose a file with something in it first.");
	if (!Number.isFinite(chunkBytes) || chunkBytes < 1) throw new Error("Chunk size must be at least one byte.");
	if (totalBytes > MAX_SPLIT_BYTES) throw new Error("Split files up to 400 MB at a time.");
	const chunks: Chunk[] = [];
	for (let start = 0, index = 0; start < totalBytes; start += chunkBytes, index += 1) {
		const end = Math.min(totalBytes, start + chunkBytes);
		chunks.push({ index, start, end, size: end - start });
	}
	return chunks;
};

export const padIndex = (count: number) => Math.max(2, String(count).length);

export const chunkName = (fileName: string, index: number, total: number) =>
	`${fileName}.part${String(index + 1).padStart(padIndex(total), "0")}of${String(total).padStart(padIndex(total), "0")}`;

export const partsZipName = (fileName: string) => `${fileName.replace(/\.[^./\\]+$/u, "")}-parts.zip`;

const partNumber = (name: string) => {
	const match = /\.part(\d+)(?:of\d+)?$/u.exec(name);
	return match ? Number(match[1]) : null;
};

/** Sort numbered parts naturally, falling back to file-name order for anything unnumbered. */
export const orderParts = <T extends { name: string }>(parts: T[]): T[] =>
	[...parts].sort((left, right) => {
		const leftIndex = partNumber(left.name);
		const rightIndex = partNumber(right.name);
		if (leftIndex !== null && rightIndex !== null) return leftIndex - rightIndex;
		if (leftIndex !== null) return -1;
		if (rightIndex !== null) return 1;
		return left.name.localeCompare(right.name);
	});

/** Stick the bytes back together in order. */
export const joinBytes = (parts: Uint8Array[]) => {
	if (parts.length === 0) throw new Error("Add the parts you want to join.");
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const joined = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		joined.set(part, offset);
		offset += part.length;
	}
	return joined;
};

/** "photo.jpg.part01of03" → "photo.jpg"; falls back to "joined-file" for odd names. */
export const joinedName = (parts: { name: string }[]) => {
	const first = orderParts(parts)[0]?.name ?? "";
	const stripped = first.replace(/\.part\d+(?:of\d+)?$/u, "");
	return stripped && stripped !== first ? stripped : "joined-file";
};

export const chunkSummary = (chunks: Chunk[]) => `${chunks.length} part${chunks.length === 1 ? "" : "s"}`;
export const missingNumbers = (parts: { name: string }[]) => {
	const numbers = parts.map((part) => partNumber(part.name)).filter((value): value is number => value !== null);
	if (!numbers.length) return [];
	const max = Math.max(...numbers);
	const seen = new Set(numbers);
	return Array.from({ length: max }, (_, index) => index + 1).filter((value) => !seen.has(value));
};
