import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegexExplainerTool } from "@/features/developer-tools/regex-explainer-tool";

afterEach(() => cleanup());

describe("Regex Visual Explainer", () => {
	it("shows a parsed expression, token explanations, a tree, and common mistake notes", () => {
		render(<RegexExplainerTool />);
		expect(screen.getByLabelText("Parsed expression").textContent).toContain("tokens");
		expect(screen.getByLabelText("Token explanations").textContent).toContain("Matches");
		expect(screen.getByLabelText("Expression tree").textContent).toContain("Sequence");
		expect(screen.getByLabelText("Common regex mistakes").textContent).toContain("capture text by default");
	});

	it("updates group and quantifier explanations and reports invalid syntax", () => {
		render(<RegexExplainerTool />);
		const pattern = screen.getByLabelText("Regular expression");
		fireEvent.change(pattern, { target: { value: "(ab)+" } });
		expect(screen.getByLabelText("Parsed expression").textContent).toContain("1 capture groups");
		expect(screen.getByLabelText("Token explanations").textContent).toContain("one or more times");
		fireEvent.change(pattern, { target: { value: "(abc" } });
		expect(screen.getByRole("alert").textContent).toContain("missing its closing parenthesis");
	});
});
