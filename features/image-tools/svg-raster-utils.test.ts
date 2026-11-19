import { describe, expect, it } from "vitest";
import { parseSvgBox, rasterPlan, svgDataUrl, svgRasterWarnings } from "@/features/image-tools/svg-raster-utils";

describe("SVG raster helper", () => {
	it("reads explicit width and height", () => {
		expect(parseSvgBox('<svg width="24" height="18" viewBox="0 0 48 36"></svg>')).toEqual({ width: 24, height: 18, viewBox: { width: 48, height: 36 } });
	});

	it("falls back to the viewBox when sizes are percentages", () => {
		const box = parseSvgBox('<svg width="100%" height="100%" viewBox="0 0 300 150"><rect /></svg>');
		expect(box.width).toBeNull();
		expect(box.height).toBeNull();
		expect(box.viewBox).toEqual({ width: 300, height: 150 });
	});

	it("defaults to 300×150 when the SVG says nothing", () => {
		expect(parseSvgBox("<svg></svg>")).toEqual({ width: null, height: null, viewBox: null });
		expect(rasterPlan(parseSvgBox("<svg></svg>"), 600)).toEqual({ width: 600, height: 300, scale: 2 });
	});

	it("keeps the aspect ratio and the requested width", () => {
		expect(rasterPlan({ width: 24, height: 24, viewBox: null }, 240)).toEqual({ width: 240, height: 240, scale: 10 });
		expect(rasterPlan({ width: 1000, height: 500, viewBox: null }, 400)).toEqual({ width: 400, height: 200, scale: 0.4 });
	});

	it("caps the longest side and never returns a zero dimension", () => {
		const plan = rasterPlan({ width: 10, height: 4000, viewBox: null }, 4000, 2048);
		expect(plan.height).toBe(2048);
		expect(plan.width).toBeGreaterThan(0);
		expect(rasterPlan({ width: null, height: null, viewBox: null }, 0).width).toBe(1);
	});

	it("builds an inline data URL", () => {
		const url = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#fff"/></svg>');
		expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
		expect(url).toContain("%23fff");
		expect(url).not.toContain("#fff");
	});

	it("warns about things that break canvas export", () => {
		expect(svgRasterWarnings('<svg><script>alert(1)</script></svg>')).toHaveLength(1);
		expect(svgRasterWarnings('<svg><image href="https://example.com/a.png"/></svg>').join(" ")).toContain("Remote images");
		expect(svgRasterWarnings('<svg><rect width="10" height="10"/></svg>')).toEqual([]);
	});
});
