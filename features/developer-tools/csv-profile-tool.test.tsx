import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCsvProfiler } from "@/features/developer-tools/csv-profile-core";
import { CsvProfileTool } from "@/features/developer-tools/csv-profile-tool";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

class MockWorker {
	onmessage: ((event: MessageEvent<{ report?: ReturnType<ReturnType<typeof createCsvProfiler>["finish"]>; error?: string }>) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	constructor(url: URL, options?: WorkerOptions) { void url; void options; }
	postMessage(message: { file: File }) {
		const profiler = createCsvProfiler(message.file);
		profiler.setHeader(["Item", "Amount"]);
		profiler.addRow(["Tea", "3"]);
		profiler.addRow(["Coffee", "5"]);
		queueMicrotask(() => this.onmessage?.({ data: { report: profiler.finish(",") } } as MessageEvent<{ report: ReturnType<ReturnType<typeof createCsvProfiler>["finish"]> }>));
	}
	terminate() {}
}

describe("CSV Data Profiler", () => {
	it("profiles an uploaded file in a worker and shows summaries and a preview", async () => {
		vi.stubGlobal("Worker", MockWorker);
		render(<CsvProfileTool />);
		const file = new File(["Item,Amount\nTea,3\nCoffee,5"], "prices.csv", { type: "text/csv" });
		fireEvent.change(screen.getByLabelText("CSV or delimited file"), { target: { files: [file] } });
		expect(await screen.findByRole("heading", { name: "Dataset overview" })).toBeTruthy();
		expect(screen.getByText("Rows").parentElement?.textContent).toContain("2");
		expect(screen.getByLabelText("Column statistics").textContent).toContain("Amount");
		expect(screen.getByRole("region", { name: "Data preview" }).textContent).toContain("Coffee");
		expect(screen.getByRole("button", { name: "Download JSON" })).toBeTruthy();
	});

	it("rejects unsupported file names and offers reset", () => {
		render(<CsvProfileTool />);
		const file = new File(["not a csv"], "data.pdf", { type: "application/pdf" });
		fireEvent.change(screen.getByLabelText("CSV or delimited file"), { target: { files: [file] } });
		expect(screen.getByRole("alert").textContent).toContain(".csv, .tsv");
		expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
	});
});
