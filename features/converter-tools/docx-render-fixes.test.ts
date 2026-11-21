import { describe, expect, it } from "vitest";
import { fixDocxParagraphLayout, fixDocxTableLayout, hasRenderableDocxContent, normalizeDocxLineSpacingXml } from "@/features/converter-tools/docx-render-fixes";

describe("DOCX browser-rendering fixes", () => {
	it("adds cell breathing room and spacing around tables without flattening their contents", () => {
		const root = document.createElement("div");
		root.innerHTML = "<p>Before table</p><table><tbody><tr><td>Cell text</td><th>Heading</th></tr></tbody></table><p>After table</p>";
		const table = root.querySelector("table")!;
		fixDocxTableLayout(root);
		expect(table.style.marginBlock).toBe("0.2em");
		for (const cell of table.querySelectorAll<HTMLElement>("td, th")) {
			expect(cell.style.paddingBlock).toBe("0.18em");
			expect(cell.style.paddingInline).toBe("0.2em");
		}
		expect(table.textContent).toBe("Cell textHeading");
	});

	it("recognizes empty pagination pages but preserves text and image-only pages", () => {
		const empty = document.createElement("section");
		expect(hasRenderableDocxContent(empty)).toBe(false);
		const text = document.createElement("section");
		text.textContent = "Paragraph";
		expect(hasRenderableDocxContent(text)).toBe(true);
		const image = document.createElement("section");
		image.innerHTML = "<img alt='Logo'>";
		expect(hasRenderableDocxContent(image)).toBe(true);
	});

	it("uses Word's automatic default when a line rule is omitted", () => {
		const xml = '<w:document xmlns:w="urn:word"><w:pPr><w:spacing w:after="0" w:line="240"/></w:pPr></w:document>';
		expect(normalizeDocxLineSpacingXml(xml)).toContain('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/>');
	});

	it("preserves explicitly selected exact and minimum line spacing", () => {
		const xml = '<w:spacing w:line="240" w:lineRule="exact"/><w:spacing w:line="300" w:lineRule="atLeast"/>';
		expect(normalizeDocxLineSpacingXml(xml)).toBe(xml);
	});

	it("does not add line spacing where no line value was specified", () => {
		const xml = '<w:spacing w:before="120" w:after="240"/>';
		expect(normalizeDocxLineSpacingXml(xml)).toBe(xml);
	});

	it("uses the spacing element's namespace prefix", () => {
		const xml = '<x:spacing x:line="276"></x:spacing>';
		expect(normalizeDocxLineSpacingXml(xml)).toBe('<x:spacing x:line="276" x:lineRule="auto"></x:spacing>');
	});

	it("gives a large display title enough line height to avoid overlap", () => {
		const root = document.createElement("div");
		root.innerHTML = '<p style="line-height: 12px; font-size: 12px"><span style="font-size: 32px">Davis Ojima.</span></p>';
		document.body.append(root);
		const paragraph = root.querySelector("p")!;
		fixDocxParagraphLayout(root);
		expect(paragraph.style.lineHeight).toBe("39px");
		root.remove();
	});

	it("adds breathing room after a centered, bold, all-caps heading", () => {
		const root = document.createElement("div");
		root.innerHTML = '<p style="text-align: center; font-weight: 700; margin-bottom: 0">LETTER OF REFERENCE FOR MR. WISDOM OJIMAH</p>';
		document.body.append(root);
		const paragraph = root.querySelector("p")!;
		fixDocxParagraphLayout(root);
		expect(paragraph.style.marginBottom).toBe("16px");
		root.remove();
	});
});
