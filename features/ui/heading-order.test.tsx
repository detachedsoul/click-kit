import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import AllToolsPage from "@/app/tools/page";
import ChangelogPage from "@/app/changelog/page";
import NotFound from "@/app/not-found";
import PrivacyPage from "@/app/privacy/page";
import CategoryPage from "@/app/category/[slug]/page";
import ToolPage from "@/app/tools/[slug]/page";
import ToolsBrowser from "@/components/tools-browser";

afterEach(cleanup);

/** Heading levels in document order, as a screen reader meets them. */
const headingLevels = () => screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

const expectHealthyOutline = (levels: number[], label: string) => {
	expect(levels.length, `${label} should have headings`).toBeGreaterThan(0);
	expect(levels[0], `${label} should open with its h1`).toBe(1);
	expect(levels.filter((level) => level === 1).length, `${label} should have exactly one h1`).toBe(1);
	levels.forEach((level, index) => {
		const previous = levels[index - 1];
		if (index > 0 && level > previous + 1) {
			throw new Error(`${label}: h${previous} is followed by h${level}, skipping a level (${levels.join(", ")})`);
		}
	});
	expect(levels.some((level) => level >= 5), `${label} should not need h5 or h6`).toBe(false);
};

describe("heading outline", () => {
	it("keeps the home page in order", () => {
		render(<HomePage />);
		expectHealthyOutline(headingLevels(), "home");
	});

	it("keeps the all-tools page in order", () => {
		render(<AllToolsPage />);
		expectHealthyOutline(headingLevels(), "all tools");
	});

	it("keeps its outline while a filter is active", async () => {
		render(<ToolsBrowser />);
		const levels = headingLevels();
		expect(levels).toEqual([2, ...levels.slice(1)]);
		expectHealthyOutline([1, ...levels], "filtered tools");
	});

	it("keeps the changelog in order", () => {
		render(<ChangelogPage />);
		expectHealthyOutline(headingLevels(), "changelog");
	});

	it("keeps a category page in order", async () => {
		const ui = await CategoryPage({ params: Promise.resolve({ slug: "image" }) });
		render(ui);
		expectHealthyOutline(headingLevels(), "category");
	});

	it.each(["image-watermark", "gpa-calculator", "image-framer", "json-formatter"])("keeps the %s tool page in order", async (slug) => {
		const ui = await ToolPage({ params: Promise.resolve({ slug }) });
		render(ui);
		expectHealthyOutline(headingLevels(), slug);
	});

	it("keeps the legal and error pages in order", () => {
		render(<PrivacyPage />);
		expectHealthyOutline(headingLevels(), "privacy");
		cleanup();
		render(<NotFound />);
		expectHealthyOutline(headingLevels(), "not found");
	});

	it("names each tool card with an h3 under a section heading", () => {
		render(<AllToolsPage />);
		const levels = headingLevels();
		const firstCard = screen.getAllByRole("heading", { level: 3 })[0];
		expect(firstCard).toBeTruthy();
		// Every h3 must be preceded by an h2 in the outline.
		const indexOfFirstCard = levels.indexOf(3);
		expect(levels.slice(0, indexOfFirstCard)).toContain(2);
	});
});
