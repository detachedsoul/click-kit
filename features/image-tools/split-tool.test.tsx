import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SplitTool } from "@/features/image-tools/split-tool";

beforeEach(() => {
	Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test"), writable: true });
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn(), writable: true });
});

afterEach(cleanup);

describe("image splitter page", () => {
	it("defaults to a 3 × 3 grid and hides the tile panel until an image loads", () => {
		render(<SplitTool />);
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "3");
		expect(screen.getByLabelText("Rows")).toHaveProperty("value", "3");
		expect(screen.getByLabelText("Grid preset")).toHaveProperty("value", "thirds");
		expect(screen.getByRole("button", { name: "Split image" })).toHaveProperty("disabled", true);
		expect(screen.queryByText("Tiles")).toBeNull();
	});

	it("follows a preset", async () => {
		const user = userEvent.setup();
		render(<SplitTool />);
		await user.selectOptions(screen.getByLabelText("Grid preset"), "carousel");
		expect(screen.getByLabelText("Columns")).toHaveProperty("value", "3");
		expect(screen.getByLabelText("Rows")).toHaveProperty("value", "1");
		expect(document.body.textContent).toContain("Leftover");
	});
});
