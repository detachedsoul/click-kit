import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("generated release notes", () => {
	it("stay synchronized with every non-merge commit", () => {
		const result = execFileSync(process.execPath, ["scripts/build-changelog.mjs", "--check"], {
			cwd: process.cwd(),
			encoding: "utf8",
		});
		expect(result).toContain("Generated changelog matches commit history.");
	});
});
