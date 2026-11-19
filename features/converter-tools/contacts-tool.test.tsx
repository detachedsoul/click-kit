import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ContactsConverterTool } from "@/features/converter-tools/contacts-tool";

afterEach(cleanup);

const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;

describe("contacts converter", () => {
	it("starts with the sample card as a csv row", () => {
		render(<ContactsConverterTool />);
		expect(output().split("\n")[0]).toBe("Name,First name,Last name,Organization,Title,Phone,Mobile,Email,Website,Address,Note,Birthday");
		expect(output()).toContain("Amara Okafor,Amara,Okafor,Lagos Textiles");
		expect(output()).toContain("+234 802 555 0111");
		expect(screen.getByText("Contacts").parentElement?.textContent).toContain("1");
	});

	it("converts pasted cards after loading", async () => {
		const user = userEvent.setup();
		render(<ContactsConverterTool />);
		const input = screen.getByLabelText("vCards");
		await user.clear(input);
		await user.click(input);
		await user.paste("BEGIN:VCARD\nFN:Chidi Bello\nTEL;TYPE=CELL:+234 803 555 0122\nEND:VCARD\nBEGIN:VCARD\nFN:Ada Lovelace\nEMAIL:ada@example.com\nEND:VCARD");
		expect(screen.getByText("Contacts").parentElement?.textContent).toContain("2");
		expect(output()).toContain("Ada Lovelace");
	});

	it("switches to csv input and swaps in its sample", async () => {
		const user = userEvent.setup();
		render(<ContactsConverterTool />);
		await user.click(screen.getByRole("button", { name: "CSV to vCard" }));
		expect(screen.getByLabelText("CSV")).toBeTruthy();
		expect(output()).toContain("BEGIN:VCARD");
		expect(output()).toContain("TEL;TYPE=CELL:+234 802 555 0111");
		expect(screen.getByLabelText("Result")).toBeTruthy();
	});

	it("keeps what the user typed when the direction changes", async () => {
		const user = userEvent.setup();
		render(<ContactsConverterTool />);
		const input = screen.getByLabelText("vCards");
		await user.clear(input);
		await user.click(input);
		await user.paste("BEGIN:VCARD\nFN:Only Mine\nEND:VCARD");
		await user.click(screen.getByRole("button", { name: "CSV to vCard" }));
		expect((screen.getByLabelText("CSV") as HTMLTextAreaElement).value).toContain("Only Mine");
		expect((screen.getByRole("alert")).textContent).toMatch(/No rows found/u);
	});

	it("says when there is nothing to convert", async () => {
		const user = userEvent.setup();
		render(<ContactsConverterTool />);
		await user.clear(screen.getByLabelText("vCards"));
		await user.click(screen.getByLabelText("vCards"));
		await user.paste("just a note");
		expect((await screen.findByRole("alert")).textContent).toMatch(/No vCards found/u);
	});

	it("offers a vcf download on the way back", async () => {
		const user = userEvent.setup();
		render(<ContactsConverterTool />);
		await user.click(screen.getByRole("button", { name: "CSV to vCard" }));
		expect(await screen.findByRole("link", { name: "Download contacts.vcf" })).toBeTruthy();
	});
});
