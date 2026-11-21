import { readZipEntries } from "@/features/converter-tools/zip-reader";
import { writeZip } from "@/features/converter-tools/zip-write";

const SPACING_TAG = /<(?:([A-Za-z_][\w.-]*:)?)spacing\b([^<>]*?)(\/?>)/gu;
const LINE_ATTRIBUTE = /(?:^|\s)(?:[A-Za-z_][\w.-]*:)?line\s*=/u;
const LINE_RULE_ATTRIBUTE = /(?:^|\s)(?:[A-Za-z_][\w.-]*:)?lineRule\s*=/u;
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

/**
 * OOXML defaults an omitted lineRule to `auto`. docx-preview treats it as exact,
 * which can give a large-font paragraph a tiny fixed line box and make lines overlap.
 */
export const normalizeDocxLineSpacingXml = (xml: string) =>
	xml.replace(SPACING_TAG, (tag, prefix: string | undefined, attributes: string, close: string) => {
		if (!LINE_ATTRIBUTE.test(attributes) || LINE_RULE_ATTRIBUTE.test(attributes)) return tag;
		const spacingPrefix = prefix ?? "";
		const separator = attributes.endsWith(" ") ? "" : " ";
		return `<${spacingPrefix}spacing${attributes}${separator}${spacingPrefix}lineRule="auto"${close}`;
	});

/** Repair Word's default line-spacing rule before the browser renderer reads DOCX parts. */
export const normalizeDocxLineSpacing = async (bytes: Uint8Array) => {
	const entries = await readZipEntries(bytes);
	let changed = false;
	for (const entry of entries) {
		if (!entry.name.startsWith("word/") || !entry.name.endsWith(".xml")) continue;
		const xml = decoder.decode(entry.bytes);
		const normalized = normalizeDocxLineSpacingXml(xml);
		if (normalized === xml) continue;
		entry.bytes = encoder.encode(normalized);
		changed = true;
	}
	return changed ? writeZip(entries.map(({ name, bytes: data }) => ({ name, data }))) : bytes.slice();
};

/** Correct too-short title line boxes and restore breathing room after centered all-caps headings. */
export const fixDocxParagraphLayout = (root: HTMLElement) => {
	for (const paragraph of root.querySelectorAll<HTMLElement>("p")) {
		const paragraphStyle = window.getComputedStyle(paragraph);
		const text = paragraph.textContent?.trim() ?? "";
		const textElements = [paragraph, ...paragraph.querySelectorAll<HTMLElement>("span")];
		const largestFontSize = Math.max(0, ...textElements.map((element) => Number.parseFloat(window.getComputedStyle(element).fontSize) || 0));
		const lineHeight = Number.parseFloat(paragraphStyle.lineHeight);

		// Some Word styles specify an exact line box shorter than their large display font.
		// Keep that from making a document title collide with the paragraph underneath.
		if (largestFontSize > 0 && Number.isFinite(lineHeight) && lineHeight + 0.5 < largestFontSize) {
			paragraph.style.lineHeight = `${Math.ceil(largestFontSize * 1.2)}px`;
		}

		const fontWeight = Number.parseInt(paragraphStyle.fontWeight, 10);
		const isBold = paragraphStyle.fontWeight === "bold" || (Number.isFinite(fontWeight) && fontWeight >= 600);
		const isCenteredHeading = text.length >= 12
			&& text === text.toLocaleUpperCase()
			&& paragraphStyle.textAlign === "center"
			&& isBold;
		if (isCenteredHeading && (Number.parseFloat(paragraphStyle.marginBottom) || 0) < 16) {
			paragraph.style.marginBottom = "16px";
		}
	}
};
