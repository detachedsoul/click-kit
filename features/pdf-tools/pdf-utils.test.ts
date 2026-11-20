import { describe, expect, it } from "vitest";
import {
	formatPageList,
	groupLabel,
	isPdf,
	pageWord,
	parsePageRange,
	parseRangeGroups,
	pdfBaseName,
	pdfErrorMessage,
	pdfFileName,
	pdfOutputName,
	splitKeywords,
	validatePdfFile,
	validatePdfFiles,
} from "@/features/pdf-tools/pdf-utils";

const pdfFile = (name = "report.pdf", size = 1000, type = "application/pdf") =>
	new File([new Uint8Array(size)], name, { type });

describe("pdf helpers", () => {
	it("reads page selections the way people write them", () => {
		expect(parsePageRange("1-3, 5", 10)).toEqual([1, 2, 3, 5]);
		expect(parsePageRange("8-", 8)).toEqual([8]);
		expect(parsePageRange("-3", 10)).toEqual([1, 2, 3]);
		expect(parsePageRange("2, 2, 4", 5)).toEqual([2, 2, 4]);
		expect(parsePageRange("3–4", 5)).toEqual([3, 4]);
		expect(() => parsePageRange("", 5)).toThrow(/at least one page/u);
		expect(() => parsePageRange("9", 5)).toThrow(/has 5 pages/u);
		expect(() => parsePageRange("4-2", 5)).toThrow(/backwards/u);
		expect(() => parsePageRange("1,,3", 5)).toThrow(/empty part/u);
		expect(() => parsePageRange("cover", 5)).toThrow(/not a page number/u);
		expect(() => parsePageRange("1", 0)).toThrow(/Add a PDF/u);
	});

	it("splits a selection into one group per semicolon", () => {
		expect(parseRangeGroups("1-3; 4-6; 7", 8)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
		expect(() => parseRangeGroups("  ", 8)).toThrow(/at least one range/u);
		expect(parseRangeGroups("1;2", 2)).toEqual([[1], [2]]);
	});

	it("writes tidy lists and file names", () => {
		expect(formatPageList([3, 1, 2, 7, 5, 6])).toBe("1–3, 5–7");
		expect(formatPageList([4])).toBe("4");
		expect(formatPageList([1, 1, 2])).toBe("1–2");
		expect(groupLabel([5])).toBe("page-5");
		expect(groupLabel([2, 3, 4])).toBe("pages-2-4");
		expect(pdfBaseName("Report Final.PDF")).toBe("Report Final");
		expect(pdfBaseName("  ")).toBe("document");
		expect(pdfOutputName("report.pdf", "merged")).toBe("report-merged.pdf");
		expect(pageWord(1)).toBe("1 page");
		expect(pageWord(3)).toBe("3 pages");
	});

	it("explains what went wrong with a file", () => {
		expect(pdfErrorMessage(new Error("Input document to PDFDocument.load is encrypted"))).toMatch(/password protected/u);
		expect(pdfErrorMessage(new Error("Failed to parse PDF document"))).toMatch(/not a readable PDF/u);
		expect(pdfErrorMessage(new Error("boom"))).toMatch(/could not be read/u);
		expect(pdfErrorMessage("plain string")).toMatch(/could not be read/u);
	});

	it("reads keywords written with commas or only spaces", () => {
		expect(splitKeywords("invoice, tax, 2026")).toEqual(["invoice", "tax", "2026"]);
		expect(splitKeywords("invoice tax 2026")).toEqual(["invoice", "tax", "2026"]);
		expect(splitKeywords("machine learning, ai")).toEqual(["machine learning", "ai"]);
		expect(splitKeywords("  ")).toEqual([]);
		expect(splitKeywords(null)).toEqual([]);
	});

	it("checks files before they are read", () => {
		expect(isPdf(pdfFile())).toBe(true);
		expect(isPdf(new File([new Uint8Array([1])], "scan.PDF", { type: "" }))).toBe(true);
		expect(isPdf(new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" }))).toBe(false);
		expect(validatePdfFile(pdfFile())).toBe("");
		expect(validatePdfFile(new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" }))).toBe("Choose a PDF file.");
		expect(validatePdfFile(pdfFile("a.pdf", 0))).toMatch(/empty/u);
		expect(validatePdfFile(pdfFile("a.pdf", 51 * 1024 * 1024))).toMatch(/50 MB/u);
		expect(validatePdfFiles([])).toMatch(/at least one PDF/u);
		expect(validatePdfFiles([pdfFile("a.pdf"), pdfFile("b.pdf")])).toBe("");
		expect(validatePdfFiles([pdfFile("a.txt", 10, "text/plain")])).toMatch(/a.txt: Choose a PDF/u);
		expect(validatePdfFiles([pdfFile("a.pdf", 50 * 1024 * 1024), pdfFile("b.pdf", 50 * 1024 * 1024), pdfFile("c.pdf", 50 * 1024 * 1024), pdfFile("d.pdf", 50 * 1024 * 1024), pdfFile("e.pdf", 50 * 1024 * 1024)])).toMatch(/200 MB/u);
	});
});

describe("file names you choose", () => {
	it("adds the suffix once", () => {
		expect(pdfFileName("handout", "merged")).toBe("handout.pdf");
		expect(pdfFileName("handout.pdf", "merged")).toBe("handout.pdf");
		expect(pdfFileName("HANDOUT.PDF", "merged")).toBe("HANDOUT.pdf");
	});

	it("keeps a name the file system will accept", () => {
		expect(pdfFileName("Annual report / 2026", "merged")).toBe("Annual report - 2026.pdf");
		expect(pdfFileName('what: "now"?', "merged")).toBe("what- -now.pdf");
		expect(pdfFileName("a\\b", "merged")).toBe("a-b.pdf");
	});

	it("trims the ends and tidies the spacing", () => {
		expect(pdfFileName("   spaced   out   ", "merged")).toBe("spaced out.pdf");
		expect(pdfFileName("...dots...", "merged")).toBe("dots.pdf");
	});

	it("falls back when nothing is left", () => {
		expect(pdfFileName("", "first-merged")).toBe("first-merged.pdf");
		expect(pdfFileName("   ", "first-merged")).toBe("first-merged.pdf");
		expect(pdfFileName("///", "first-merged")).toBe("first-merged.pdf");
	});

	it("keeps very long names to something sane", () => {
		const long = pdfFileName("a".repeat(300), "merged");
		expect(long.length).toBeLessThanOrEqual(94);
		expect(long.endsWith(".pdf")).toBe(true);
	});
});
