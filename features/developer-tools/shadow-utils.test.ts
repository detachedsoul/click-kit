import { describe, expect, it } from "vitest";
import { clampOpacity, clampShadow, describeShadow, isHex, layerToCss, presetLayers, rgbaFromHex, shadowCss, shadowRule, shadowTailwind, SHADOW_PRESETS, type ShadowLayer } from "@/features/developer-tools/shadow-utils";

const layer = (patch: Partial<ShadowLayer> = {}): ShadowLayer => ({
	id: "l1",
	x: 0,
	y: 8,
	blur: 24,
	spread: -6,
	color: "#252820",
	opacity: 12,
	inset: false,
	...patch,
});

describe("box shadow", () => {
	it("turns a hex and an opacity into rgba", () => {
		expect(rgbaFromHex("#252820", 12)).toBe("rgba(37, 40, 32, 0.12)");
		expect(rgbaFromHex("b64b31", 100)).toBe("rgba(182, 75, 49, 1)");
		expect(rgbaFromHex("#fff", 50)).toBe("rgba(255, 255, 255, 0.5)");
		expect(() => rgbaFromHex("#12", 50)).toThrow(/hex colour/u);
		expect(isHex("#abc")).toBe(true);
		expect(isHex("#aabbcc")).toBe(true);
		expect(isHex("aabbcc")).toBe(false);
	});

	it("writes one layer and many", () => {
		expect(layerToCss(layer())).toBe("0px 8px 24px -6px rgba(37, 40, 32, 0.12)");
		expect(layerToCss(layer({ inset: true, blur: -4 }))).toBe("inset 0px 8px 0px -6px rgba(37, 40, 32, 0.12)");
		expect(shadowCss([layer(), layer({ id: "l2", x: 0, y: 2, blur: 4, spread: 0, opacity: 30 })])).toBe(
			"0px 8px 24px -6px rgba(37, 40, 32, 0.12), 0px 2px 4px 0px rgba(37, 40, 32, 0.3)",
		);
		expect(() => shadowCss([])).toThrow(/at least one shadow layer/u);
	});

	it("produces Tailwind and CSS blocks", () => {
		expect(shadowTailwind([layer()])).toBe("shadow-[0px_8px_24px_-6px_rgba(37,40,32,0.12)]");
		expect(shadowRule([layer()])).toBe(".card {\n\tbox-shadow: 0px 8px 24px -6px rgba(37, 40, 32, 0.12);\n}");
		expect(shadowRule([layer()], ".panel")).toContain(".panel {");
	});

	it("clamps values and describes the stack", () => {
		expect(clampShadow(5000)).toBe(200);
		expect(clampShadow(-5000)).toBe(-200);
		expect(clampShadow(Number.NaN)).toBe(0);
		expect(clampOpacity(-4)).toBe(0);
		expect(clampOpacity(400)).toBe(100);
		expect(describeShadow([])).toContain("No shadow layers");
		expect(describeShadow([layer(), layer({ id: "b", inset: true })])).toBe("2 layers, 1 inset");
		expect(describeShadow([layer()])).toBe("1 layer");
	});

	it("ships presets with ids", () => {
		expect(SHADOW_PRESETS.length).toBeGreaterThan(3);
		const stacked = SHADOW_PRESETS.find((preset) => preset.id === "stacked")!;
		expect(presetLayers(stacked).map((item) => item.id)).toEqual(["layer-1", "layer-2", "layer-3"]);
		expect(presetLayers(stacked, "x")[0].id).toBe("x-1");
	});
});
