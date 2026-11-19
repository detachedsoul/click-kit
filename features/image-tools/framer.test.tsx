import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FramerTool } from "@/features/image-tools/framer-tool";
import { backgroundCss, backgroundStops, FRAME_ASPECTS, FRAME_BACKGROUNDS, frameFileName, frameLayout, frameTextOn } from "@/features/image-tools/framer-utils";

const base = { image: { width: 800, height: 500 }, padding: 10, aspect: "auto" as const, radius: 20, shadow: false };

describe("screenshot framer", () => {
	it("adds equal padding on both axes", () => {
		const layout = frameLayout(base);
		expect(layout.canvas).toEqual({ width: 960, height: 600 });
		expect(layout.image).toMatchObject({ x: 80, y: 50, width: 800, height: 500 });
	});

	it("fills a forced aspect ratio without shrinking the picture", () => {
		const square = frameLayout({ ...base, aspect: "square" });
		expect(square.canvas.width).toBe(square.canvas.height);
		expect(square.canvas.width).toBeGreaterThanOrEqual(960);
		expect(square.image.width).toBe(800);
		const wide = frameLayout({ ...base, aspect: "wide" });
		expect(wide.canvas.width).toBeGreaterThan(wide.canvas.height);
		expect(wide.image.width).toBe(800);
		expect(FRAME_ASPECTS.map((option) => option.id)).toContain("portrait");
	});

	it("scales the corner radius from the shorter side", () => {
		expect(frameLayout({ ...base, radius: 0 }).radius).toBe(0);
		expect(frameLayout({ ...base, radius: 100 }).radius).toBe(250);
		expect(frameLayout({ ...base, radius: 200 }).radius).toBe(250);
	});

	it("leaves room for the shadow", () => {
		const shadowed = frameLayout({ ...base, shadow: true, aspect: "square" });
		expect(shadowed.image.y).toBeGreaterThanOrEqual(Math.round(500 * 0.045));
	});

	it("validates input", () => {
		expect(() => frameLayout({ ...base, image: { width: 0, height: 10 } })).toThrow(/Pick an image/u);
		expect(() => frameLayout({ ...base, padding: 90 })).toThrow(/Padding/u);
	});

	it("describes backgrounds for CSS and canvas", () => {
		const flat = FRAME_BACKGROUNDS[0];
		const gradient = FRAME_BACKGROUNDS.find((option) => option.to !== null)!;
		expect(backgroundStops(flat)).toEqual([flat.from]);
		expect(backgroundStops(gradient)).toEqual([gradient.from, gradient.to]);
		expect(backgroundCss(flat)).toBe(flat.from);
		expect(backgroundCss(gradient)).toContain("linear-gradient");
		expect(frameTextOn(FRAME_BACKGROUNDS[0])).toBe("#252820");
		expect(frameTextOn(FRAME_BACKGROUNDS[1])).toBe("#f6f4eb");
	});

	it("builds a tidy download name", () => {
		expect(frameFileName("Screenshot 2026-11-18.png", "png")).toBe("screenshot-2026-11-18-framed.png");
		expect(frameFileName("!!!.webp", "png")).toBe("image-framed.png");
	});
});

afterEach(cleanup);

describe("screenshot framer page", () => {
	it("shows the frame controls with sensible defaults", () => {
		render(<FramerTool />);
		expect(screen.getByLabelText("Padding (8%)")).toHaveProperty("value", "8");
		expect(screen.getByLabelText("Corner radius (12%)")).toHaveProperty("value", "12");
		expect(screen.getByLabelText("Add a drop shadow")).toHaveProperty("checked", true);
		expect(screen.getByRole("button", { name: "Warm paper" })).toHaveProperty("ariaPressed", "true");
		expect(screen.getByRole("button", { name: "Frame and download" })).toHaveProperty("disabled", true);
		expect(screen.queryByText("Frame size")).toBeNull();
	});
});
