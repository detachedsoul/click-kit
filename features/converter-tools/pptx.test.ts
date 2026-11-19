import { describe, expect, it } from "vitest";
import { createZip } from "@/features/image-tools/zip-utils";
import { deckToMarkdown, deckToText, deckWordCount, readPptx } from "@/features/converter-tools/pptx";

const encoder = new TextEncoder();

const slide = (title: string, bullets: string[], extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld><p:spTree>
		<p:sp><p:txBody>
			<a:p><a:r><a:t>${title}</a:t></a:r></a:p>
		</p:txBody>
		<p:nvSpPr><p:nvPr><p:ph type="title" /></p:nvPr></p:nvSpPr></p:sp>
		<p:sp><p:txBody>
			${bullets.map((bullet) => `<a:p><a:r><a:t>${bullet}</a:t></a:r></a:p>`).join("")}
		</p:txBody></p:sp>
		${extra}
	</p:spTree></p:cSld>
</p:sld>`;

const notes = (text: string) => `<?xml version="1.0" encoding="UTF-8"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
	<p:cSld><p:spTree>
		<p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody>
			<p:nvSpPr><p:nvPr><p:ph type="body" /></p:nvPr></p:nvSpPr></p:sp>
		<p:sp><p:txBody><a:p><a:r><a:t>7</a:t></a:r></a:p></p:txBody>
			<p:nvSpPr><p:nvPr><p:ph type="sldNum" /></p:nvPr></p:nvSpPr></p:sp>
	</p:spTree></p:cSld>
</p:notes>`;

const rels = (notesFile: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/${notesFile}" />
</Relationships>`;

const buildDeck = async () => {
	const files = [
		{ name: "[Content_Types].xml", data: encoder.encode('<?xml version="1.0"?><Types />') },
		{ name: "ppt/presentation.xml", data: encoder.encode('<?xml version="1.0"?><p:presentation />') },
		{ name: "ppt/slides/slide1.xml", data: encoder.encode(slide("Why we are here", ["The quarter in numbers", "What changed"])) },
		{ name: "ppt/slides/slide2.xml", data: encoder.encode(slide("Next steps", ["Ship the beta", "Book the review"])) },
		{ name: "ppt/slides/_rels/slide1.xml.rels", data: encoder.encode(rels("notesSlide1.xml")) },
		{ name: "ppt/notesSlides/notesSlide1.xml", data: encoder.encode(notes("Keep this to ten minutes.")) },
	];
	return createZip(files, { compress: false });
};

describe("reading a deck", () => {
	it("finds the slides in order with their titles and lines", async () => {
		const deck = await readPptx(await buildDeck());
		expect(deck.slides).toHaveLength(2);
		expect(deck.slides[0]).toEqual({
			number: 1,
			title: "Why we are here",
			lines: ["The quarter in numbers", "What changed"],
			notes: "Keep this to ten minutes.",
		});
		expect(deck.slides[1].title).toBe("Next steps");
	});

	it("leaves out the slide number placeholder in the notes", async () => {
		const deck = await readPptx(await buildDeck());
		expect(deck.slides[0].notes).not.toContain("7");
	});

	it("counts the slides it could not use", async () => {
		const files = [
			{ name: "ppt/slides/slide1.xml", data: encoder.encode(slide("Only one", [])) },
			{ name: "ppt/slides/slide2.xml", data: encoder.encode('<?xml version="1.0"?><p:sld />') },
		];
		const deck = await readPptx(await createZip(files, { compress: false }));
		expect(deck.slides).toHaveLength(2);
		expect(deck.skipped).toBe(1);
	});

	it("refuses a file with no slides in it", async () => {
		const zip = await createZip([{ name: "notes.txt", data: encoder.encode("hello") }], { compress: false });
		await expect(readPptx(zip)).rejects.toThrow(/no slides/u);
	});
});

describe("writing it out", () => {
	const deck = {
		slides: [
			{ number: 1, title: "Why we are here", lines: ["The quarter in numbers"], notes: "Keep this short." },
			{ number: 2, title: "", lines: ["Ship the beta"], notes: "" },
		],
		skipped: 0,
	};

	it("writes markdown with a heading per slide and notes as quotes", () => {
		expect(deckToMarkdown(deck)).toBe(
			["## Slide 1: Why we are here", "", "- The quarter in numbers", "", "> Keep this short.", "", "## Slide 2", "", "- Ship the beta"].join("\n"),
		);
	});

	it("writes plain text with the notes on one line", () => {
		expect(deckToText(deck)).toBe(["Slide 1 — Why we are here", "The quarter in numbers", "Notes: Keep this short.", "", "Slide 2", "Ship the beta"].join("\n"));
	});

	it("counts the words in the words it kept", () => {
		expect(deckWordCount(deck)).toBe(14);
	});
});
