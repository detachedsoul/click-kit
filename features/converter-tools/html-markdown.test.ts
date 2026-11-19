import { describe, expect, it } from "vitest";
import { htmlTitle, htmlToMarkdown, textOfHtml } from "@/features/converter-tools/html-markdown";

describe("html to markdown", () => {
	it("turns headings, paragraphs, and emphasis into markdown", () => {
		expect(htmlToMarkdown("<h1>Title</h1><p>Some <strong>bold</strong> and <em>light</em> words.</p>")).toBe("# Title\n\nSome **bold** and *light* words.");
	});

	it("keeps links and images, and can drop them", () => {
		const html = '<p>See <a href="https://example.com">the site</a> <img src="a.png" alt="a picture"></p>';
		expect(htmlToMarkdown(html)).toContain("[the site](https://example.com)");
		expect(htmlToMarkdown(html)).toContain("![a picture](a.png)");
		expect(htmlToMarkdown(html, { keepLinks: false, keepImages: false })).toBe("See the site");
	});

	it("keeps list structure and numbering", () => {
		expect(htmlToMarkdown("<ul><li>one</li><li>two</li></ul>")).toBe("- one\n- two");
		expect(htmlToMarkdown("<ol><li>first</li><li>second</li></ol>")).toBe("1. first\n2. second");
	});

	it("writes fenced code with its language", () => {
		expect(htmlToMarkdown('<pre><code class="language-js">const a = 1;</code></pre>')).toBe("```js\nconst a = 1;\n```");
	});

	it("quotes text and rules", () => {
		expect(htmlToMarkdown("<blockquote><p>wise words</p></blockquote>")).toBe("> wise words");
		expect(htmlToMarkdown("<p>a</p><hr><p>b</p>")).toBe("a\n\n---\n\nb");
	});

	it("turns a table into a markdown table", () => {
		const html = "<table><tr><th>Name</th><th>Age</th></tr><tr><td>Ada</td><td>36</td></tr></table>";
		expect(htmlToMarkdown(html)).toBe("| Name | Age |\n| --- | --- |\n| Ada | 36 |");
	});

	it("drops scripts, styles, and the document head", () => {
		const html = "<html><head><title>Mine</title><style>p{color:red}</style></head><body><p>keep</p><script>alert(1)</script></body></html>";
		expect(htmlToMarkdown(html)).toBe("keep");
		expect(htmlTitle(html)).toBe("Mine");
	});

	it("escapes characters that would otherwise become markdown", () => {
		expect(htmlToMarkdown("<p>a *star* and _lines_</p>")).toBe("a \\*star\\* and \\_lines\\_");
	});

	it("reads the plain text too", () => {
		expect(textOfHtml("<p>one</p><p>two</p>")).toBe("one\n\ntwo");
		expect(textOfHtml("<h2>Head</h2><ul><li>a</li><li>b</li></ul>")).toBe("Head\n\na\n\nb");
	});
});
