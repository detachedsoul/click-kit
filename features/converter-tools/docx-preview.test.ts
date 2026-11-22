import { renderAsync } from "docx-preview";
import { describe, expect, it } from "vitest";
import { writeZip } from "@/features/converter-tools/zip-write";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const image = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64"));

const makeDocx = () => writeZip([
	{
		name: "[Content_Types].xml",
		data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
	},
	{
		name: "_rels/.rels",
		data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
	},
	{
		name: "word/_rels/document.xml.rels",
		data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',
	},
	{
		name: "word/document.xml",
		data: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${W}" xmlns:r="${R}"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Visually rendered title</w:t></w:r></w:p><w:p><w:r><w:t>Body paragraph</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Product</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Quantity</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Notebook</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>12</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Embedded image"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`,
	},
	{ name: "word/media/image1.png", data: image },
]);

describe("DOCX browser renderer", () => {
	it("renders text, styling, embedded pictures, and page styles into browser DOM", async () => {
		const root = document.createElement("div");
		const styles = document.createElement("div");
		await renderAsync(makeDocx().slice().buffer, root, styles, { breakPages: true, className: "docx", ignoreFonts: false, useBase64URL: true });
		expect(root.querySelectorAll(".docx-wrapper > section.docx").length).toBe(1);
		expect(root.textContent).toContain("Visually rendered title");
		expect(root.textContent).toContain("Body paragraph");
		const table = root.querySelector(".docx table");
		expect(table?.querySelectorAll("tr")).toHaveLength(2);
		expect(table?.querySelectorAll("td, th")).toHaveLength(4);
		expect(table?.textContent).toContain("Product");
		expect(table?.textContent).toContain("Notebook");
		expect(table?.textContent).toContain("12");
		expect(root.querySelector(".docx img")?.getAttribute("src")).toMatch(/^data:image\/png;base64,/u);
		expect(styles.querySelector("style")?.textContent).toContain(".docx");
	});
});
