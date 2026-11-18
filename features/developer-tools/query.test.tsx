import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { QueryJsonTool } from "@/features/developer-tools/query-tool";
import { jsonToQuery, queryToJson } from "@/features/developer-tools/query-utils";

afterEach(cleanup);

describe("query string and JSON converter", () => {
	it("turns repeated keys and bracket groups into arrays and objects", () => {
		expect(JSON.parse(queryToJson("?tag=a&tag=b&filter[status]=active&page=2"))).toEqual({
			tag: ["a", "b"],
			filter: { status: "active" },
			page: "2",
		});
	});

	it("rebuilds arrays from numeric index keys and empty bracket keys", () => {
		expect(JSON.parse(queryToJson("ids[0]=7&ids[1]=9"))).toEqual({ ids: ["7", "9"] });
		expect(JSON.parse(queryToJson("tags[]=x&tags[]=y"))).toEqual({ tags: ["x", "y"] });
	});

	it("decodes percent escapes, plus signs, and keys without values", () => {
		expect(JSON.parse(queryToJson("q=hello+world&path=a%2Fb&flag"))).toEqual({ q: "hello world", path: "a/b", flag: "" });
		expect(JSON.parse(queryToJson("q=hello+world", { plusAsSpace: false }))).toEqual({ q: "hello+world" });
		expect(JSON.parse(queryToJson("?a=1#fragment"))).toEqual({ a: "1" });
	});

	it("encodes JSON back into a query string with bracket keys", () => {
		expect(jsonToQuery('{"tag":["a","b"],"filter":{"status":"active"},"q":"a b"}')).toBe("tag[0]=a&tag[1]=b&filter[status]=active&q=a%20b");
		expect(jsonToQuery('{"a":"1"}', { leading: true })).toBe("?a=1");
		expect(jsonToQuery('{"empty":null}')).toBe("empty=");
	});

	it("round-trips values through both directions", () => {
		const source = "?name=Ada+Lovelace&role=admin&role=editor";
		expect(jsonToQuery(queryToJson(source))).toBe("name=Ada%20Lovelace&role[0]=admin&role[1]=editor");
	});

	it("rejects empty input, invalid JSON, non-object roots, and conflicting keys", () => {
		expect(() => queryToJson("  ")).toThrow(/Paste a query string/u);
		expect(() => jsonToQuery("")).toThrow(/Paste JSON/u);
		expect(() => jsonToQuery("{oops")).toThrow(/Invalid JSON/u);
		expect(() => jsonToQuery('["a"]')).toThrow(/JSON object at the root/u);
		expect(() => jsonToQuery("{}")).toThrow(/at least one key/u);
		expect(() => queryToJson("a=1&a[b]=2")).toThrow(/both a value and a group/u);
	});

	it("renders JSON and toggles direction with options", async () => {
		const user = userEvent.setup();
		render(<QueryJsonTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"typescript"');
		await user.click(screen.getByRole("button", { name: "JSON to query string" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("tag[0]=typescript");
		fireEvent.click(screen.getByLabelText(/Start the result with/u));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value.startsWith("?")).toBe(true);
	});
});
