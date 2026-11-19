import { describe, expect, it } from "vitest";
import { FIRST_CHECK_MS, isStale, offlineMessage, parseSnapshot, POLL_INTERVAL_MS, updateMessage, upToDateMessage } from "@/lib/live-updates";
import { buildInfo, buildVersion } from "@/lib/build-info";

describe("build identity", () => {
	it("describes the running build", () => {
		const info = buildInfo();
		expect(info.version).toBe(buildVersion());
		expect(info.version).toMatch(/^[0-9a-f]{7,}-\d+$/u);
		expect(info.version.endsWith(`-${info.tools}`)).toBe(true);
		expect(info.tools).toBeGreaterThan(0);
		expect(info.latestTool).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
	});
});

describe("live updates", () => {
	it("reads version payloads and ignores rubbish", () => {
		expect(parseSnapshot({ version: "abc-131", tools: 131, commit: "abc", latestTool: "2026-11-19" })).toEqual({
			version: "abc-131",
			tools: 131,
			commit: "abc",
			latestTool: "2026-11-19",
		});
		expect(parseSnapshot({ version: "abc-131" })).toEqual({ version: "abc-131", tools: 0, commit: null, latestTool: null });
		expect(parseSnapshot({ tools: 4 })).toBeNull();
		expect(parseSnapshot("nope")).toBeNull();
		expect(parseSnapshot(null)).toBeNull();
	});

	it("spots a newer deploy", () => {
		expect(isStale("abc-131", { version: "abc-131", tools: 131 })).toBe(false);
		expect(isStale("abc-131", { version: "def-132", tools: 132 })).toBe(true);
		expect(isStale("abc-131", null)).toBe(false);
	});

	it("says what changed", () => {
		expect(updateMessage({ version: "def-133", tools: 133 }, 131)).toBe("2 new tools just landed — updating…");
		expect(updateMessage({ version: "def-132", tools: 132 }, 131)).toBe("1 new tool just landed — updating…");
		expect(updateMessage({ version: "def-131", tools: 131 }, 131)).toBe("A newer build is available — updating…");
		expect(updateMessage(null, 131)).toContain("Checking");
		expect(upToDateMessage).toContain("newest version");
		expect(offlineMessage).toContain("Could not reach the server");
		expect(FIRST_CHECK_MS).toBeLessThan(POLL_INTERVAL_MS);
	});
});
