import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseXml, runXPath } from "@/features/developer-tools/xpath-utils";
import { XPathTool } from "@/features/developer-tools/xpath-tool";

afterEach(cleanup);

const xml = `<catalog>
  <book id="b1"><title>First</title><price>10</price></book>
  <book id="b2"><title>Second</title><price>35</price></book>
</catalog>`;

describe("XPath tester", () => {
	it("selects node sets with paths and values", () => {
		const report = runXPath(parseXml(xml), "//book/title");
		expect(report.kind).toBe("nodes");
		expect(report.count).toBe(2);
		expect(report.matches[0].path).toBe("/catalog[1]/book[1]/title[1]");
		expect(report.matches[1].value).toContain("Second");
	});

	it("evaluates predicates, counts, strings, and booleans", () => {
		const doc = parseXml(xml);
		expect(runXPath(doc, "//book[@id='b2']/title").matches[0].value).toContain("Second");
		expect(runXPath(doc, "count(//book)").matches[0].value).toBe("2");
		expect(runXPath(doc, "string(//book[1]/title)").matches[0].value).toBe("First");
		expect(runXPath(doc, "//book[price > 30]").count).toBe(1);
		expect(runXPath(doc, "boolean(//missing)").matches[0].value).toBe("false");
	});

	it("matches attributes and text nodes", () => {
		const doc = parseXml(xml);
		const attributes = runXPath(doc, "//@id");
		expect(attributes.count).toBe(2);
		expect(attributes.matches[0].path).toBe("/catalog[1]/book[1]/@id");
		const text = runXPath(doc, "//title/text()");
		expect(text.matches[0].name).toBe("#text");
		expect(text.matches[0].path).toBe("/catalog[1]/book[1]/title[1]/text()");
	});

	it("reports invalid XML and invalid expressions", () => {
		expect(() => parseXml("")).toThrow(/Paste XML/u);
		expect(() => parseXml("<a><b></a>")).toThrow(/Invalid XML/u);
		expect(() => runXPath(parseXml(xml), "")).toThrow(/Enter an XPath/u);
		expect(() => runXPath(parseXml(xml), "//*[")).toThrow(/Invalid XPath/u);
	});

	it("renders matches and follows expression edits", () => {
		render(<XPathTool />);
		expect(screen.getByLabelText("Result")).toBeTruthy();
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("Structure and Interpretation");
		fireEvent.change(screen.getByLabelText("XPath expression"), { target: { value: "count(//book)" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("number()  →  2");
		fireEvent.change(screen.getByLabelText("XPath expression"), { target: { value: "//*[" } });
		expect(screen.getByText(/Invalid XPath/u)).toBeTruthy();
	});
});
