import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { XmlJsonTool } from "@/features/developer-tools/xml-tool";
import { jsonToXml, xmlToJson } from "@/features/developer-tools/xml-utils";

afterEach(cleanup);

describe("XML and JSON converter", () => {
	it("keeps attributes, text, repeated elements, and decoded entities", () => {
		const json = JSON.parse(
			xmlToJson('<book id="1"><title>Tom &amp; Jerry</title><tag>a</tag><tag>b</tag><empty x="1">hi</empty></book>'),
		);
		expect(json).toEqual({
			book: {
				title: "Tom & Jerry",
				tag: ["a", "b"],
				empty: { "#text": "hi", "@_x": "1" },
				"@_id": "1",
			},
		});
	});

	it("can drop attributes", () => {
		expect(JSON.parse(xmlToJson('<a id="1"><b>x</b></a>', { includeAttributes: false }))).toEqual({ a: { b: "x" } });
	});

	it("round-trips a document through JSON", () => {
		const source = '<catalog><book id="1"><title>Hi</title></book></catalog>';
		const xml = jsonToXml(xmlToJson(source));
		expect(xml).toContain('<book id="1">');
		expect(xml).toContain("<title>Hi</title>");
		expect(JSON.parse(xmlToJson(xml))).toEqual(JSON.parse(xmlToJson(source)));
	});

	it("escapes reserved characters and wraps multi-key or array roots", () => {
		expect(jsonToXml('{"root":{"note":"a & b < c"}}')).toContain("a &amp; b &lt; c");
		expect(jsonToXml('{"a":1,"b":2}', { rootName: "payload" })).toMatch(/^<payload>/u);
		expect(jsonToXml('[{"id":1},{"id":2}]', { rootName: "items" })).toContain("<items>");
		expect(jsonToXml('{"a":1}', { rootName: "not valid" })).toContain("<a>");
	});

	it("reports malformed XML, bad JSON, and invalid roots", () => {
		expect(() => xmlToJson(" ")).toThrow(/Paste XML/u);
		expect(() => xmlToJson("<a><b></a>")).toThrow(/Invalid XML at line 1/u);
		expect(() => jsonToXml("")).toThrow(/Paste JSON/u);
		expect(() => jsonToXml("{oops")).toThrow(/Invalid JSON/u);
		expect(() => jsonToXml("42")).toThrow(/object or an array/u);
		expect(() => jsonToXml('{"a":1,"b":2}', { rootName: "1bad" })).toThrow(/Root element names/u);
	});

	it("renders XML as JSON by default and switches direction", async () => {
		const user = userEvent.setup();
		render(<XmlJsonTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"Small Worlds"');
		await user.click(screen.getByRole("button", { name: "JSON to XML" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("<title>Small Worlds</title>");
		fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: '{"a":1,"b":2}' } });
		fireEvent.change(screen.getByLabelText("Wrapper root"), { target: { value: "store" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("<store>");
	});

	it("surfaces validation errors to assistive tech", () => {
		render(<XmlJsonTool />);
		fireEvent.change(screen.getByLabelText("XML input"), { target: { value: "<a>" } });
		expect(screen.getByRole("alert").textContent).toContain("Invalid XML");
	});
});
