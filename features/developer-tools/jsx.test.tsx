import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { htmlToJsx } from "@/features/developer-tools/jsx-utils";
import { JsxTool } from "@/features/developer-tools/jsx-tool";

afterEach(cleanup);

describe("HTML to JSX converter", () => {
	it("renames attributes and converts inline styles", () => {
		const jsx = htmlToJsx('<div class="a" data-x="1" style="font-size: 12px; color: #fff">Hi</div>', { wrap: false });
		expect(jsx).toBe('<div className="a" data-x="1" style={{ fontSize: "12px", color: "#fff" }}>Hi</div>');
	});

	it("self-closes void elements and keeps structure", () => {
		const jsx = htmlToJsx('<label for="seats">Seats</label><input id="seats" disabled><br>', { wrap: false });
		expect(jsx).toContain('<label htmlFor="seats">Seats</label>');
		expect(jsx).toContain('<input id="seats" disabled />');
		expect(jsx).toContain("<br />");
	});

	it("escapes braces and converts comments", () => {
		const jsx = htmlToJsx("<p>{value}</p><!-- note -->", { wrap: false });
		expect(jsx).toContain("<p>{'{'}value{'}'}</p>");
		expect(jsx).toContain("{/* note */}");
	});

	it("wraps output in a component by default", () => {
		const jsx = htmlToJsx("<h1>Title</h1>", { component: "Header" });
		expect(jsx).toBe("export default function Header() {\n  return (\n    <h1>Title</h1>\n  );\n}");
	});

	it("converts SVG attributes", () => {
		const jsx = htmlToJsx('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path stroke-width="2" fill-rule="evenodd" d="M0 0h10"/></svg>', {
			wrap: false,
		});
		expect(jsx).toContain('<svg viewBox="0 0 10 10">');
		expect(jsx).toContain('strokeWidth="2"');
		expect(jsx).toContain('fillRule="evenodd"');
		expect(jsx).toContain("/>");
	});

	it("rejects empty or broken markup", () => {
		expect(() => htmlToJsx("   ")).toThrow(/Paste HTML or SVG/u);
		expect(() => htmlToJsx("<svg><path></svg>", { svg: true })).toThrow(/Invalid SVG/u);
	});

	it("renders converted output and reacts to options", () => {
		render(<JsxTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("export default function PricingCard()");
		expect(output()).toContain('htmlFor="seats"');
		fireEvent.change(screen.getByLabelText("Component name"), { target: { value: "Plan" } });
		expect(output()).toContain("function Plan()");
		fireEvent.click(screen.getByLabelText("Wrap in a React component"));
		expect(output()).not.toContain("export default function");
		fireEvent.change(screen.getByLabelText("HTML or SVG"), { target: { value: "   " } });
		expect(screen.getByText(/Paste HTML or SVG/u)).toBeTruthy();
	});
});
