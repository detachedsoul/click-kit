import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckForUpdates, LiveUpdates } from "@/components/live-updates";
import { FIRST_CHECK_MS } from "@/lib/live-updates";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const respondWith = (body: unknown, ok = true) => {
	vi.stubGlobal("fetch", vi.fn(async () => ({ ok, json: async () => body })));
};

beforeEach(() => {
	refresh.mockClear();
	vi.stubGlobal("serviceWorker", { getRegistration: vi.fn(async () => ({ update: vi.fn(async () => undefined) })) });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("live updates", () => {
	it("refreshes the page in place when a newer build is served", async () => {
		vi.useFakeTimers();
		respondWith({ version: "newcommit-132", tools: 132, commit: "newcommit", latestTool: "2026-11-19" });
		render(<LiveUpdates tools={131} version="oldcommit-131" />);
		expect(screen.queryByRole("status")).toBeNull();
		await act(async () => {
			vi.advanceTimersByTime(FIRST_CHECK_MS + 10);
		});
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("status").textContent).toContain("1 new tool just landed");
	});

	it("stays quiet while the build matches", async () => {
		vi.useFakeTimers();
		respondWith({ version: "same-131", tools: 131 });
		const { container } = render(<LiveUpdates tools={131} version="same-131" />);
		await act(async () => {
			vi.advanceTimersByTime(FIRST_CHECK_MS + 10);
		});
		expect(refresh).not.toHaveBeenCalled();
		expect(container.textContent).toBe("");
	});

	it("does nothing when the version endpoint is unreachable", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
		const { container } = render(<LiveUpdates tools={131} version="oldcommit-131" />);
		await act(async () => {
			vi.advanceTimersByTime(FIRST_CHECK_MS + 10);
		});
		expect(refresh).not.toHaveBeenCalled();
		expect(container.textContent).toBe("");
	});
});

describe("changelog check button", () => {
	it("asks for news on demand and refreshes when there is some", async () => {
		respondWith({ version: "newcommit-133", tools: 133 });
		const user = userEvent.setup();
		render(<CheckForUpdates tools={131} version="oldcommit-131" />);
		expect(screen.getByRole("button", { name: /Check for new entries/u })).toBeTruthy();
		await user.click(screen.getByRole("button", { name: /Check for new entries/u }));
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(document.body.textContent).toContain("2 new tools just landed");
	});

	it("confirms when nothing is waiting", async () => {
		respondWith({ version: "same-131", tools: 131 });
		const user = userEvent.setup();
		render(<CheckForUpdates tools={131} version="same-131" />);
		await user.click(screen.getByRole("button", { name: /Check for new entries/u }));
		expect(refresh).not.toHaveBeenCalled();
		expect(document.body.textContent).toContain("newest version");
	});

	it("explains an offline check", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
		const user = userEvent.setup();
		render(<CheckForUpdates tools={131} version="same-131" />);
		await user.click(screen.getByRole("button", { name: /Check for new entries/u }));
		expect(document.body.textContent).toContain("Could not reach the server");
	});
});
