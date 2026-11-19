import { describe, expect, it } from "vitest";
import { allPlatformReports, countGraphemes, lengthSummary, linkCount, PLATFORMS, platformReport, smsSegments, weightedLength, wordCount } from "@/features/text-tools/post-length-utils";

const x = PLATFORMS.find((platform) => platform.id === "x")!;
const sms = PLATFORMS.find((platform) => platform.id === "sms")!;

describe("post length", () => {
	it("counts what people see, emoji and accents included", () => {
		expect(countGraphemes("hello")).toBe(5);
		expect(countGraphemes("👨‍👩‍👧")).toBe(1);
		expect(countGraphemes("café")).toBe(4);
		expect(countGraphemes("")).toBe(0);
	});

	it("charges links at 23 characters on X", () => {
		const short = "Look at https://click-kit.vercel.app/tools/image-resizer now";
		expect(linkCount(short)).toBe(1);
		expect(weightedLength("Look at this now", "x")).toBe(16);
		expect(weightedLength(short, "x")).toBe(countGraphemes("Look at  now") + 23);
		// Everywhere else a link is counted as typed.
		expect(weightedLength(short, "linkedin")).toBe(countGraphemes(short));
		expect(linkCount("no links here")).toBe(0);
	});

	it("works out SMS parts", () => {
		expect(smsSegments("")).toBe(0);
		expect(smsSegments("a".repeat(160))).toBe(1);
		expect(smsSegments("a".repeat(161))).toBe(2);
		expect(smsSegments("a".repeat(306))).toBe(2);
		expect(smsSegments("a".repeat(307))).toBe(3);
		// Anything outside the GSM alphabet drops to 70 characters per part.
		expect(smsSegments("é".repeat(70))).toBe(1);
		expect(smsSegments("ж".repeat(71))).toBe(2);
	});

	it("reports room left per platform", () => {
		const report = platformReport("hello", x);
		expect(report.used).toBe(5);
		expect(report.remaining).toBe(275);
		expect(report.over).toBe(0);
		expect(report.fits).toBe(true);
		expect(report.percent).toBe(1.8);
		const tooLong = platformReport("a".repeat(300), x);
		expect(tooLong.over).toBe(20);
		expect(tooLong.fits).toBe(false);
		expect(tooLong.remaining).toBe(0);
		expect(tooLong.percent).toBe(100);
		const smsOver = platformReport("a".repeat(170), sms);
		expect(smsOver.over).toBe(10);
	});

	it("summarises every platform and the wording", () => {
		const reports = allPlatformReports("a short note");
		expect(reports).toHaveLength(PLATFORMS.length);
		expect(reports.every((report) => report.limit > 0)).toBe(true);
		expect(lengthSummary({ used: 20, limit: 280 })).toBe("260 of 280 left");
		expect(lengthSummary({ used: 300, limit: 280 })).toBe("20 over the 280 limit");
		expect(wordCount("  one two   three ")).toBe(3);
		expect(wordCount("   ")).toBe(0);
	});
});
