import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateFileFinder } from "@/features/image-tools/duplicate-file-finder";

vi.mock("@/features/image-tools/duplicate-utils", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/image-tools/duplicate-utils")>()),
	hashFilesInWorker: vi.fn(async (inputs: { id: string }[], progress: (done: number, total: number) => void) => {
		progress(inputs.length, inputs.length);
		return new Map(inputs.map(({ id }) => [id, "same-content-hash"]));
	}),
}));

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});
afterEach(cleanup);

describe("duplicate file finder", () => {
	it("finds duplicate groups and exports a cleaned collection and report", async () => {
		const user = userEvent.setup();
		render(<DuplicateFileFinder />);
		const first = new File(["same bytes"], "first.txt", { type: "text/plain" });
		const second = new File(["same bytes"], "copy.txt", { type: "text/plain" });
		fireEvent.change(screen.getByLabelText("Files to compare"), { target: { files: [first, second] } });
		await user.click(screen.getByRole("button", { name: "Find duplicates" }));
		await screen.findByText(/SHA-256: same-content-hash/);
		expect(screen.getByText(/different filenames/)).toBeTruthy();
		await user.click(screen.getByRole("checkbox", { name: "Remove copy.txt from cleaned ZIP" }));
		await user.click(screen.getByRole("button", { name: "Download cleaned ZIP" }));
		expect((await screen.findByRole("link", { name: "Save cleaned-collection.zip" })).getAttribute("download")).toBe("cleaned-collection.zip");
		await user.click(screen.getByRole("button", { name: "Export duplicate report" }));
		expect((await screen.findByRole("link", { name: "Save duplicate-report.csv" })).getAttribute("download")).toBe("duplicate-report.csv");
	});
});
