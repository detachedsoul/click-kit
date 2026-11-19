import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import DecisionMatrix from "@/features/productivity-tools/decision-matrix";

afterEach(cleanup);

const score = async (user: ReturnType<typeof userEvent.setup>, option: string, criterion: string, value: string) => {
	await user.selectOptions(screen.getByLabelText(`${option} score for ${criterion}`), value);
};

describe("decision matrix", () => {
	it("starts with three criteria and two options, unranked", () => {
		render(<DecisionMatrix />);
		expect(screen.getByLabelText("Criterion 1")).toHaveProperty("value", "Price");
		expect(screen.getByLabelText("Criterion 2")).toHaveProperty("value", "Quality");
		expect(screen.getByLabelText("Option A")).toHaveProperty("value", "Option A");
		expect(screen.getByText("Score each option to see a ranking.")).toBeTruthy();
		expect(screen.getByLabelText("Option B score for Delivery")).toHaveProperty("value", "0");
	});

	it("ranks options once they are scored", async () => {
		const user = userEvent.setup();
		render(<DecisionMatrix />);
		await score(user, "Option A", "Price", "5");
		await score(user, "Option A", "Quality", "4");
		await score(user, "Option A", "Delivery", "2");
		await score(user, "Option B", "Price", "2");
		await score(user, "Option B", "Quality", "5");
		await score(user, "Option B", "Delivery", "3");
		expect(screen.getByText("Option A comes out ahead at 83.3%.")).toBeTruthy();
		expect(document.body.textContent).toContain("83.3% · 25 of 30 points");
		expect(document.body.textContent).toContain("1. Option A");
	});

	it("says so when the top two are level", async () => {
		const user = userEvent.setup();
		render(<DecisionMatrix />);
		for (const criterion of ["Price", "Quality", "Delivery"]) {
			await score(user, "Option A", criterion, "4");
			await score(user, "Option B", criterion, "4");
		}
		expect(screen.getByText(/top two are level/u)).toBeTruthy();
		expect(document.body.textContent).toContain("Both options earn the same points");
	});

	it("adds and removes rows", async () => {
		const user = userEvent.setup();
		render(<DecisionMatrix />);
		await user.click(screen.getByRole("button", { name: "Add criterion" }));
		await user.click(screen.getByRole("button", { name: "Add option" }));
		expect(screen.getByLabelText("Criterion 4")).toHaveProperty("value", "Criterion 4");
		expect(screen.getByLabelText("Option C")).toHaveProperty("value", "Option C");
		await user.click(screen.getByRole("button", { name: "Remove Option C" }));
		expect(screen.queryByLabelText("Option C")).toBeNull();
		await user.clear(screen.getByLabelText("Criterion 4"));
		await user.type(screen.getByLabelText("Criterion 4"), "Support");
		await user.click(screen.getByRole("button", { name: "Remove Support" }));
		expect(screen.queryByLabelText("Criterion 4")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Remove Option B" }));
		expect(document.body.textContent).toContain("A decision needs at least two options");
	});
});
