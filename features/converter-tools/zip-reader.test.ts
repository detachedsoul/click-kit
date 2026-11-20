import { describe, expect, it } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { readZipEntries, readZipFile } from "@/features/converter-tools/zip-reader";

const encoder = new TextEncoder();

describe("zip reader", () => {
	it("reads back what the zip writer stored", async () => {
		const zip = await createZip([
			{ name: "one.txt", data: encoder.encode("first file") },
			{ name: "folder/two.txt", data: encoder.encode("second file") },
		]);
		const entries = await readZipEntries(zip);
		expect(entries.map((entry) => entry.name).sort()).toEqual(["folder/two.txt", "one.txt"]);
		const two = await readZipFile(zip, "two.txt");
		expect(two).toBe("second file");
	});

	it("handles a stored (uncompressed) archive too", async () => {
		const zip = await createZip([{ name: "plain.txt", data: encoder.encode("not deflated") }], { compress: false });
		expect(await readZipFile(zip, "plain.txt")).toBe("not deflated");
	});

	it("returns null for a missing file", async () => {
		const zip = await createZip([{ name: "one.txt", data: encoder.encode("x") }]);
		expect(await readZipFile(zip, "nope.txt")).toBeNull();
	});

	it("rejects something that is not a zip", async () => {
		await expect(readZipEntries(encoder.encode("just words"))).rejects.toThrow(/not a zip/u);
	});
});
