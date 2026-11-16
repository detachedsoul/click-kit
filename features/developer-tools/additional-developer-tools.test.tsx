import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	ColorConverterTool,
	JsonSchemaTool,
	UrlInspectorTool,
} from "@/features/developer-tools/additional-developer-tools";

afterEach(() => cleanup());

describe("additional Developer tools", () => {
	it("inspects repeated URL query parameters and validates protocols", () => {
		render(<UrlInspectorTool />);
		const query = screen.getByRole("table", { name: "Query parameters (3)" });
		expect(query.textContent).toContain("clickkit");
		expect(query.textContent).toContain("tools");
		fireEvent.change(screen.getByLabelText("Absolute URL"), { target: { value: "javascript:alert(1)" } });
		expect(screen.getByRole("alert").textContent).toContain("Only HTTP and HTTPS");
	});

	it("updates accessible color previews and CSS representations", () => {
		render(<ColorConverterTool />);
		fireEvent.change(screen.getByLabelText("Color value"), { target: { value: "hsl(120, 100%, 50%)" } });
		expect(screen.getByRole("img", { name: "Color preview #00ff00" })).toBeTruthy();
		expect(screen.getByText("rgb(0, 255, 0)")).toBeTruthy();
	});

	it("generates a schema and explains malformed JSON", async () => {
		const user = userEvent.setup();
		render(<JsonSchemaTool />);
		await user.click(screen.getByRole("button", { name: "Generate JSON Schema" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain(
			'"$schema": "https://json-schema.org/draft/2020-12/schema"',
		);
		fireEvent.change(screen.getByLabelText("JSON example"), { target: { value: "{bad" } });
		await user.click(screen.getByRole("button", { name: "Generate JSON Schema" }));
		expect(screen.getByRole("alert").textContent).toContain("Invalid JSON");
	});
});
