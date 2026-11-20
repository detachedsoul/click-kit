import { describe, expect, it } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { epubToMarkdown, readEpub } from "@/features/converter-tools/epub";

const encoder = new TextEncoder();

const makeEpub = async () => {
	const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
	<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
	const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
	<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
		<dc:title>The Long Walk</dc:title>
		<dc:creator>Ada Okafor</dc:creator>
	</metadata>
	<manifest>
		<item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/>
		<item id="c2" href="text/two.xhtml" media-type="application/xhtml+xml"/>
		<item id="nav" href="toc.xhtml" media-type="application/xhtml+xml"/>
	</manifest>
	<spine>
		<itemref idref="c2"/>
		<itemref idref="c1"/>
	</spine>
</package>`;
	const chapter = (title: string, body: string) => `<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head>
<body><h2>${title}</h2><p>${body}</p></body></html>`;
	return createZip([
		{ name: "META-INF/container.xml", data: encoder.encode(container) },
		{ name: "OEBPS/content.opf", data: encoder.encode(opf) },
		{ name: "OEBPS/text/one.xhtml", data: encoder.encode(chapter("First", "The shortest chapter.")) },
		{ name: "OEBPS/text/two.xhtml", data: encoder.encode(chapter("Second", "A longer <em>chapter</em>.")) },
		{ name: "OEBPS/toc.xhtml", data: encoder.encode(chapter("Contents", "Not part of the spine.")) },
	]);
};

describe("epub reading", () => {
	it("follows the spine order and keeps the title and author", async () => {
		const book = await readEpub(await makeEpub());
		expect(book.title).toBe("The Long Walk");
		expect(book.author).toBe("Ada Okafor");
		expect(book.chapters.map((chapter) => chapter.name)).toEqual(["two.xhtml", "one.xhtml"]);
		expect(book.chapters[0].markdown).toContain("## Second");
		expect(book.chapters[0].markdown).toContain("*chapter*");
	});

	it("writes one markdown document with a front matter", async () => {
		const markdown = await epubToMarkdown(await makeEpub());
		expect(markdown.startsWith("# The Long Walk\n\n*by Ada Okafor*")).toBe(true);
		expect(markdown).toContain("## Second");
		expect(markdown.indexOf("## Second")).toBeLessThan(markdown.indexOf("## First"));
		expect(markdown).toContain("\n\n---\n\n");
	});

	it("can skip the front matter", async () => {
		const markdown = await epubToMarkdown(await makeEpub(), { frontMatter: false });
		expect(markdown.startsWith("## Second")).toBe(true);
	});

	it("explains a zip that is not a book", async () => {
		const zip = await createZip([{ name: "notes.txt", data: encoder.encode("hello") }]);
		await expect(readEpub(zip)).rejects.toThrow(/not an EPUB/u);
	});
});
