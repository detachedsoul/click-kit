import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildXlsx, readXlsx } from "@/features/converter-tools/xlsx";
import { SpreadsheetTool } from "@/features/converter-tools/xlsx-tool";

const objectUrls = new Map<string, Blob>();

beforeEach(() => {
	objectUrls.clear();
	let next = 0;
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		writable: true,
		value: vi.fn((blob: Blob) => {
			next += 1;
			objectUrls.set(`blob:sheet/${next}`, blob);
			return `blob:sheet/${next}`;
		}),
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

const csvFile = (name = "spend.csv") => new File(["Item,Cost\nTea,3.5\nCoffee,12\n"], name, { type: "text/csv" });

const xlsxFile = async (name = "budget.xlsx", sheets = [{ name: "March", rows: [["Item", "Cost"], ["Tea", "3.5"]] }]) =>
	new File([(await buildXlsx(sheets)).slice().buffer], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

const blobOf = async (label: RegExp) => {
	const link = await screen.findByRole("link", { name: label });
	const blob = objectUrls.get(link.getAttribute("href") ?? "");
	if (!blob) throw new Error("no blob behind the link");
	return { link, blob };
};

describe("csv to excel", () => {
	it("previews the rows before writing anything", async () => {
		const user = userEvent.setup();
		render(<SpreadsheetTool />);
		await user.upload(screen.getByLabelText("CSV file"), csvFile());
		await screen.findByRole("button", { name: "Build the workbook" });
		expect(screen.getByText("Tea")).toBeTruthy();
		expect(screen.getByText("Rows").parentElement?.textContent).toContain("3");
		expect(screen.getByText("Numbers").parentElement?.textContent).toContain("2");
	});

	it("writes a workbook Excel can open", async () => {
		const user = userEvent.setup();
		render(<SpreadsheetTool />);
		await user.upload(screen.getByLabelText("CSV file"), csvFile());
		await user.click(await screen.findByRole("button", { name: "Build the workbook" }));
		const { link, blob } = await blobOf(/Download spend\.xlsx$/u);
		expect(link).toHaveProperty("download", "spend.xlsx");
		const sheets = await readXlsx(new Uint8Array(await blob.arrayBuffer()));
		expect(sheets[0].name).toBe("spend");
		expect(sheets[0].rows).toEqual([
			["Item", "Cost"],
			["Tea", "3.5"],
			["Coffee", "12"],
		]);
	});

	it("calls out the wrong file type", async () => {
		render(<SpreadsheetTool />);
		const input = screen.getByLabelText("CSV file");
		Object.defineProperty(input, "files", { configurable: true, value: [await xlsxFile()] });
		fireEvent.change(input);
		expect((await screen.findByRole("alert")).textContent).toContain("not a .csv file");
	});
});

describe("excel to csv", () => {
	const switchToExcel = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Excel to CSV" }));

	it("reads a workbook and offers its rows as CSV", async () => {
		const user = userEvent.setup();
		render(<SpreadsheetTool />);
		await switchToExcel(user);
		await user.upload(screen.getByLabelText("Excel workbook (.xlsx)"), await xlsxFile());
		await user.click(await screen.findByRole("button", { name: "Build the CSV" }));
		const { link, blob } = await blobOf(/Download budget\.csv$/u);
		expect(link).toHaveProperty("download", "budget.csv");
		expect(await blob.text()).toBe("Item,Cost\nTea,3.5\n");
	});

	it("lets you pick the sheet, and names the file after it", async () => {
		const user = userEvent.setup();
		render(<SpreadsheetTool />);
		await switchToExcel(user);
		await user.upload(
			screen.getByLabelText("Excel workbook (.xlsx)"),
			await xlsxFile("budget.xlsx", [
				{ name: "March", rows: [["a"]] },
				{ name: "April", rows: [["b"]] },
			]),
		);
		const picker = await screen.findByLabelText("Which sheet");
		await user.selectOptions(picker, "1");
		await user.click(screen.getByRole("button", { name: "Build the CSV" }));
		const { link, blob } = await blobOf(/Download budget-April\.csv$/u);
		expect(link).toHaveProperty("download", "budget-April.csv");
		expect(await blob.text()).toBe("b\n");
	});

	it("explains a workbook it cannot read", async () => {
		render(<SpreadsheetTool />);
		await userEvent.setup().click(screen.getByRole("button", { name: "Excel to CSV" }));
		const input = screen.getByLabelText("Excel workbook (.xlsx)");
		const broken = new File(["nope"], "broken.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
		fireEvent.change(input, { target: { files: [broken] } });
		await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be opened"));
	});

	it("switching direction clears the last file", async () => {
		const user = userEvent.setup();
		render(<SpreadsheetTool />);
		await user.upload(screen.getByLabelText("CSV file"), csvFile());
		await screen.findByRole("button", { name: "Build the workbook" });
		await switchToExcel(user);
		expect(screen.queryByRole("button", { name: "Build the workbook" })).toBeNull();
		expect(screen.getByLabelText("Excel workbook (.xlsx)")).toBeTruthy();
	});
});
