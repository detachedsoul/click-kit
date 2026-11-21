import { describe, expect, it } from "vitest";
import { fixDocxParagraphLayout, normalizeDocxLineSpacingXml } from "@/features/converter-tools/docx-render-fixes";

describe("DOCX browser-rendering fixes", () => {
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
