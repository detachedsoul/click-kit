import { describe, expect, it } from "vitest";
import {
	convertLocalTime,
	dateDifference,
	findWorkingOverlap,
	FAVOURITE_KEY,
	isZone,
	localTimeToInstant,
	MAX_CITIES,
	offsetAt,
	overlapSummary,
	reviveZones,
	toggleFavourite,
	zoneDateTime,
	zoneName,
	CLOCK_KEY,
} from "@/features/productivity-tools/world-clock-utils";

describe("world clock", () => {
	const instant = new Date("2026-01-15T12:00:00Z");

	it("formats a city's own local date and time with Intl", () => {
		expect(zoneDateTime(instant, "Africa/Lagos")).toContain("13:00");
		expect(zoneDateTime(instant, "America/New_York")).toContain("07:00");
	});

	it("uses the IANA database for winter and summer offsets", () => {
		expect(offsetAt(instant, "America/New_York")).toBe("UTC−5");
		expect(offsetAt(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe("UTC−4");
		expect(offsetAt(instant, "Asia/Kolkata")).toBe("UTC+5:30");
	});

	it("shows a city one calendar day ahead or behind", () => {
		const midnightUtc = new Date("2026-01-15T23:30:00Z");
		expect(dateDifference(midnightUtc, "Asia/Tokyo", "America/New_York")).toBe(1);
		expect(dateDifference(midnightUtc, "America/Los_Angeles", "Asia/Tokyo")).toBe(-1);
		expect(dateDifference(instant, "Africa/Lagos", "Europe/London")).toBe(0);
	});

	it("converts a meeting time and carries offsets and day changes with it", () => {
		const converted = convertLocalTime("2026-01-15T09:00", "Africa/Lagos", ["Europe/London", "America/New_York", "Asia/Tokyo"]);
		expect(converted.instant.toISOString()).toBe("2026-01-15T08:00:00.000Z");
		expect(converted.conversions.map((entry) => entry.label)).toEqual(expect.arrayContaining([expect.stringContaining("08:00"), expect.stringContaining("03:00"), expect.stringContaining("17:00")]));
		expect(converted.conversions.find((entry) => entry.zone === "America/New_York")?.offset).toBe("UTC−5");
	});

	it("converts through the correct seasonal offset, not a fixed offset", () => {
		const summer = convertLocalTime("2026-07-15T09:00", "America/New_York", ["Europe/London"]);
		expect(summer.instant.toISOString()).toBe("2026-07-15T13:00:00.000Z");
		expect(summer.conversions[0].label).toContain("14:00");
	});

	it("explains when the wall time never happens at the spring clock change", () => {
		expect(() => localTimeToInstant("2026-03-08T02:30", "America/New_York")).toThrow(/does not exist/u);
	});

	it("refuses a zone name the browser does not know", () => {
		expect(isZone("Mars/Olympus")).toBe(false);
		expect(() => zoneDateTime(instant, "Mars/Olympus")).toThrow(/valid IANA time zone/u);
	});

	it("uses a readable label for common zones and the city name for others", () => {
		expect(zoneName("Africa/Lagos")).toBe("Lagos");
		expect(zoneName("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
	});
});

describe("finding a time for everyone", () => {
	it("finds working hours for Lagos, London, and New York in winter", () => {
		const slots = findWorkingOverlap("2026-01-15", "Africa/Lagos", ["Africa/Lagos", "Europe/London", "America/New_York"]);
		expect(slots.map((slot) => slot.anchorHour)).toEqual([15, 16]);
		expect(overlapSummary(slots, "Africa/Lagos")).toContain("15:00–17:00");
	});

	it("recomputes shared time across daylight saving", () => {
		const winter = findWorkingOverlap("2026-01-15", "Africa/Lagos", ["Africa/Lagos", "America/New_York"]);
		const summer = findWorkingOverlap("2026-07-15", "Africa/Lagos", ["Africa/Lagos", "America/New_York"]);
		expect(winter.map((slot) => slot.anchorHour)).not.toEqual(summer.map((slot) => slot.anchorHour));
	});

	it("returns no shared hour when a city is too far away", () => {
		const slots = findWorkingOverlap("2026-01-15", "Africa/Lagos", ["Africa/Lagos", "Asia/Tokyo"]);
		expect(slots).toEqual([]);
		expect(overlapSummary(slots, "Africa/Lagos")).toContain("no shared");
	});

	it("returns no slots when there are no cities to compare", () => {
		expect(findWorkingOverlap("2026-01-15", "UTC", [])).toEqual([]);
	});

	it("bounds the comparison to that city's actual local day on daylight-saving dates", () => {
		const spring = findWorkingOverlap("2026-03-08", "America/New_York", ["America/New_York"]);
		const autumn = findWorkingOverlap("2026-11-01", "America/New_York", ["America/New_York"]);
		expect(spring.map((slot) => slot.anchorHour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
		expect(autumn.map((slot) => slot.anchorHour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
	});
});

describe("keeping cities close", () => {
	it("remembers selected IANA zones and ignores bad values", () => {
		expect(reviveZones(["Europe/London", "Mars/Olympus", "Europe/London"])).toEqual(["Europe/London"]);
		expect(CLOCK_KEY).toBe("clickkit-world-clock-cities");
	});

	it("keeps an intentionally empty clock, but falls back if storage is malformed", () => {
		expect(reviveZones([], ["Africa/Lagos", "Europe/London"])).toEqual([]);
		expect(reviveZones("not a city list", ["Africa/Lagos", "Europe/London"])).toEqual(["Africa/Lagos", "Europe/London"]);
	});

	it("keeps the city list inside its promised size", () => {
		const zones = Array.from({ length: MAX_CITIES + 4 }, (_, index) => `Etc/GMT${index < 12 ? `-${index}` : `+${index - 12}`}`);
		expect(reviveZones(zones)).toHaveLength(MAX_CITIES);
	});

	it("adds and removes favourites without duplicates", () => {
		const one = toggleFavourite([], "Africa/Lagos");
		expect(toggleFavourite(one, "Africa/Lagos")).toEqual([]);
		expect(toggleFavourite(one, "Europe/London")).toEqual(["Africa/Lagos", "Europe/London"]);
		expect(FAVOURITE_KEY).toBe("clickkit-world-clock-favourites");
	});
});
