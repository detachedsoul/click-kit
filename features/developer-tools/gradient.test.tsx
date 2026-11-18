import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildGradient, isColour, normaliseStops, toPreviewStyle, type GradientOptions } from "@/features/developer-tools/gradient-utils";
import { GradientTool } from "@/features/developer-tools/gradient-tool";

afterEach(cleanup);

const base: GradientOptions = { type: "linear", angle: 135, repeating: false, shape: "circle", stops: [{ color: "#ff0000", position: 0 }, { color: "#0000ff", position: 100 }] };

describe("CSS gradient generator", () => {
	it("validates colours", () => {
		expect(isColour("#abc")).toBe(true);
		expect(isColour("rgba(0,0,0,.5)")).toBe(true);
		expect(isColour("hsl(200 50% 40%)")).toBe(true);
		expect(isColour("rebeccapurple")).toBe(true);
		expect(isColour("not a colour!")).toBe(false);
		expect(() => buildGradient({ ...base, stops: [{ color: "nope!", position: 0 }] })).toThrow(/not a recognised CSS colour/u);
	});

	it("sorts and clamps stops", () => {
		expect(normaliseStops([{ color: "#000", position: 80 }, { color: "#fff", position: 20 }]).map((stop) => stop.position)).toEqual([20, 80]);
		expect(normaliseStops([{ color: "#000", position: 10 }])).toHaveLength(2);
		expect(() => normaliseStops([])).toThrow(/at least one/u);
		expect(buildGradient({ ...base, stops: [{ color: "#fff", position: -5 }, { color: "#000", position: 150 }] })).toBe("background-image: linear-gradient(135deg, #fff 0%, #000 100%);");
	});

	it("builds each gradient type", () => {
		expect(buildGradient(base)).toBe("background-image: linear-gradient(135deg, #ff0000 0%, #0000ff 100%);");
		expect(buildGradient({ ...base, angle: -90 })).toContain("linear-gradient(270deg");
		expect(buildGradient({ ...base, type: "radial" })).toContain("radial-gradient(circle at 50% 50%");
		expect(buildGradient({ ...base, type: "radial", shape: "ellipse" })).toContain("ellipse");
		expect(buildGradient({ ...base, type: "conic", angle: 45 })).toContain("conic-gradient(from 45deg at 50% 50%");
		expect(buildGradient({ ...base, repeating: true })).toContain("repeating-linear-gradient");
		expect(toPreviewStyle("background-image: linear-gradient(135deg, #f00 0%);")).toBe("linear-gradient(135deg, #f00 0%)");
	});

	it("renders CSS and responds to stop edits", () => {
		render(<GradientTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("linear-gradient(120deg");
		fireEvent.change(screen.getByLabelText("Stop 1 colour value"), { target: { value: "#123456" } });
		expect(output()).toContain("#123456 0%");
		fireEvent.change(screen.getByLabelText("Stop 2 position"), { target: { value: "40" } });
		expect(output()).toContain("#ff2d78 40%");
		fireEvent.change(screen.getByLabelText("Stop 1 colour value"), { target: { value: "bogus colour" } });
		expect(screen.getByText(/not a recognised CSS colour/u)).toBeTruthy();
	});
});
