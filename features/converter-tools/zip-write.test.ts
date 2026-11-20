import { describe, expect, it } from "vitest";
import { readZipEntries } from "@/features/converter-tools/zip-reader";
import { crc32, writeZip } from "@/features/converter-tools/zip-write";

const names = async (bytes: Uint8Array) => (await readZipEntries(bytes)).map((entry) => entry.name).sort();

describe("writing a zip", () => {
	it("round-trips the files it was given", async () => {
		const zip = writeZip([
			{ data: "hello", name: "a.txt" },
			{ data: new Uint8Array([1, 2, 3]), name: "dir/b.bin" },
		]);
		expect(await names(zip)).toEqual(["a.txt", "dir/b.bin"]);
		const entries = await readZipEntries(zip);
		expect(new TextDecoder().decode(entries.find((entry) => entry.name === "a.txt")?.bytes)).toBe("hello");
		expect(Array.from(entries.find((entry) => entry.name === "dir/b.bin")?.bytes ?? [])).toEqual([1, 2, 3]);
	});

	it("writes the same bytes for the same input", async () => {
		const first = writeZip([{ data: "same", name: "x.txt" }]);
		const second = writeZip([{ data: "same", name: "x.txt" }]);
		expect(Array.from(first)).toEqual(Array.from(second));
	});

	it("checksums the way the zip format expects", () => {
		// The well-known CRC-32 of "123456789".
		expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
		expect(crc32(new Uint8Array())).toBe(0);
	});

	it("keeps a long file name and an empty file intact", async () => {
		const zip = writeZip([{ data: "", name: "empty.txt" }]);
		const [entry] = await readZipEntries(zip);
		expect(entry.name).toBe("empty.txt");
		expect(entry.bytes.length).toBe(0);
	});
});
