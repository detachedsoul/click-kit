import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfCompareTool } from "@/features/pdf-tools/compare-tool";

const state = vi.hoisted(() => ({ first: [] as string[], second: [] as string[], calls: 0 }));

// The tool reads the documents one after the other, so the first call is the first file.
vi.mock("@/features/pdf-tools/pdf-render", () => ({
	extractPdfText: vi.fn(async () => {
		state.calls += 1;
		const which = state.calls % 2 === 1 ? state.first : state.second;
		return which.map((text, index) => ({ page: index + 1, text }));
	}),
}));

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:compare/1") });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
	state.calls = 0;
	state.first = ["Payment is due in 30 days.\nSecond line.", "Signature here."];
	state.second = ["Payment is due in 60 days.\nSecond line.", "Signature here."];
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const makePdf = async (marker: string) => {
	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	doc.addPage([300, 400]).drawText(marker, { x: 20, y: 360, size: 10, font });
	return new File([new Uint8Array(await doc.save())], `${marker.toLowerCase()}.pdf`, { type: "application/pdf" });
};

const loadBoth = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.upload(screen.getByLabelText("First PDF (the original)"), await makePdf("FIRST"));
	await user.upload(screen.getByLabelText("Second PDF (the newer one)"), await makePdf("SECOND"));
	await screen.findByRole("button", { name: "Compare the words" });
};

describe("pdf compare tool", () => {
	it("waits for two documents", async () => {
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await user.upload(screen.getByLabelText("First PDF (the original)"), await makePdf("FIRST"));
		expect((screen.getByRole("button", { name: "Compare the words" }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("says what changed and where", async () => {
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Compare the words" }));
		expect((await screen.findByRole("status")).textContent).toContain("1 page changed");
		expect(screen.getByText("Page 1 — changed")).toBeTruthy();
		expect(screen.getByText("Payment is due in 30 days.")).toBeTruthy();
		expect(screen.getByText("Payment is due in 60 days.")).toBeTruthy();
		expect(screen.getByText("Changed").parentElement?.textContent).toContain("1");
	});

	it("marks an identical pair as unchanged", async () => {
		state.second = state.first;
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Compare the words" }));
		expect((await screen.findByRole("status")).textContent).toContain("No differences");
		expect(screen.getByText(/The two files read identically/u)).toBeTruthy();
	});

	it("counts pages that only one file has", async () => {
		state.second = [...state.first, "An extra page."];
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Compare the words" }));
		expect(await screen.findByText("Page 3 — added")).toBeTruthy();
		expect(screen.getByText("Added").parentElement?.textContent).toContain("1");
	});

	it("offers the report as a download", async () => {
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Compare the words" }));
		const link = await screen.findByRole("link", { name: "Download the report" });
		expect(link).toHaveProperty("download", "first-compared.md");
	});

	it("starts again with a clean sheet", async () => {
		const user = userEvent.setup();
		render(<PdfCompareTool />);
		await loadBoth(user);
		await user.click(screen.getByRole("button", { name: "Compare the words" }));
		await screen.findByRole("status");
		await user.click(screen.getByRole("button", { name: "Start again" }));
		expect(screen.queryByRole("status")).toBeNull();
		expect((screen.getByRole("button", { name: "Compare the words" }) as HTMLButtonElement).disabled).toBe(true);
	});
});
