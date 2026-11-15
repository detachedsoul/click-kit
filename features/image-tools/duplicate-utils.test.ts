import { describe, expect, it } from "vitest";
import { groupDuplicates, reportCsv, type DuplicateFile } from "@/features/image-tools/duplicate-utils";

const file = (name: string, text: string) => new File([text], name, { lastModified: 1 });
const record = (id: string, name: string, hash: string, content = "identical"): DuplicateFile => ({ id, file: file(name, content), hash });

describe("duplicate file grouping", () => {
	it("groups only matching hashes and notes filename differences", () => {
		const groups = groupDuplicates([
			record("a", "copy.txt", "same"), record("b", "renamed.txt", "same"), record("c", "other.txt", "unique", "other"),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({ hash: "same", size: 9, sameName: false });
		expect(groups[0].files.map(({ id }) => id)).toEqual(["a", "b"]);
	});

	it("orders groups by recoverable size then name and detects identical names", () => {
		const groups = groupDuplicates([
			record("a", "tiny", "t", "x"), record("b", "tiny", "t", "x"),
			record("c", "big", "b", "large-content"), record("d", "big", "b", "large-content"),
		]);
		expect(groups.map(({ hash }) => hash)).toEqual(["b", "t"]);
		expect(groups.every(({ sameName }) => sameName)).toBe(true);
	});

	it("exports quoted CSV rows with the selected keep/remove action", () => {
		const groups = groupDuplicates([record("a", 'say "hi".txt', "abc"), record("b", "copy.txt", "abc")]);
		const csv = reportCsv(groups, new Set(["b"]));
		expect(csv).toContain('"say ""hi"".txt"');
		expect(csv).toContain('"Remove from cleaned ZIP"');
		expect(csv).toContain('"Keep"');
	});
});
