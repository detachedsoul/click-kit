import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildClamp, clampPresets, sizeAtViewport, type ClampOptions } from "@/features/developer-tools/clamp-utils";
import { ClampTool } from "@/features/developer-tools/clamp-tool";

afterEach(cleanup);

const base: ClampOptions = { minSize: 16, maxSize: 32, minViewport: 400, maxViewport: 1200, rootFontSize: 16, useRem: false };

describe("fluid clamp() generator", () => {
	it("computes slope, intercept, and CSS", () => {
		const result = buildClamp(base);
		expect(result.slope).toBe(0.02);
		expect(result.intercept).toBe(8);
		expect(result.css).toBe("clamp(16px, calc(2vw + 8px), 32px)");
		expect(result.preferred).toBe("calc(2vw + 8px)");
	});

	it("converts to rem", () => {
		const result = buildClamp({ ...base, useRem: true });
		expect(result.css).toBe("clamp(1rem, calc(2vw + 0.5rem), 2rem)");
		expect(result.minRem).toBe(1);
		expect(result.maxRem).toBe(2);
		expect(result.customProperty).toContain("--fluid-size:");
	});

	it("interpolates within the clamped range", () => {
		expect(sizeAtViewport(base, 400)).toBe(16);
		expect(sizeAtViewport(base, 800)).toBe(24);
		expect(sizeAtViewport(base, 2000)).toBe(32);
		expect(sizeAtViewport(base, 200)).toBe(16);
		expect(clampPresets.every((preset) => preset.options.minSize < preset.options.maxSize)).toBe(true);
	});

	it("validates its inputs", () => {
		expect(() => buildClamp({ ...base, minSize: 40, maxSize: 20 })).toThrow(/cannot exceed/u);
		expect(() => buildClamp({ ...base, minViewport: 1200, maxViewport: 400 })).toThrow(/smaller than the maximum viewport/u);
		expect(() => buildClamp({ ...base, minSize: 0 })).toThrow(/greater than zero/u);
		expect(() => buildClamp({ ...base, rootFontSize: 0 })).toThrow(/Root font size/u);
		expect(() => buildClamp({ ...base, maxSize: Number.NaN })).toThrow(/must be a number/u);
	});

	it("renders the CSS and updates live", () => {
		render(<ClampTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("clamp(2rem, calc(3.478vw + 1.217rem), 4rem)");
		fireEvent.change(screen.getByLabelText("Min font size (px)"), { target: { value: "20" } });
		expect(output()).toContain("clamp(1.25rem");
		fireEvent.change(screen.getByLabelText("Min viewport (px)"), { target: { value: "0" } });
		expect(screen.getByText(/greater than zero/u)).toBeTruthy();
	});
});
