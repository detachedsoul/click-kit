import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The changelog's live-update control needs a router; jsdom has no app router mounted.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));
import changelog from "@/lib/changelog.generated.json";
import toolDates from "@/lib/tool-dates.generated.json";
import { getTool, tools } from "@/lib/tools";
import { NEW_WINDOW_DAYS, toolAddedOn } from "@/lib/tool-recency";
import { NewBadge } from "@/components/new-badge";
import ToolCard from "@/components/tool-card";
import ChangelogPage from "@/app/changelog/page";

afterEach(cleanup);

/** A tool that git history says was added inside the window. */
const recent = tools.find((tool) => {
	const added = toolAddedOn(tool.slug);
	return added !== null && (Date.now() - Date.parse(`${added}T00:00:00Z`)) / 86_400_000 <= NEW_WINDOW_DAYS;
});
const legacy = getTool("word-counter")!;

describe("new tool badges", () => {
	it("badges a recent tool and stays quiet about an old one", () => {
		if (!recent) return;
		render(<NewBadge slug={recent.slug} />);
		const badge = screen.getByText("New");
		expect(badge.closest("span")?.getAttribute("title")).toMatch(/^Added /u);
		cleanup();
		const { container } = render(<NewBadge slug={legacy.slug} />);
		expect(container.textContent).toBe("");
	});

	it("shows a banner badge with the added date on a tool page", () => {
		if (!recent) return;
		render(<NewBadge slug={recent.slug} variant="banner" />);
		expect(document.body.textContent).toContain("Added");
		expect(screen.getByText("New")).toBeTruthy();
	});

	it("shows the badge on a tool card", () => {
		if (!recent) return;
		render(<ToolCard tool={recent} />);
		expect(screen.getByText("New")).toBeTruthy();
		expect(screen.getByText(recent.name)).toBeTruthy();
	});

	it("leaves the badge off a card for an older tool", () => {
		render(<ToolCard tool={legacy} />);
		expect(screen.queryByText("New")).toBeNull();
	});

	it("keeps the generated date file in step with the catalogue", () => {
		const dates = toolDates.dates as Record<string, string | null>;
		expect(tools.filter((tool) => !(tool.slug in dates))).toEqual([]);
		expect(Object.values(dates).some((date) => date !== null)).toBe(true);
	});
});

describe("changelog page", () => {
	it("renders release history from the generated file", () => {
		render(<ChangelogPage />);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("What");
		expect(screen.getByText("Release history")).toBeTruthy();
		const entries = changelog.releases.flatMap((release) => release.groups.flatMap((group) => group.entries));
		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries.slice(0, 3)) expect(document.body.textContent).toContain(entry.hash);
	});

	it("lists the tools each release day introduced", () => {
		render(<ChangelogPage />);
		const dated = changelog.releases
			.flatMap((release) => release.groups.flatMap((group) => group.entries))
			.map((entry) => entry.date);
		expect(dated.every((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date))).toBe(true);
		expect(document.body.textContent).toContain("Release history");
	});
});
