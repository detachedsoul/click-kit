import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SheetTool } from "@/features/image-tools/sheet-tool";

afterEach(cleanup);

describe("contact sheet page", () => {
	it("defaults to a three-column PNG sheet with captions", () => {
		render(<SheetTool />);
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "3");
		expect(screen.getByLabelText("Cell size (px)")).toHaveProperty("value", "240");
		expect(screen.getByLabelText("Caption every picture with its file name")).toHaveProperty("checked", true);
		expect(screen.getByRole("button", { name: "Build contact sheet" })).toHaveProperty("disabled", true);
	});

	it("reports the grid and sheet size once images are queued", async () => {
		const user = userEvent.setup();
		render(<SheetTool />);
		await user.upload(screen.getByLabelText("Images for the sheet"), [
			new File([new Uint8Array([1])], "one.png", { type: "image/png" }),
			new File([new Uint8Array([2])], "two.png", { type: "image/png" }),
			new File([new Uint8Array([3])], "three.png", { type: "image/png" }),
			new File([new Uint8Array([4])], "four.png", { type: "image/png" }),
		]);
		expect(document.body.textContent).toContain("3 × 2");
		// 3 columns of 240 px, two rows of 240 + 22 px captions, 12 px gaps, 24 px padding.
		expect(document.body.textContent).toContain("792 × 584 px");
		expect(screen.getByRole("button", { name: "Build contact sheet" })).toHaveProperty("disabled", false);
	});
});
