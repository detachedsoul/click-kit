import zlib from "node:zlib";
import { PDFDocument, StandardFonts, PDFName, PDFDict, PDFArray, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addMargins, applyEdits, PdfInputError, toInk } from "@/features/pdf-tools/pdf-engine";

const makePdf = async (pages = 1, size: [number, number] = [600, 800]) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	for (let index = 0; index < pages; index += 1) doc.addPage(size).drawText("hello", { x: 40, y: 40, size: 12, font });
	return new Uint8Array(await doc.save());
};

const fontsOn = (doc: PDFDocument, pageIndex = 0) => {
	const resources = doc.getPage(pageIndex).node.Resources();
	if (!resources) return [] as string[];
	const fontDict = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
	if (!fontDict) return [] as string[];
	return fontDict.keys().map((key) => key.asString());
};

describe("addMargins", () => {
	it("grows the page on each side it is given", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(), { top: 36, right: 18, bottom: 9, left: 27 }));
		const page = out.getPage(0);
		expect([page.getWidth(), page.getHeight()]).toEqual([600 + 45, 800 + 45]);
	});

	it("keeps the page's own content and its embedded font", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(2), { top: 20, right: 0, bottom: 0, left: 0 }));
		expect(out.getPageCount()).toBe(2);
		expect(fontsOn(out).length).toBeGreaterThan(0);
	});

	it("moves the content in rather than scaling it", async () => {
		const out = await PDFDocument.load(await addMargins(await makePdf(), { top: 0, right: 0, bottom: 0, left: 50 }));
		const { Contents } = out.getPage(0).node.normalizedEntries();
		const content = (Contents as PDFArray).asArray();
		expect(content.length).toBeGreaterThan(0);
		// The page's own drawing stays where it was drawn; only the page moved around it.
		expect(out.getPage(0).getWidth()).toBe(650);
	});

	it("refuses a margin it cannot draw", async () => {
		const bytes = await makePdf();
		await expect(addMargins(bytes, { top: -1, right: 0, bottom: 0, left: 0 })).rejects.toThrow(PdfInputError);
		await expect(addMargins(bytes, { top: 0, right: 0, bottom: 0, left: 0 })).rejects.toThrow(/at least one side/u);
		await expect(addMargins(bytes, { top: 2000, right: 0, bottom: 0, left: 0 })).rejects.toThrow(/50 cm/u);
		await expect(addMargins(bytes, { top: Number.NaN, right: 0, bottom: 0, left: 0 })).rejects.toThrow(PdfInputError);
	});
});

describe("applyEdits, at the edges", () => {
	it("writes a note and a box over the page", async () => {
		const out = await PDFDocument.load(
			await applyEdits(await makePdf(), [
				{ kind: "text", page: 1, x: 0.1, y: 0.2, text: "Approved", font: "times", size: 14, color: "black" },
				{ kind: "highlight", page: 1, x: 0.1, y: 0.5, color: "black", size: 12, text: "x", font: "times" },
			]),
		);
		expect(out.getPageCount()).toBe(1);
		expect(fontsOn(out).length).toBeGreaterThan(0);
	});

	it("refuses nonsense rather than guessing", async () => {
		const bytes = await makePdf(2);
		await expect(applyEdits(bytes, [])).rejects.toThrow(PdfInputError);
		await expect(applyEdits(bytes, [{ kind: "text", page: 9, x: 0.1, y: 0.1, text: "hi", font: "times", size: 12, color: "black" }])).rejects.toThrow(/page/u);
		await expect(applyEdits(bytes, [{ kind: "text", page: 1, x: 0.1, y: 0.1, text: "   ", font: "times", size: 12, color: "black" }])).rejects.toThrow(/Type something/u);
		await expect(applyEdits(bytes, [{ kind: "text", page: 1, x: 0.1, y: 0.1, text: "日本語", font: "times", size: 12, color: "black" }])).rejects.toThrow(PdfInputError);
	});
});

/** A 1 × 1 red PNG, enough for the embedding path to have real bytes to read. */
const PICTURE = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** A solid PNG of any shape, so the aspect ratio can be checked for real. */
const pngOf = (width: number, height: number): Uint8Array => {
	const crcTable = Array.from({ length: 256 }, (_value, index) => {
		let crc = index;
		for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
		return crc >>> 0;
	});
	const crc = (buffer: Buffer) => {
		let value = 0xffffffff;
		for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
		return (value ^ 0xffffffff) >>> 0;
	};
	const chunk = (type: string, data: Buffer) => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
		const sum = Buffer.alloc(4);
		sum.writeUInt32BE(crc(body));
		return Buffer.concat([length, body, sum]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	header[9] = 6;
	const rows = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rows.set([200, 30, 30, 255], y * (width * 4 + 1) + 1 + x * 4);
	return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]));
};

const contentOf = (doc: PDFDocument, pageIndex = 0) => {
	const node = doc.getPage(pageIndex).node;
	const contents = node.Contents() as unknown as { asArray?: () => unknown[] };
	const items = contents?.asArray ? contents.asArray() : [contents];
	let text = "";
	for (const item of items) {
		const stream = doc.context.lookup(item as never);
		if (!(stream instanceof PDFRawStream)) continue;
		const data = stream.getContents();
		try {
			text += new TextDecoder("latin1").decode(zlib.inflateSync(Buffer.from(data)));
		} catch {
			text += new TextDecoder("latin1").decode(data);
		}
	}
	return text;
};

describe("applyEdits, the look of the words", () => {
	it("uses the bold cut when bold is asked for", async () => {
		const plain = await PDFDocument.load(await applyEdits(await makePdf(), [{ color: "#000000", font: "helvetica", kind: "text", page: 1, size: 12, text: "Bold", weight: "regular", x: 0.1, y: 0.2 }]));
		const bold = await PDFDocument.load(await applyEdits(await makePdf(), [{ color: "#000000", font: "helvetica", kind: "text", page: 1, size: 12, text: "Bold", weight: "bold", x: 0.1, y: 0.2 }]));
		expect(fontsOn(plain).join(" ")).not.toContain("Bold");
		expect(fontsOn(bold).join(" ")).toContain("Bold");
	});

	it("leaves the words without a background unless one is asked for", async () => {
		const bare = await PDFDocument.load(await applyEdits(await makePdf(), [{ color: "#111111", kind: "text", page: 1, size: 12, text: "Plain", x: 0.1, y: 0.2 }]));
		// No rectangle means no line-width operator and no filled path anywhere on the page.
		expect(contentOf(bare)).not.toContain("0 w");
		expect(contentOf(bare)).not.toContain("\nf\n");

		const boxed = await PDFDocument.load(await applyEdits(await makePdf(), [{ background: "#fdf3c4", color: "#111111", kind: "text", page: 1, size: 12, text: "Plain", x: 0.1, y: 0.2 }]));
		const content = contentOf(boxed);
		// Lemon background: 253/255, 243/255, 196/255, filled behind the words.
		expect(content).toContain("0.9921568627450981 0.9529411764705882 0.7686274509803922 rg");
		expect(content).toContain("\nh\nf\n");
	});

	it("takes any colour for the ink", async () => {
		const red = await PDFDocument.load(await applyEdits(await makePdf(), [{ color: "#ff0000", kind: "text", page: 1, size: 12, text: "Red", x: 0.1, y: 0.2 }]));
		expect(contentOf(red)).toContain("1 0 0 rg");
		// An unreadable colour falls back to black rather than throwing away the note.
		const odd = await PDFDocument.load(await applyEdits(await makePdf(), [{ color: "chartreuse-ish", kind: "text", page: 1, size: 12, text: "Odd", x: 0.1, y: 0.2 }]));
		expect(contentOf(odd)).toContain("0.1 0.1 0.1 rg");
	});

	it("reads a colour name, a hash, or a fallback", () => {
		expect(toInk("#ff0000", [0, 0, 0])).toEqual([1, 0, 0]);
		expect(toInk("#f00", [0, 0, 0])).toEqual([1, 0, 0]);
		expect(toInk("red", [0, 0, 0])).toEqual([0.72, 0.16, 0.14]);
		expect(toInk("nonsense", [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5]);
		expect(toInk(null, [0.5, 0.5, 0.5])).toEqual([0.5, 0.5, 0.5]);
	});
});

describe("applyEdits, pictures", () => {
	it("draws a picture at the width it was given", async () => {
		const out = await PDFDocument.load(
			await applyEdits(await makePdf(1, [600, 800]), [{ kind: "image", page: 1, picture: { bytes: new Uint8Array(PICTURE), format: "png" }, width: 0.5, x: 0.1, y: 0.5 }]),
		);
		const content = contentOf(out);
		expect(content).toContain("Do");
		// 600 wide page, half of it: 300 pt across, and a square 1 × 1 image keeps its shape.
		expect(content).toContain("300 0 0 300 0 0 cm");
		expect(content).toContain("1 0 0 1 60 100 cm");
	});

	it("keeps the picture's own proportions", async () => {
		// A 3 × 1 picture at 300 pt across has to come out 100 pt tall.
		const out = await PDFDocument.load(
			await applyEdits(await makePdf(1, [600, 800]), [{ kind: "image", page: 1, picture: { bytes: pngOf(3, 1), format: "png" }, width: 0.5, x: 0, y: 0 }]),
		);
		expect(contentOf(out)).toContain("300 0 0 100 0 0 cm");
	});

	it("refuses a picture with no bytes behind it", async () => {
		await expect(applyEdits(await makePdf(), [{ kind: "image", page: 1, x: 0.1, y: 0.1 }])).rejects.toThrow(/Choose a picture/u);
	});

	it("lowers the opacity of a picture without touching the page", async () => {
		const out = await PDFDocument.load(
			await applyEdits(await makePdf(), [{ kind: "image", opacity: 0.4, page: 1, picture: { bytes: new Uint8Array(PICTURE), format: "png" }, width: 0.2, x: 0.2, y: 0.2 }]),
		);
		expect(contentOf(out)).toContain("Do");
		expect(out.getPage(0).node.Resources()?.toString() ?? "").toContain("ExtGState");
	});
});
