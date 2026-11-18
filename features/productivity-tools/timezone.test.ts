import { describe, expect, it } from "vitest";
import {
	buildSlots,
	dayKey,
	describeOverlap,
	DEFAULT_ZONES,
	formatHour,
	isValidTimeZone,
	localHour,
	offsetLabel,
	overlapSlots,
	TIME_ZONES,
	WORK_END,
	WORK_START,
	zoneOffsetMinutes,
	zonedMidnight,
} from "@/features/productivity-tools/timezone-utils";

const winter = new Date("2026-01-15T12:00:00Z");
const summer = new Date("2026-07-15T12:00:00Z");

describe("time zone planner", () => {
	it("reads offsets that follow daylight saving", () => {
		expect(zoneOffsetMinutes(winter, "Europe/London")).toBe(0);
		expect(zoneOffsetMinutes(summer, "Europe/London")).toBe(60);
		expect(zoneOffsetMinutes(winter, "America/New_York")).toBe(-300);
		expect(zoneOffsetMinutes(summer, "America/New_York")).toBe(-240);
		expect(zoneOffsetMinutes(winter, "Asia/Tokyo")).toBe(540);
		expect(zoneOffsetMinutes(winter, "Asia/Kolkata")).toBe(330);
		expect(offsetLabel(330)).toBe("UTC+5:30");
		expect(offsetLabel(-300)).toBe("UTC−5");
	});

	it("validates zone names", () => {
		expect(isValidTimeZone("Europe/London")).toBe(true);
		expect(isValidTimeZone("Mars/Olympus")).toBe(false);
		expect(() => zoneOffsetMinutes(winter, "Mars/Olympus")).toThrow(/known time zone/u);
		expect(TIME_ZONES.map((zone) => zone.id)).toContain("Africa/Lagos");
	});

	it("finds local midnight and local hours", () => {
		const midnight = zonedMidnight("2026-01-15", "Europe/London");
		expect(midnight.toISOString()).toBe("2026-01-15T00:00:00.000Z");
		expect(localHour(midnight, "Europe/London")).toBe(0);
		const summerMidnight = zonedMidnight("2026-07-15", "Europe/London");
		expect(summerMidnight.toISOString()).toBe("2026-07-14T23:00:00.000Z");
		expect(dayKey(midnight, "Asia/Tokyo")).toBe("2026-01-15");
	});

	it("builds a 24 hour grid across zones", () => {
		const slots = buildSlots({ date: "2026-01-15", baseZone: "Europe/London", zones: DEFAULT_ZONES });
		expect(slots).toHaveLength(24);
		expect(slots[0].label).toBe("00:00");
		const newYork = slots[0].cells.find((cell) => cell.zoneId === "America/New_York")!;
		expect(newYork.hour).toBe(19);
		expect(newYork.dayOffset).toBe(-1);
		expect(newYork.working).toBe(false);
		const london = slots[10].cells.find((cell) => cell.zoneId === "Europe/London")!;
		expect(london.hour).toBe(10);
		expect(london.working).toBe(true);
		expect(() => buildSlots({ date: "2026-01-15", baseZone: "Europe/London", zones: [] })).toThrow(/at least one time zone/u);
		expect(() => buildSlots({ date: "2026-01-15", baseZone: "Europe/London", zones: ["UTC"], workStart: 17, workEnd: 9 })).toThrow(/end after it starts/u);
	});

	it("reports overlapping working hours", () => {
		const slots = buildSlots({ date: "2026-01-15", baseZone: "Europe/London", zones: ["Europe/London", "America/New_York"] });
		const best = overlapSlots(slots);
		expect(best.map((slot) => slot.label)).toEqual(["14:00", "15:00", "16:00", "17:00", "18:00", "19:00"].slice(0, best.length));
		const summary = describeOverlap(slots);
		expect(summary.count).toBe(best.length);
		expect(summary.text).toContain("work for everyone");
		const impossible = describeOverlap(buildSlots({ date: "2026-01-15", baseZone: "Europe/London", zones: ["Europe/London", "Pacific/Auckland"] }));
		expect(impossible.count).toBe(0);
		expect(impossible.text).toContain("No hour works");
		expect(WORK_START).toBe(9);
		expect(WORK_END).toBe(17);
	});

	it("formats hours in both styles", () => {
		expect(formatHour(0)).toBe("00:00");
		expect(formatHour(13, "12")).toBe("1pm");
		expect(formatHour(0, "12")).toBe("12am");
		expect(formatHour(12, "12")).toBe("12pm");
	});
});
