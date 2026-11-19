import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { BatchTool } from "@/features/image-tools/batch-tool";

afterEach(cleanup);

describe("batch converter page", () => {
	it("defaults to WebP at 1600 px and disables converting until files are added", () => {
		render(<BatchTool />);
		expect(screen.getByLabelText("Convert to")).toHaveProperty("value", "image/webp");
		expect(screen.getByLabelText("Maximum width (px)")).toHaveProperty("value", "1600");
		expect(screen.getByLabelText("Quality (80%)")).toHaveProperty("value", "80");
		expect(screen.getByRole("button", { name: "Convert images" })).toHaveProperty("disabled", true);
	});

	it("queues picked images and updates the button", async () => {
		const user = userEvent.setup();
		render(<BatchTool />);
		await user.upload(screen.getByLabelText("Images to convert"), [
			new File([new Uint8Array([1, 2, 3])], "one.png", { type: "image/png" }),
			new File([new Uint8Array([4, 5])], "two.png", { type: "image/png" }),
		]);
		expect(document.body.textContent).toContain("Queued");
		expect(screen.getByRole("button", { name: "Convert 2 images" })).toHaveProperty("disabled", false);
	});
});
