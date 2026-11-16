import { describe, expect, it } from "vitest";
import { analyzeReadability, createMarkdownTable, createSlug, decodeHtmlEntities, decodeUrlComponent, encodeHtmlEntities, encodeUrlComponent, extractTextItems, findAndReplaceText, formatMarkup, formatTextDocument, generateLoremIpsum, inspectUnicodeText, renderSafeMarkdown, reverseGraphemes, sortTextLines, splitTextMatches } from "@/features/text-tools/extra-text-utils";

describe("extra text utilities", () => {
	it("finds and replaces literal and whole-word text safely", () => {
		expect(findAndReplaceText("cat scatter cat", "cat", "dog", { useRegex: false, caseSensitive: true, wholeWord: true })).toEqual({ text: "dog scatter dog", matches: 2 });
	});

	it("splits text into highlighted whole-word matches and ordinary text", () => {
		expect(splitTextMatches("Cat catalog CAT", "cat", { useRegex: false, caseSensitive: false, wholeWord: true })).toEqual([
			{ text: "Cat", isMatch: true },
			{ text: " catalog ", isMatch: false },
			{ text: "CAT", isMatch: true },
		]);
	});

	it("supports regular expression groups and reports invalid expressions", () => {
		expect(findAndReplaceText("item 14", "item (\\d+)", "# $1", { useRegex: true, caseSensitive: false, wholeWord: false }).text).toBe("# 14");
		expect(() => findAndReplaceText("anything", "[", "x", { useRegex: true, caseSensitive: false, wholeWord: false })).toThrow();
	});

	it("sorts lines and removes duplicates without collapsing distinct case when requested", () => {
		expect(sortTextLines("pear\nApple\npear\n\nBanana", { descending: false, caseSensitive: false, removeDuplicates: true, removeBlankLines: true })).toBe("Apple\nBanana\npear");
	});

	it("creates Unicode-aware slugs and normalizes accents", () => {
		expect(createSlug("Crème brûlée — 東京! ")).toBe("creme-brulee-東京");
	});

	it("returns an empty readability score for empty text and estimates English text", () => {
		expect(analyzeReadability("").readingEase).toBeNull();
		const result = analyzeReadability("The cat sat on the mat. The dog ran.");
		expect(result.words).toBe(9);
		expect(result.sentences).toBe(2);
		expect(result.readingEase).not.toBeNull();
	});

	it("extracts unique emails, links, phone-like numbers, and hashtags", () => {
		const source = "mail me a@sample.test, visit https://example.com/path. Call +1 (555) 123-4567 or #ClickKit #ClickKit";
		expect(extractTextItems(source, "emails")).toEqual(["a@sample.test"]);
		expect(extractTextItems(source, "urls")).toEqual(["https://example.com/path"]);
		expect(extractTextItems(source, "phones")).toEqual(["+1 (555) 123-4567"]);
		expect(extractTextItems(source, "hashtags")).toEqual(["#ClickKit"]);
	});

	it("formats JSON, indents markup, and rejects malformed XML", () => {
		expect(formatTextDocument('{"name":"Kit"}', "json", 2)).toContain("\n  \"name\"");
		expect(formatMarkup("<main><h1>Hi</h1></main>", "html")).toBe("<main>\n  <h1>Hi</h1>\n</main>");
		expect(formatMarkup("<p> keep <strong>this</strong> spacing </p>", "html")).toBe("<p> keep <strong>this</strong> spacing </p>");
		expect(formatMarkup("<p><strong>foo</strong> <em>bar</em></p>", "html")).toBe("<p><strong>foo</strong> <em>bar</em></p>");
		expect(formatMarkup("<p><b>foo</b> <i>bar</i></p>", "xml")).toBe("<p><b>foo</b> <i>bar</i></p>");
		expect(() => formatTextDocument("<main>", "xml", 2)).toThrow(/well-formed/u);
	});

	it("generates a markdown table and escapes pipe characters", () => {
		expect(createMarkdownTable("Name\tRole\nAri\tDesign | UX", "tab")).toBe("| Name | Role |\n| --- | --- |\n| Ari | Design \\| UX |");
		expect(createMarkdownTable('Name,Note\nAri,"Design, UX"', "comma")).toBe("| Name | Note |\n| --- | --- |\n| Ari | Design, UX |");
	});

	it("encodes and decodes HTML entities and URL components", () => {
		expect(encodeHtmlEntities("<a & 'b'>")).toBe("&lt;a &amp; &#39;b&#39;&gt;");
		expect(decodeHtmlEntities("&lt;b&gt;&amp;&lt;/b&gt;")).toBe("<b>&</b>");
		expect(decodeUrlComponent(encodeUrlComponent("A & B / café"))).toBe("A & B / café");
	});

	it("inspects code points and reverses grapheme clusters intact", () => {
		expect(inspectUnicodeText("A😀").map(({ codePoint }) => codePoint)).toEqual(["U+0041", "U+1F600"]);
		expect(reverseGraphemes("A👩‍👩‍👧‍👦é")).toBe("é👩‍👩‍👧‍👦A");
	});

	it("generates repeatable placeholder text with requested paragraph and word counts", () => {
		const result = generateLoremIpsum(2, 5);
		expect(result.split("\n\n")).toHaveLength(2);
		expect(result.split(/\s+/u)).toHaveLength(10);
	});

	it("renders a safe Markdown subset and escapes raw HTML", () => {
		const result = renderSafeMarkdown("# Title\n\n**bold** and [safe](https://example.com)\n\n<script>alert(1)</script>");
		expect(result).toContain("<h1>Title</h1>");
		expect(result).toContain("<strong>bold</strong>");
		expect(result).toContain('href="https://example.com"');
		expect(result).toContain("&lt;script&gt;");
	});
});
