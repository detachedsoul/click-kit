import { describe, expect, it } from "vitest";
import {
	distanceForTime,
	evenSplits,
	formatDistance,
	formatDuration,
	formatPace,
	pacePerKm,
	parseDistance,
	parseDuration,
	speedKph,
	timeForDistance,
} from "@/features/calculators/pace-utils";

describe("pace calculator", () => {
	it("parses and formats times", () => {
		expect(parseDuration("45:30")).toBe(2730);
		expect(parseDuration("1:05:30")).toBe(3930);
		expect(parseDuration("90")).toBe(90);
		expect(parseDuration("1h 5m 30s")).toBe(3930);
		expect(formatDuration(2730)).toBe("45:30");
		expect(formatDuration(3930)).toBe("1:05:30");
		expect(formatDuration(0)).toBe("0:00");
		expect(() => parseDuration("1:75")).toThrow(/Seconds/u);
		expect(() => parseDuration("nope")).toThrow(/positive number/u);
	});

	it("parses distances in kilometres and miles", () => {
		expect(parseDistance("10k")).toBe(10);
		expect(parseDistance("10 km")).toBe(10);
		expect(parseDistance("42.195")).toBe(42.195);
		expect(parseDistance("6.2 mi")).toBeCloseTo(9.9779, 3);
		expect(() => parseDistance("far")).toThrow(/distance/u);
		expect(formatDistance(42.195)).toBe("42.2 km");
		expect(formatDistance(1.609344, "mi")).toBe("1.00 mi");
	});

	it("solves pace, time, and distance", () => {
		expect(pacePerKm(10, 3000)).toBe(300);
		expect(formatPace(300)).toBe("5:00 /km");
		expect(formatPace(300, "mi")).toBe("8:03 /mi");
		expect(timeForDistance(21.0975, 300)).toBeCloseTo(6329.25, 2);
		expect(distanceForTime(3600, 300)).toBe(12);
		expect(speedKph(10, 3000)).toBe(12);
		expect(() => pacePerKm(0, 3000)).toThrow(/Distance/u);
	});

	it("splits a race evenly", () => {
		const splits = evenSplits(12, 3600);
		expect(splits).toHaveLength(3);
		expect(splits[0]).toEqual({ distance: 5, time: 1500 });
		expect(splits[2].distance).toBe(12);
		expect(() => evenSplits(0, 100)).toThrow(/Distance/u);
	});
});
