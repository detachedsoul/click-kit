import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { analyseKeywordDensity, phrasePattern, tokenizeWords, verdictFor } from "@/features/text-tools/density-utils";
import DensityTool from "@/features/text-tools/density-tool";

afterEach(cleanup);

describe("keyword density", () => {
	it("counts words and phrases without partial matches", () => {
		const text = "Art and chart. Art, art! Artificial.";
		const report = analyseKeywordDensity(text, ["art"]);
		expect(report.keywords[0].count).toBe(3);
		expect(report.totalWords).toBe(6);
		expect(report.keywords[0].density).toBe(50);
	});

	it("handles multi-word phrases and case sensitivity", () => {
		const text = "Small lots, small-lots, and Small Lots.";
		expect(analyseKeywordDensity(text, ["small lots"]).keywords[0].count).toBe(3);
		expect(analyseKeywordDensity(text, ["Small Lots"], { caseSensitive: true }).keywords[0].count).toBe(1);
		expect(analyseKeywordDensity(text, ["small lots"], { caseSensitive: true }).keywords[0].count).toBe(1);
	});

	it("reports missing keywords and top terms", () => {
		const report = analyseKeywordDensity("red red blue green", ["red", "purple"]);
		expect(report.missing).toEqual(["purple"]);
		expect(report.topTerms[0]).toMatchObject({ term: "red", count: 2, density: 50 });
		expect(report.uniqueWords).toBe(3);
	});

	it("escapes regex characters and tokenises accents", () => {
		expect(phrasePattern("c++ (beta)", false)?.source).toBe("(?<![\\p{L}\\p{N}])c[^\\p{L}\\p{N}]+beta(?![\\p{L}\\p{N}])");
		expect(tokenizeWords("Café crème, naïve!")).toEqual(["Café", "crème", "naïve"]);
		expect(verdictFor(0)).toBe("not used");
		expect(verdictFor(1.4)).toBe("healthy");
		expect(verdictFor(5)).toBe("stuffed");
	});

	it("renders the report and validates input", async () => {
		const user = userEvent.setup();
		render(<DensityTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("coffee");
		expect(screen.getByText(/Density is the share/)).toBeTruthy();
		await user.clear(screen.getByLabelText("Keywords and phrases (one per line, up to 20)"));
		expect(screen.getByRole("alert").textContent).toContain("at least one keyword");
		await user.type(screen.getByLabelText("Keywords and phrases (one per line, up to 20)"), "beans");
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("beans");
	});
});
