import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaWidget } from "@/components/pwa-widget";
import { NotifyOptIn } from "@/components/notify-opt-in";
import { INSTALL_DISMISS_KEY } from "@/lib/pwa";

const installPrompt = () => {
	const event = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
	event.prompt = vi.fn(async () => undefined);
	event.userChoice = Promise.resolve({ outcome: "accepted" });
	return event;
};

const fakeServiceWorker = () => ({
	register: vi.fn(async () => ({ showNotification: vi.fn(async () => undefined), addEventListener: vi.fn() })),
	ready: Promise.resolve({ showNotification: vi.fn(async () => undefined) }),
	getRegistration: vi.fn(async () => ({ showNotification: vi.fn(async () => undefined) })),
	addEventListener: vi.fn(),
});

beforeEach(() => {
	window.localStorage.clear();
	Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: fakeServiceWorker() });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("install prompt", () => {
	it("waits a moment, then invites the visitor to install", async () => {
		vi.useFakeTimers();
		render(<PwaWidget />);
		act(() => {
			window.dispatchEvent(installPrompt());
		});
		expect(screen.queryByText("Keep ClickKit in your pocket")).toBeNull();
		act(() => {
			vi.advanceTimersByTime(7000);
		});
		expect(screen.getByText("Keep ClickKit in your pocket")).toBeTruthy();
		expect(screen.getByRole("button", { name: /Install app/u })).toBeTruthy();
		expect(document.body.textContent).toContain("No account, no store");
	});

	it("stops asking for three weeks after a dismissal", () => {
		vi.useFakeTimers();
		render(<PwaWidget />);
		act(() => {
			window.dispatchEvent(installPrompt());
			vi.advanceTimersByTime(7000);
		});
		fireEvent.click(screen.getByRole("button", { name: "Not now" }));
		expect(screen.queryByText("Keep ClickKit in your pocket")).toBeNull();
		expect(window.localStorage.getItem(INSTALL_DISMISS_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
	});

	it("stays out of the way once installed", () => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
		});
		render(<PwaWidget />);
		act(() => {
			window.dispatchEvent(installPrompt());
		});
		expect(screen.queryByText("Keep ClickKit in your pocket")).toBeNull();
	});
});

describe("new tool alerts", () => {
	it("asks for permission on the changelog", async () => {
		const request = vi.fn(async () => "granted" as NotificationPermission);
		Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "default", requestPermission: request } });
		const user = userEvent.setup();
		render(<NotifyOptIn />);
		await user.click(screen.getByRole("button", { name: "Notify me about new tools" }));
		expect(request).toHaveBeenCalled();
		expect(document.body.textContent).toContain("Alerts on");
	});

	it("explains when alerts are blocked", () => {
		Object.defineProperty(window, "Notification", { configurable: true, value: { permission: "denied", requestPermission: vi.fn() } });
		render(<NotifyOptIn />);
		expect(document.body.textContent).toContain("blocked in this browser");
		expect(screen.queryByRole("button", { name: "Notify me about new tools" })).toBeNull();
	});
});
