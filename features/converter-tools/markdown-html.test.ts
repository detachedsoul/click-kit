import { describe, expect, it } from "vitest";
import { escapeHtml, headingCount, inlineHtml, markdownToHtml, markdownWordCount, wrapInPage } from "@/features/converter-tools/markdown-html";

describe("escaping", () => {
	it("turns markup into text", () => {
		expect(escapeHtml(`<script>alert("hi")</script> & co`)).toBe("&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; co");
	});

	it("never lets a pasted script tag through", () => {
		const html = markdownToHtml("# Title\n\n<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>");
	});
});

describe("blocks", () => {
	it("makes headings from one to six", () => {
		const html = markdownToHtml("# One\n\n### Three\n\n###### Six");
		expect(html).toBe("<h1>One</h1>\n<h3>Three</h3>\n<h6>Six</h6>");
		expect(headingCount("# One\n\n### Three\n\nplain")).toBe(2);
	});

	it("joins plain lines into one paragraph", () => {
		expect(markdownToHtml("one\ntwo\n\nthree")).toBe("<p>one\ntwo</p>\n<p>three</p>");
	});

	it("keeps fenced code exactly as typed", () => {
		const html = markdownToHtml("```ts\nconst a = 1 < 2;\n```");
		expect(html).toBe('<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>');
	});

	it("closes an unterminated fence at the end of the input", () => {
		expect(markdownToHtml("```\nstill code")).toBe("<pre><code>still code</code></pre>");
	});

	it("makes unordered and ordered lists", () => {
		expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
		expect(markdownToHtml("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
	});

	it("keeps a wrapped list item together", () => {
		expect(markdownToHtml("- a long item\n  that wraps\n- second")).toBe("<ul><li>a long item that wraps</li><li>second</li></ul>");
	});

	it("quotes a block", () => {
		expect(markdownToHtml("> quoted\n> twice")).toBe("<blockquote><p>quoted\ntwice</p></blockquote>");
	});

	it("draws a rule", () => {
		expect(markdownToHtml("---")).toBe("<hr />");
		expect(markdownToHtml("***")).toBe("<hr />");
	});

	it("builds a table with a head and rows", () => {
		const html = markdownToHtml("| Fruit | Price |\n| --- | --- |\n| Pear | 2 |\n| Fig | |");
		expect(html).toBe(
			"<table><thead><tr><th>Fruit</th><th>Price</th></tr></thead><tbody><tr><td>Pear</td><td>2</td></tr><tr><td>Fig</td><td></td></tr></tbody></table>",
		);
	});

	it("returns nothing for an empty document", () => {
		expect(markdownToHtml("   \n\n ")).toBe("");
	});
});

describe("inline spans", () => {
	it("makes bold, italic, strikethrough, and code", () => {
		expect(inlineHtml("**bold**")).toBe("<strong>bold</strong>");
		expect(inlineHtml("__bold__")).toBe("<strong>bold</strong>");
		expect(inlineHtml("a *soft* word")).toBe("a <em>soft</em> word");
		expect(inlineHtml("a _soft_ word")).toBe("a <em>soft</em> word");
		expect(inlineHtml("~~gone~~")).toBe("<del>gone</del>");
		expect(inlineHtml("`code`")).toBe("<code>code</code>");
	});

	it("does not format inside a code span", () => {
		expect(inlineHtml("`a *b* c`")).toBe("<code>a *b* c</code>");
	});

	it("makes links and images", () => {
		expect(inlineHtml('[docs](https://example.com/a?b="c")')).toBe('<a href="https://example.com/a?b=&quot;c&quot;">docs</a>');
		expect(inlineHtml("![a cat](/cat.png)")).toBe('<img src="/cat.png" alt="a cat" />');
		expect(inlineHtml("<https://example.com>")).toBe('<a href="https://example.com">https://example.com</a>');
	});

	it("drops link targets that would run code", () => {
		expect(inlineHtml("[click](javascript:alert(1))")).toBe("[click](javascript:alert(1))");
		expect(inlineHtml("[click](data:text/html;base64,PHNjcmlwdD4=)")).toBe("[click](data:text/html;base64,PHNjcmlwdD4=)");
	});

	it("can leave links out entirely", () => {
		expect(inlineHtml("[docs](https://example.com)", { keepLinks: false })).toBe("[docs](https://example.com)");
		expect(inlineHtml("![a cat](/cat.png)", { keepLinks: false })).toBe('<img src="/cat.png" alt="a cat" />');
	});

	it("keeps the alt text when images are switched off", () => {
		expect(inlineHtml("![a cat](/cat.png)", { keepImages: false })).toBe("a cat");
	});
});

describe("whole page", () => {
	it("wraps a fragment in a readable document", () => {
		const page = wrapInPage("<h1>Hello</h1>", "Hello & co");
		expect(page.startsWith("<!doctype html>")).toBe(true);
		expect(page).toContain("<title>Hello &amp; co</title>");
		expect(page).toContain('<html lang="en">');
		expect(page).toContain("<body>\n<h1>Hello</h1>\n</body>");
	});

	it("counts words", () => {
		expect(markdownWordCount("")).toBe(0);
		expect(markdownWordCount("  one  two\nthree ")).toBe(3);
	});
});
