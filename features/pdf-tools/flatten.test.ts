import zlib from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFStream, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { countAnnotations, flattenPdf } from "@/features/pdf-tools/flatten";

const pageText = async (doc: PDFDocument) => {
	const page = doc.getPage(0);
	const font = await doc.embedFont(StandardFonts.TimesRoman);
	page.drawText("clause one", { x: 20, y: 560, size: 12, font });
};

const contentOf = (doc: PDFDocument, page = 0) => {
	const node = doc.getPage(page).node;
	const contents = node.Contents() as unknown as { asArray?: () => unknown[] };
	const items = contents?.asArray ? contents.asArray() : [contents];
	let text = "";
	for (const item of items) {
		const stream = doc.context.lookup(item as never);
		if (!(stream instanceof PDFRawStream)) continue;
		const data = stream.getContents();
		try {
			text += new TextDecoder().decode(zlib.inflateSync(Buffer.from(data)));
		} catch {
			text += new TextDecoder().decode(data);
		}
	}
	return text;
};

/** The decoded bytes of every XObject a page draws, so appearance art can be looked for. */
const xobjectText = (doc: PDFDocument) => {
	const resources = doc.getPage(0).node.Resources();
	const xobjects = resources?.lookup(PDFName.of("XObject"), PDFDict);
	if (!(xobjects instanceof PDFDict)) return "";
	let text = "";
	for (const [, value] of xobjects.entries()) {
		const stream = doc.context.lookup(value);
		if (!(stream instanceof PDFStream)) continue;
		const data = stream.getContents();
		try {
			text += new TextDecoder("latin1").decode(zlib.inflateSync(Buffer.from(data)));
		} catch {
			text += new TextDecoder("latin1").decode(data);
		}
	}
	return text;
};

const annotsOf = (doc: PDFDocument) => {
	const array = doc.getPage(0).node.Annots();
	if (!array) return [];
	const out: PDFDict[] = [];
	for (let index = 0; index < array.size(); index += 1) {
		const annot = doc.context.lookup(array.get(index));
		if (annot instanceof PDFDict) out.push(annot);
	}
	return out;
};

/** A 400 × 600 page carrying one yellow highlight, drawn as a vector appearance stream. */
const markedPdf = async () => {
	const doc = await PDFDocument.create();
	const page = doc.addPage([400, 600]);
	await pageText(doc);
	const appearance = doc.context.stream("1 0.86 0.2 rg 0 0 100 20 re f", { BBox: [0, 0, 100, 20], Resources: doc.context.obj({}), Subtype: "Form", Type: "XObject" });
	const appearanceRef = doc.context.register(appearance);
	const annot = doc.context.obj({ AP: doc.context.obj({ N: appearanceRef }), F: 4, Rect: [50, 400, 150, 420], Subtype: "Highlight", Type: "Annot" });
	page.node.addAnnot(doc.context.register(annot));
	return new Uint8Array(await doc.save());
};

describe("flattenPdf", () => {
	it("bakes a highlight into the page as vector art", async () => {
		const { bytes, report } = await flattenPdf(await markedPdf());
		expect(report).toEqual({ baked: 1, fields: 0, skipped: 0 });

		const doc = await PDFDocument.load(bytes);
		expect(annotsOf(doc)).toHaveLength(0);
		expect(contentOf(doc)).toContain("Do");
		const resources = doc.getPage(0).node.Resources()?.toString() ?? "";
		expect(resources).toContain("FlatAnnot");
		// The yellow was already vector in the appearance stream and is still vector here.
		expect(xobjectText(doc)).toContain("1 0.86 0.2 rg");
		// The page's own words were drawn with its own font, which is still the one in use.
		expect(contentOf(doc)).toContain("/Times-Roman");
		expect(resources).toContain("Times");
	});

	it("moves the appearance to the annotation rectangle", async () => {
		const { bytes } = await flattenPdf(await markedPdf());
		const doc = await PDFDocument.load(bytes);
		// Rect is at x 50, y 400 and the 100 × 20 box is exactly the rectangle, so no scaling.
		expect(contentOf(doc)).toContain("1 0 0 1 50 400 cm");
	});

	it("leaves a page with nothing to flatten alone", async () => {
		const doc = await PDFDocument.create();
		doc.addPage([400, 600]);
		await pageText(doc);
		const original = new Uint8Array(await doc.save());
		const before = contentOf(await PDFDocument.load(original));
		const { bytes, report } = await flattenPdf(original);
		expect(report).toEqual({ baked: 0, fields: 0, skipped: 0 });
		const after = await PDFDocument.load(bytes);
		expect(contentOf(after)).toBe(before);
		expect(annotsOf(after)).toHaveLength(0);
	});

	it("keeps markup that carries no appearance", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		page.node.addAnnot(doc.context.register(doc.context.obj({ F: 4, Rect: [50, 400, 150, 420], Subtype: "Highlight", Type: "Annot" })));
		const { bytes, report } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(report).toEqual({ baked: 0, fields: 0, skipped: 1 });
		expect(annotsOf(await PDFDocument.load(bytes))).toHaveLength(1);
	});

	it("keeps links as links", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		page.node.addAnnot(doc.context.register(doc.context.obj({ Rect: [20, 540, 120, 560], Subtype: "Link", Type: "Annot" })));
		const { bytes, report } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(report).toEqual({ baked: 0, fields: 0, skipped: 0 });
		expect(annotsOf(await PDFDocument.load(bytes))).toHaveLength(1);
	});

	it("flattens a filled-in form field", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		const form = doc.getForm();
		const field = form.createTextField("name");
		field.setText("Ada Lovelace");
		field.addToPage(page, { height: 24, width: 200, x: 50, y: 500 });
		const { bytes, report } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(report.fields).toBe(1);

		const after = await PDFDocument.load(bytes);
		expect(after.getForm().getFields()).toHaveLength(0);
		expect(contentOf(after)).toContain("Do");
		expect(annotsOf(after)).toHaveLength(0);
	});

	it("counts what is there before flattening", async () => {
		const doc = await PDFDocument.create();
		const withMark = await PDFDocument.load(await markedPdf());
		const page = doc.addPage([400, 600]);
		const form = doc.getForm();
		const field = form.createTextField("name");
		field.setText("Ada");
		field.addToPage(page, { height: 24, width: 200, x: 50, y: 500 });
		for (const source of withMark.getPages()) page.node.addAnnot(doc.context.register(doc.context.obj({ AP: source.node.Annots()?.get(0) ? doc.context.obj({}) : doc.context.obj({}), Rect: [10, 10, 60, 30], Subtype: "Square", Type: "Annot" })));
		expect(await countAnnotations(new Uint8Array(await doc.save()))).toEqual({ fields: 1, markup: 1 });
		expect(await countAnnotations(await markedPdf())).toEqual({ fields: 0, markup: 1 });
	});

	it("handles a page whose highlight is a state-keyed appearance", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		const appearance = doc.context.stream("0 0 1 rg 0 0 50 10 re f", { BBox: [0, 0, 50, 10], Resources: doc.context.obj({}), Subtype: "Form", Type: "XObject" });
		const appearanceRef = doc.context.register(appearance);
		const annot = doc.context.obj({ AP: doc.context.obj({ N: doc.context.obj({ On: appearanceRef }) }), AS: "On", F: 4, Rect: [10, 20, 60, 30], Subtype: "Square", Type: "Annot" });
		page.node.addAnnot(doc.context.register(annot));
		const { bytes, report } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(report.baked).toBe(1);
		expect(contentOf(await PDFDocument.load(bytes))).toContain("Do");
	});

	it("takes a scaled appearance and fits it to the rectangle", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		const appearance = doc.context.stream("0 0 1 rg 0 0 10 10 re f", { BBox: [0, 0, 10, 10], Resources: doc.context.obj({}), Subtype: "Form", Type: "XObject" });
		const appearanceRef = doc.context.register(appearance);
		page.node.addAnnot(doc.context.register(doc.context.obj({ AP: doc.context.obj({ N: appearanceRef }), F: 4, Rect: [100, 200, 300, 260], Subtype: "Ink", Type: "Annot" })));
		const { bytes } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(contentOf(await PDFDocument.load(bytes))).toContain("20 0 0 6 100 200 cm");
	});

	it("looks past a broken annotation entry", async () => {
		const doc = await PDFDocument.create();
		const page = doc.addPage([400, 600]);
		await pageText(doc);
		page.node.set(PDFName.of("Annots"), doc.context.obj([]) as PDFArray);
		expect(page.node.Annots()?.size()).toBe(0);
		const { bytes, report } = await flattenPdf(new Uint8Array(await doc.save()));
		expect(report).toEqual({ baked: 0, fields: 0, skipped: 0 });
		expect(await PDFDocument.load(bytes)).toBeTruthy();
	});
});
