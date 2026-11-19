import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RedactTool } from "@/features/image-tools/redact-tool";

afterEach(cleanup);

describe("image redactor page", () => {
	it("starts empty with the drawing area hidden until an image is picked", () => {
		render(<RedactTool />);
		expect(screen.getByLabelText("Image file")).toHaveProperty("type", "file");
		expect(screen.queryByRole("application")).toBeNull();
		expect(screen.queryByRole("button", { name: "Redact and download" })).toBeNull();
	});

	it("explains each redaction mode", () => {
		render(<RedactTool />);
		expect(document.body.textContent).toContain("Export re-encodes the pixels");
	});
});
