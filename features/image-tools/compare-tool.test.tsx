import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CompareTool } from "@/features/image-tools/compare-tool";

afterEach(cleanup);

describe("comparison page", () => {
	it("starts with the divider in the middle and the export disabled", () => {
		render(<CompareTool />);
		expect(screen.getByLabelText("Before image")).toHaveProperty("type", "file");
		expect(screen.getByLabelText("After image")).toHaveProperty("type", "file");
		expect(screen.getByLabelText("Divider position (50%)")).toHaveProperty("value", "50");
		expect(screen.getByRole("button", { name: "Side by side" })).toHaveProperty("ariaPressed", "true");
		expect(screen.getByRole("button", { name: "Export comparison" })).toHaveProperty("disabled", true);
	});

	it("moves the divider and switches orientation", async () => {
		const user = userEvent.setup();
		render(<CompareTool />);
		fireEvent.change(screen.getByLabelText("Divider position (50%)"), { target: { value: "80" } });
		expect(screen.getByLabelText("Divider position (80%)")).toHaveProperty("value", "80");
		await user.click(screen.getByRole("button", { name: "Top to bottom" }));
		expect(screen.getByRole("button", { name: "Top to bottom" })).toHaveProperty("ariaPressed", "true");
	});
});
