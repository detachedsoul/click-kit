import { describe, expect, it } from "vitest";
import { addedOnLabel, daysSinceAdded, isNewTool, NEW_WINDOW_DAYS, newToolCount, recentToolReleases, recentTools, toolAddedOn, TOOL_TRACKING_SINCE } from "@/lib/tool-recency";
import toolDates from "@/lib/tool-dates.generated.json";
import { tools } from "@/lib/tools";

/** The generated file must be regenerated (npm run tool-dates) whenever the catalogue changes. */
describe("tool dates", () => {
	it("has an entry for every tool in the catalogue", () => {
		const dates = toolDates.dates as Record<string, string | null>;
		const missing = tools.filter((tool) => !(tool.slug in dates));
		expect(missing.map((tool) => tool.slug)).toEqual([]);
	});

	it("knows when the newest tools arrived", () => {
		expect(toolAddedOn("meeting-planner")).toBeTruthy();
		expect(toolAddedOn("packing-list")).toBe("2026-11-21");
		expect(toolAddedOn("world-clock")).toBe("2026-11-21");
		expect(toolAddedOn("audio-visualizer")).toBe("2026-11-21");
		expect(toolAddedOn("word-counter")).toBeNull();
		expect(TOOL_TRACKING_SINCE).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
	});

	it("ages tools out of the new window", () => {
		const added = toolAddedOn("meeting-planner")!;
		const sameDay = new Date(`${added}T12:00:00Z`);
		expect(isNewTool("meeting-planner", sameDay)).toBe(true);
		expect(daysSinceAdded("meeting-planner", sameDay)).toBe(0);
		const later = new Date(`${added}T00:00:00Z`);
		later.setUTCDate(later.getUTCDate() + NEW_WINDOW_DAYS + 1);
		expect(isNewTool("meeting-planner", later)).toBe(false);
		expect(isNewTool("word-counter", sameDay)).toBe(false);
	});

	it("lists recent tools newest first and groups them by day", () => {
		const list = recentTools(new Date(`${TOOL_TRACKING_SINCE}T12:00:00Z`));
		expect(list.length).toBeGreaterThan(0);
		expect(list.length).toBe(newToolCount(new Date(`${TOOL_TRACKING_SINCE}T12:00:00Z`)));
		const releases = recentToolReleases(new Date(`${TOOL_TRACKING_SINCE}T12:00:00Z`));
		expect(releases.every((release) => release.tools.length > 0)).toBe(true);
		expect(releases.flatMap((release) => release.tools).length).toBe(list.length);
	});

	it("shows the audio visualizer in the latest What's New release", () => {
		const latest = recentToolReleases(new Date("2026-11-21T12:00:00Z"));
		expect(latest[0]?.date).toBe("2026-11-21");
		expect(latest[0]?.tools.some((tool) => tool.slug === "audio-visualizer")).toBe(true);
	});

	it("formats the added date for people", () => {
		expect(addedOnLabel("2026-11-18")).toBe("18 Nov 2026");
	});
});
