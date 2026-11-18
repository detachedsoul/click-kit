import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckboxField, CheckboxInput } from "@/features/developer-tools/tool-ui";

afterEach(cleanup);

const Harness = ({ disabled = false, hint }: { disabled?: boolean; hint?: string }) => {
	const [checked, setChecked] = useState(false);
	return (
		<>
			<CheckboxField checked={checked} disabled={disabled} hint={hint} id="example" label="Count the end date" onChange={setChecked} />
			<p data-testid="state">{checked ? "on" : "off"}</p>
		</>
	);
};

describe("shared checkbox", () => {
	it("uses the one shared class for its box and focus ring", () => {
		render(<Harness />);
		const box = screen.getByLabelText("Count the end date");
		expect(box.className).toContain("checkbox-input");
		expect(box).toHaveProperty("type", "checkbox");
	});

	it("toggles from the box and from its label", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const box = screen.getByLabelText("Count the end date");
		await user.click(box);
		expect(screen.getByTestId("state").textContent).toBe("on");
		await user.click(screen.getByText("Count the end date"));
		expect(screen.getByTestId("state").textContent).toBe("off");
	});

	it("keeps keyboard toggling and the focus ring", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		await user.tab();
		const box = screen.getByLabelText("Count the end date");
		expect(document.activeElement).toBe(box);
		await user.keyboard(" ");
		expect(screen.getByTestId("state").textContent).toBe("on");
	});

	it("links hints and honours the disabled state", () => {
		render(<Harness disabled hint="Ends on the last day are counted too." />);
		const box = screen.getByLabelText("Count the end date");
		expect((box as HTMLInputElement).disabled).toBe(true);
		expect(box.getAttribute("aria-describedby")).toBe("example-hint");
		expect(screen.getByText("Ends on the last day are counted too.").id).toBe("example-hint");
	});

	it("renders a labelled box for tables", () => {
		let next = false;
		render(<CheckboxInput checked={false} label="Select row 3" onChange={(value) => (next = value)} />);
		const box = screen.getByLabelText("Select row 3");
		expect(box.className).toContain("checkbox-input");
		fireEvent.click(box);
		expect(next).toBe(true);
	});
});
