import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ShadowTool } from "@/features/developer-tools/shadow-tool";

afterEach(cleanup);

describe("box shadow generator", () => {
	it("starts from a preset and shows the CSS", () => {
		render(<ShadowTool />);
		expect(screen.getByLabelText("Horizontal offset (0px)")).toHaveProperty("value", "0");
		expect(screen.getByLabelText("Vertical offset (8px)")).toHaveProperty("value", "8");
		expect(document.body.textContent).toContain("box-shadow: 0px 8px 24px -6px rgba(37, 40, 32, 0.12)");
		expect(document.body.textContent).toContain("shadow-[0px_8px_24px_-6px_rgba(37,40,32,0.12)]");
	});

	it("moves the shadow when a slider changes", () => {
		render(<ShadowTool />);
		fireEvent.change(screen.getByLabelText("Horizontal offset (0px)"), { target: { value: "24" } });
		expect(screen.getByLabelText("Horizontal offset (24px)")).toHaveProperty("value", "24");
		expect(document.body.textContent).toContain("24px 8px 24px -6px");
	});

	it("adds, removes, and switches layers and presets", async () => {
		const user = userEvent.setup();
		render(<ShadowTool />);
		await user.click(screen.getByRole("button", { name: "Add another layer" }));
		expect(document.body.textContent).toContain("Layer 2");
		await user.click(screen.getByRole("button", { name: "Remove layer 2" }));
		expect(document.body.textContent).not.toContain("Layer 2");
		await user.click(screen.getByRole("button", { name: "Pressed in" }));
		expect(document.body.textContent).toContain("inset 0px 2px 6px 0px");
	});

	it("renames the CSS selector", async () => {
		const user = userEvent.setup();
		render(<ShadowTool />);
		const selector = screen.getByLabelText("CSS selector");
		await user.clear(selector);
		await user.type(selector, ".panel");
		expect(document.body.textContent).toContain(".panel {");
	});
});
