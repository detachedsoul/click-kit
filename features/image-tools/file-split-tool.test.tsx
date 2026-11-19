import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { FileSplitTool } from "@/features/image-tools/file-split-tool";

afterEach(cleanup);

describe("file splitter page", () => {
	it("defaults to splitting at 5 MB", () => {
		render(<FileSplitTool />);
		expect(screen.getByRole("button", { name: "Split" })).toHaveProperty("ariaPressed", "true");
		expect(screen.getByLabelText("Part size")).toHaveProperty("value", String(5 * 1024 * 1024));
		expect(screen.getByRole("button", { name: "Split file" })).toHaveProperty("disabled", true);
	});

	it("plans parts for a chosen file", async () => {
		const user = userEvent.setup();
		render(<FileSplitTool />);
		const file = new File([new Uint8Array(12 * 1024 * 1024)], "backup.zip", { type: "application/zip" });
		await user.upload(screen.getByLabelText("File to split"), file);
		expect(document.body.textContent).toContain("3 parts");
		expect(document.body.textContent).toContain("2.00 MB");
		expect(screen.getByRole("button", { name: "Split file" })).toHaveProperty("disabled", false);
	});

	it("switches to joining and names the output", async () => {
		const user = userEvent.setup();
		render(<FileSplitTool />);
		await user.click(screen.getByRole("button", { name: "Join" }));
		await user.upload(screen.getByLabelText("Parts to join"), [
			new File([new Uint8Array([3])], "clip.mp4.part03of03", { type: "application/octet-stream" }),
			new File([new Uint8Array([1])], "clip.mp4.part01of03", { type: "application/octet-stream" }),
		]);
		expect(document.body.textContent).toContain("clip.mp4");
		expect(document.body.textContent).toContain("Missing parts");
		expect(screen.getByRole("button", { name: "Join parts" })).toHaveProperty("disabled", false);
	});
});
