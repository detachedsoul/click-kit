import { describe, expect, it } from "vitest";
import { buildIco, faviconHtmlSnippet, icoByteLength, iconSummary, webManifestSnippet } from "@/features/image-tools/favicon-utils";

const payload = (size: number, bytes = 8) => ({ size, bytes: new Uint8Array(bytes).fill(0x89) });

describe("favicon builder", () => {
	it("writes an ICO header and one directory entry per icon", () => {
		const ico = buildIco([{ size: 16, bytes: new Uint8Array([1, 2, 3, 4]) }, { size: 32, bytes: new Uint8Array([5, 6, 7, 8]) }]);
		const view = new DataView(ico.buffer);
		expect(view.getUint16(0, true)).toBe(0);
		expect(view.getUint16(2, true)).toBe(1);
		expect(view.getUint16(4, true)).toBe(2);
		expect(ico[6]).toBe(16);
		expect(ico[7]).toBe(16);
		expect(view.getUint16(10, true)).toBe(1);
		expect(view.getUint16(12, true)).toBe(32);
		expect(view.getUint32(14, true)).toBe(4);
		expect(view.getUint32(18, true)).toBe(6 + 2 * 16);
		expect([...ico.slice(38, 42)]).toEqual([1, 2, 3, 4]);
		expect(view.getUint32(30, true)).toBe(4);
		expect(view.getUint32(34, true)).toBe(6 + 2 * 16 + 4);
		expect([...ico.slice(42, 46)]).toEqual([5, 6, 7, 8]);
	});

	it("stores 256px icons as zero and keeps offsets correct", () => {
		const ico = buildIco([payload(32), payload(256, 12)]);
		const view = new DataView(ico.buffer);
		expect(ico[6]).toBe(32);
		expect(ico[6 + 16]).toBe(0);
		expect(ico[6 + 17]).toBe(0);
		expect(icoByteLength([payload(32), payload(256, 12)])).toBe(6 + 32 + 20);
		expect(ico.length).toBe(6 + 32 + 20);
		expect(view.getUint32(6 + 16 + 8, true)).toBe(12);
	});

	it("refuses to build an empty icon file", () => {
		expect(() => buildIco([])).toThrow(/at least one/u);
	});

	it("ships copy-paste snippets that match the generated files", () => {
		const html = faviconHtmlSnippet();
		expect(html).toContain('href="/favicon.ico"');
		expect(html).toContain('sizes="180x180"');
		expect(html).toContain("apple-touch-icon");
		const manifest = JSON.parse(webManifestSnippet()) as { icons: { sizes: string }[] };
		expect(manifest.icons.map((icon) => icon.sizes)).toEqual(["192x192", "512x512"]);
		expect(iconSummary([{ size: 16, bytes: new Uint8Array(2048) }])).toBe("16 × 16 px · 2.0 kB");
	});
});
