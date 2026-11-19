import { describe, expect, it } from "vitest";
import { INSTALL_DISMISS_DAYS, installInstructions, isIosDevice, isStandaloneMode, latestToolDate, shouldOfferInstall, supportsNotifications, toolNotification, unseenTools } from "@/lib/pwa";
import { recentTools, toolAddedOn } from "@/lib/tool-recency";

const now = new Date("2026-11-18T12:00:00Z");

describe("install prompt", () => {
	it("offers install on a first visit and inside the browser", () => {
		expect(shouldOfferInstall({ standalone: false, dismissedAt: null, now })).toBe(true);
		expect(shouldOfferInstall({ standalone: true, dismissedAt: null, now })).toBe(false);
	});

	it("respects the dismissal cooldown", () => {
		expect(shouldOfferInstall({ standalone: false, dismissedAt: "2026-11-10T00:00:00Z", now })).toBe(false);
		expect(shouldOfferInstall({ standalone: false, dismissedAt: "2026-10-01T00:00:00Z", now })).toBe(true);
		expect(shouldOfferInstall({ standalone: false, dismissedAt: "not a date", now })).toBe(true);
		expect(INSTALL_DISMISS_DAYS).toBe(21);
	});

	it("spots iOS and standalone windows", () => {
		expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
		expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mobile/15E148")).toBe(true);
		expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
		expect(isStandaloneMode(true, false)).toBe(true);
		expect(isStandaloneMode(false, true)).toBe(true);
		expect(isStandaloneMode(false, false)).toBe(false);
		expect(installInstructions(true)).toContain("Add to Home Screen");
		expect(installInstructions(false)).toContain("without an app store");
	});
});

describe("new tool notifications", () => {
	it("finds tools added after the last seen date", () => {
		const recent = recentTools(now);
		expect(recent.length).toBeGreaterThan(0);
		const newest = toolAddedOn(recent[0].slug) as string;
		expect(unseenTools(newest, now)).toEqual([]);
		expect(unseenTools(null, now).length).toBe(recent.length);
		expect(unseenTools("2020-01-01", now).length).toBe(recent.length);
		expect(unseenTools("2999-01-01", now)).toEqual([]);
	});

	it("writes a notification for one tool or several", () => {
		const [first, second] = recentTools(now);
		const single = toolNotification([first]);
		expect(single?.title).toBe(`New on ClickKit: ${first.name}`);
		expect(single?.url).toBe(`/tools/${first.slug}`);
		expect(single?.body).toContain("browser");
		const many = toolNotification([first, second, ...recentTools(now).slice(2, 6)]);
		expect(many?.title).toMatch(/new tools on ClickKit/u);
		expect(many?.body).toContain("more");
		expect(many?.url).toBe("/changelog");
		expect(toolNotification([])).toBeNull();
	});

	it("knows the newest catalogue date and what the browser can do", () => {
		expect(latestToolDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
		expect(supportsNotifications(true, true)).toBe(true);
		expect(supportsNotifications(false, true)).toBe(false);
		expect(supportsNotifications(true, false)).toBe(false);
	});
});
