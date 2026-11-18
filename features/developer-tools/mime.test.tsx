import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MimeLookupTool } from "@/features/developer-tools/mime-tool";
import { lookupByExtension, mimeTypes, searchMime } from "@/features/developer-tools/mime-utils";

afterEach(cleanup);

describe("MIME type lookup", () => {
	it("covers the common web formats without duplicate entries", () => {
		expect(mimeTypes.length).toBeGreaterThanOrEqual(80);
		expect(new Set(mimeTypes.map((item) => item.mime)).size).toBe(mimeTypes.length);
		for (const mime of ["application/json", "text/html", "image/png", "font/woff2", "video/mp4"]) {
			expect(mimeTypes.some((item) => item.mime === mime)).toBe(true);
		}
	});

	it("looks up by extension", () => {
		expect(lookupByExtension(".webp")?.mime).toBe("image/webp");
		expect(lookupByExtension("PNG")?.mime).toBe("image/png");
		expect(lookupByExtension("notes/markdown.md")?.mime).toBe("text/markdown");
		expect(lookupByExtension("")).toBeNull();
	});

	it("searches by type, extension, kind, and description", () => {
		expect(searchMime("application/pdf").map((item) => item.mime)).toEqual(["application/pdf"]);
		expect(searchMime("woff2").map((item) => item.mime)).toContain("font/woff2");
		expect(searchMime("font").every((item) => item.kind === "font" || item.mime.includes("font"))).toBe(true);
		expect(searchMime("spreadsheet").map((item) => item.mime)).toContain("application/vnd.oasis.opendocument.spreadsheet");
		expect(searchMime("nonsense")).toEqual([]);
		expect(searchMime("").length).toBe(mimeTypes.length);
	});

	it("renders results and narrows the list", () => {
		render(<MimeLookupTool />);
		expect(screen.getByRole("status").textContent).toContain(`${mimeTypes.length} of ${mimeTypes.length}`);
		fireEvent.change(screen.getByLabelText("Search by extension, MIME type, kind, or description"), { target: { value: ".jxl" } });
		expect(screen.getByText("image/jxl")).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("1 of");
		fireEvent.change(screen.getByLabelText("Search by extension, MIME type, kind, or description"), { target: { value: "zzz" } });
		expect(screen.getByText(/Nothing matched/u)).toBeTruthy();
	});
});
