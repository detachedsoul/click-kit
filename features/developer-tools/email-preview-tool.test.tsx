import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailPreviewTool } from "@/features/developer-tools/email-preview-tool";

afterEach(cleanup);

describe("HTML email previewer", () => {
	it("renders a sandboxed responsive preview and switches viewport widths", async () => {
		const user = userEvent.setup();
		render(<EmailPreviewTool />);
		const initial = screen.getByTitle("Email preview at 375 pixels");
		expect(initial.getAttribute("sandbox")).toBe("");
		expect(initial.getAttribute("referrerpolicy")).toBe("no-referrer");
		await user.selectOptions(screen.getByLabelText("Preview size"), "desktop");
		expect(screen.getByTitle("Email preview at 1024 pixels").getAttribute("style")).toContain("width: 1024px");
	});

	it("shows a plain-text version, loads sample templates, and resets to the chosen sample", async () => {
		const user = userEvent.setup();
		render(<EmailPreviewTool />);
		await user.click(screen.getByRole("button", { name: "Plain text" }));
		expect(screen.getByLabelText("Plain text version").textContent).toContain("Welcome aboard, Ada");
		await user.selectOptions(screen.getByLabelText("Sample template"), "receipt");
		expect((screen.getByLabelText("HTML template") as HTMLTextAreaElement).value).toContain("#CK-2048");
		fireEvent.change(screen.getByLabelText("HTML template"), { target: { value: "<p>Draft text</p>" } });
		await user.click(screen.getByRole("button", { name: "Reset preview" }));
		expect((screen.getByLabelText("HTML template") as HTMLTextAreaElement).value).toContain("#CK-2048");
		expect(screen.getByTitle("Email preview at 375 pixels")).toBeTruthy();
	});

	it("requires opt-in for remote images and can download the original HTML", async () => {
		const user = userEvent.setup();
		const createObjectURL = vi.fn(() => "blob:email-template");
		Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
		Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
		render(<EmailPreviewTool />);
		const source = screen.getByLabelText("HTML template");
		fireEvent.change(source, { target: { value: "<!doctype html><p>Hello</p><img src=\"https://images.example/pixel.png\">" } });
		expect(screen.getByText(/Remote images are blocked/u)).toBeTruthy();
		await user.click(screen.getByLabelText("Load remote images"));
		expect(screen.queryByText(/Remote images are blocked/u)).toBeNull();
		await user.click(screen.getByRole("button", { name: "Download HTML" }));
		expect(createObjectURL).toHaveBeenCalledTimes(1);
	});
});
