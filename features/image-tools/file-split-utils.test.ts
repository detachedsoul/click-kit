import { describe, expect, it } from "vitest";
import { chunkName, chunkSummary, joinBytes, joinedName, MAX_SPLIT_BYTES, missingNumbers, orderParts, partsZipName, planChunks } from "@/features/image-tools/file-split-utils";

describe("file splitter", () => {
	it("covers the file with equal chunks and a short last one", () => {
		const chunks = planChunks(10, 4);
		expect(chunks).toEqual([
			{ index: 0, start: 0, end: 4, size: 4 },
			{ index: 1, start: 4, end: 8, size: 4 },
			{ index: 2, start: 8, end: 10, size: 2 },
		]);
		expect(chunkSummary(chunks)).toBe("3 parts");
		expect(chunkSummary(planChunks(3, 5))).toBe("1 part");
		expect(() => planChunks(0, 5)).toThrow(/something in it/u);
		expect(() => planChunks(10, 0)).toThrow(/at least one byte/u);
		expect(() => planChunks(MAX_SPLIT_BYTES + 1, 1024)).toThrow(/400 MB/u);
	});

	it("names parts so they sort in order", () => {
		expect(chunkName("holiday.jpg", 0, 3)).toBe("holiday.jpg.part01of03");
		expect(chunkName("holiday.jpg", 11, 12)).toBe("holiday.jpg.part12of12");
		expect(partsZipName("holiday.jpg")).toBe("holiday-parts.zip");
		expect(partsZipName("archive.tar.gz")).toBe("archive.tar-parts.zip");
	});

	it("rejoins parts byte for byte", () => {
		const joined = joinBytes([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])]);
		expect([...joined]).toEqual([1, 2, 3, 4, 5, 6]);
		expect(() => joinBytes([])).toThrow(/Add the parts/u);
		expect(joinedName([{ name: "photo.png.part01of03" }])).toBe("photo.png");
		expect(joinedName([{ name: "notes.txt" }])).toBe("joined-file");
	});

	it("orders and checks parts by their numbers", () => {
		const parts = [{ name: "a.bin.part10of11" }, { name: "a.bin.part02of11" }, { name: "a.bin.part01of11" }];
		expect(orderParts(parts).map((part) => part.name)).toEqual(["a.bin.part01of11", "a.bin.part02of11", "a.bin.part10of11"]);
		expect(missingNumbers([{ name: "a.bin.part01of03" }, { name: "a.bin.part03of03" }])).toEqual([2]);
		expect(missingNumbers([{ name: "plain.txt" }])).toEqual([]);
	});
});
