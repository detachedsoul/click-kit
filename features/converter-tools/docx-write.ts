/**
 * Writing a Word document (.docx).
 *
 * The smallest .docx Word will open is three XML parts in a zip: the content types, one
 * relationship pointing at the document, and `word/document.xml` itself. That is what this
 * builds — headings, paragraphs, and page breaks, with direct formatting instead of a style
 * table so Word, LibreOffice, and Google Docs all show the same thing.
 */

import { writeZip } from "@/features/converter-tools/zip-write";

export type DocxBlock = { kind: "heading"; level: number; text: string } | { kind: "paragraph"; text: string } | { kind: "pageBreak" };

const HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Only the three characters that would break the XML; the rest belongs to the text. */
const escapeXml = (text: string) => text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

const CONTENT_TYPES = `${HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELATIONSHIPS = `${HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** A4 portrait, one-inch margins, so a conversion looks like a document rather than a strip. */
const SECTION = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';

/** Half-points: 22 is 11 pt, which is what Word writes for its own default body text. */
const bodyRun = (text: string) => `<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;

const headingParagraph = (level: number, text: string) => {
	const size = level <= 1 ? 36 : level === 2 ? 28 : 24;
	const after = level <= 1 ? 200 : 140;
	return `<w:p><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="${after}"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
};

const paragraph = (text: string) =>
	text.trim() ? `<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr>${bodyRun(text)}</w:p>` : '<w:p><w:pPr><w:spacing w:after="140"/></w:pPr></w:p>';

const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

const documentXml = (blocks: DocxBlock[]) => {
	const body = blocks
		.map((block) => {
			if (block.kind === "pageBreak") return pageBreak();
			if (block.kind === "heading") return headingParagraph(block.level, block.text);
			return paragraph(block.text);
		})
		.join("");
	return `${HEADER}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}${SECTION}</w:body></w:document>`;
};

/** The .docx bytes for a list of blocks. */
export const writeDocx = (blocks: DocxBlock[]): Uint8Array =>
	writeZip([
		{ data: CONTENT_TYPES, name: "[Content_Types].xml" },
		{ data: RELATIONSHIPS, name: "_rels/.rels" },
		{ data: documentXml(blocks), name: "word/document.xml" },
	]);

/** The XML of the document part, for tests and for anyone wanting to look inside. */
export const docxDocumentXml = (blocks: DocxBlock[]) => documentXml(blocks);
