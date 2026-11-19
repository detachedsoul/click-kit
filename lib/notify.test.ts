import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alreadyAnnounced, markAnnounced, NOTIFIED_VERSION_KEY, notificationsReady, showToolNotification } from "@/lib/notify";

const showNotification = vi.fn(async () => undefined);

beforeEach(() => {
	window.sessionStorage.clear();
	showNotification.mockClear();
	vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn(async () => ({ showNotification })) } });
});

afterEach(() => {
	vi.unstubAllGlobals();
	window.sessionStorage.clear();
});

describe("notification helpers", () => {
	it("only allows alerts when the browser has permission and a worker", () => {
		expect(notificationsReady(true, true, "granted")).toBe(true);
		expect(notificationsReady(true, true, "default")).toBe(false);
		expect(notificationsReady(true, true, "denied")).toBe(false);
		expect(notificationsReady(false, true, "granted")).toBe(false);
		expect(notificationsReady(true, false, "granted")).toBe(false);
	});

	it("remembers the deploy it already announced, per tab", () => {
		expect(alreadyAnnounced("build-1")).toBe(false);
		markAnnounced("build-1");
		expect(alreadyAnnounced("build-1")).toBe(true);
		expect(alreadyAnnounced("build-2")).toBe(false);
		expect(window.sessionStorage.getItem(NOTIFIED_VERSION_KEY)).toBe("build-1");
	});

	it("hands the alert to the service worker with its destination", async () => {
		const shown = await showToolNotification({ title: "2 new tools", body: "Tap to look", url: "/changelog" });
		expect(shown).toBe(true);
		expect(showNotification).toHaveBeenCalledWith("2 new tools", expect.objectContaining({ body: "Tap to look", data: { url: "/changelog" } }));
	});

	it("reports a blocked alert instead of throwing", async () => {
		vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn(async () => ({ showNotification: vi.fn(async () => Promise.reject(new Error("blocked"))) })) } });
		const blocked = await showToolNotification({ title: "x", body: "y", url: "/" });
		expect(blocked).toBe(false);
	});
});
