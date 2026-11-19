import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EyedropperTool } from "@/features/image-tools/eyedropper-tool";

afterEach(cleanup);

describe("image colour picker page", () => {
	it("starts with the copy controls and no swatches", () => {
		render(<EyedropperTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(screen.getByRole("button", { name: "Hex" })).toHaveProperty("ariaPressed", "true");
		expect(screen.queryByText(/Saved swatches/u)).toBeNull();
		expect(document.body.textContent).toContain("Click anywhere on the image");
	});
});
