import { describe, expect, it } from "vitest";
import { normalizeDocxLineSpacingXml } from "@/features/converter-tools/docx-render-fixes";

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
});
