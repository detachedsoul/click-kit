import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatBytes, optimiseSvg } from "@/features/developer-tools/svg-utils";
import { SvgTool } from "@/features/developer-tools/svg-tool";

afterEach(cleanup);

describe("SVG optimiser", () => {
	it("removes comments, metadata, and editor attributes", () => {
		const report = optimiseSvg(
			'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://inkscape.org/ns" inkscape:version="1.2" width="10"><!-- note --><metadata>x</metadata><g inkscape:label="Layer"><rect width="10" height="4"/></g></svg>',
		);
		expect(report.commentCount).toBe(1);
		expect(report.metadataCount).toBe(1);
		expect(report.editorAttributeCount).toBe(3);
		expect(report.output).not.toContain("inkscape");
		expect(report.output).not.toContain("<!--");
		expect(report.output).not.toContain("metadata");
		expect(report.output).toContain("<rect");
	});

	it("rounds numeric attributes and tidies path data", () => {
		const report = optimiseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24.000px" viewBox="0 0 24.0000 24.0000"><path d="M12.34567 2.5000 L21.5000 12.0000 Z" stroke-width="1.50000"/></svg>');
		expect(report.output).toContain('viewBox="0 0 24 24"');
		expect(report.output).toContain('d="M12.35 2.5L21.5 12Z"');
		expect(report.output).toContain('stroke-width="1.5"');
		expect(optimiseSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.4 2.6"/></svg>', { decimals: 0 }).output).toContain('d="M1 3"');
	});

	it("keeps ids, titles, and empty-element form by default", () => {
		const report = optimiseSvg('<svg xmlns="http://www.w3.org/2000/svg" id="root"><title>Icon</title><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect id="box" fill="url(#g)"/></svg>');
		expect(report.output).toContain("<title>Icon</title>");
		expect(report.output).toContain('id="g"');
		expect(report.output).toContain('id="box"');
		expect(report.output).toContain("url(#g)");
		expect(report.output).toContain('id="root"');
		expect(optimiseSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect id="box"/><title>Icon</title></svg>', { removeIds: true, keepTitle: false }).output).not.toContain('id="box"');
	});

	it("minifies or pretty-prints", () => {
		const source = '<svg xmlns="http://www.w3.org/2000/svg">\n  <g>\n    <rect width="4" height="2"/>\n  </g>\n</svg>';
		expect(optimiseSvg(source).output).toBe('<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="4" height="2"/></g></svg>');
		expect(optimiseSvg(source, { prettify: true }).output).toContain("\n  <g>");
	});

	it("reports sizes and validates input", () => {
		const report = optimiseSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');
		expect(report.before).toBeGreaterThan(0);
		expect(report.after).toBeGreaterThan(0);
		expect(formatBytes(2048)).toBe("2.0 kB");
		expect(formatBytes(512)).toBe("512 B");
		expect(() => optimiseSvg("   ")).toThrow(/Paste SVG markup/u);
		expect(() => optimiseSvg("<div>no</div>")).toThrow(/root element must be <svg>/u);
		expect(() => optimiseSvg("<svg><path></svg>")).toThrow(/Invalid SVG/u);
	});

	it("renders the optimised markup", () => {
		render(<SvgTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).not.toContain("Vector Studio");
		expect(output()).toContain('viewBox="0 0 24 24"');
		fireEvent.change(screen.getByLabelText("SVG markup"), { target: { value: "<svg xmlns='http://www.w3.org/2000/svg'><rect width='2.3456' height='1'/></svg>" } });
		expect(output()).toContain('width="2.35"');
		fireEvent.change(screen.getByLabelText("SVG markup"), { target: { value: "not svg" } });
		expect(screen.getByText(/Invalid SVG/u)).toBeTruthy();
	});
});
