import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/tools/[slug]/page.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

describe("packing list print scope", () => {
	it("marks the packing page and its one printable tool panel", () => {
		expect(route).toContain('data-print-page={tool.slug === "packing-list" ? "packing-list" : undefined}');
		expect(route).toContain('data-print={tool.slug === "packing-list" ? "packing-list" : undefined}');
	});

	it("hides the page around the list and keeps the main content area", () => {
		expect(styles).toContain('body:has([data-print-page="packing-list"]) > *');
		expect(styles).toContain('body:has([data-print-page="packing-list"]) > main');
		expect(styles).toContain('[data-print-page="packing-list"] > :not([data-print="packing-list"])');
	});

	it("keeps only the selected tool panel, then hides its own controls", () => {
		expect(styles).toContain('body:has([data-print-page="packing-list"]) [data-print="packing-list"]');
		expect(styles).toContain('[data-print="hide"]');
		expect(styles).toContain('[data-print="sheet"]');
	});
});
