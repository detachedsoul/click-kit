import userEvent from "@testing-library/user-event";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	ColorContrastTool,
	CronExplainerTool,
	EnvValidatorTool,
	JsonDiffTool,
	YamlJsonTool,
} from "@/features/developer-tools/extra-tools-components";

afterEach(() => cleanup());

describe("additional utility tools", () => {
	it("shows structural JSON differences reactively", () => {
		render(<JsonDiffTool />);
		expect(screen.getByText(/3 differences found/u).textContent).toContain("difference");
		const differences = JSON.parse((screen.getByLabelText("Result") as HTMLTextAreaElement).value) as Array<{
			path: string;
		}>;
		expect(differences.map(({ path }) => path)).toContain('$["version"]');
		fireEvent.change(screen.getByLabelText("Updated JSON"), {
			target: { value: '{"name":"ClickKit","version":1,"tags":["tools"]}' },
		});
		expect(screen.getByText("The JSON values are structurally identical.")).toBeTruthy();
	});

	it("converts YAML to JSON and switches to JSON-to-YAML mode", async () => {
		const user = userEvent.setup();
		render(<YamlJsonTool />);
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain('"name": "ClickKit"');
		await user.click(screen.getByRole("button", { name: "JSON to YAML" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("name: ClickKit");
		fireEvent.change(screen.getByLabelText("JSON input"), { target: { value: "{bad" } });
		expect(screen.getByRole("alert").textContent).toContain("JSON is invalid");
	});

	it("explains a cron schedule and validates time zones", () => {
		render(<CronExplainerTool />);
		expect(screen.getByRole("heading", { name: "Next five runs" })).toBeTruthy();
		expect(screen.getByText(/every 15 minutes/u)).toBeTruthy();
		fireEvent.change(screen.getByLabelText("IANA time zone"), { target: { value: "Mars/Olympus" } });
		expect(screen.getByRole("alert").textContent).toContain("valid IANA time zone");
	});

	it("masks .env values by default and flags duplicate keys", async () => {
		const user = userEvent.setup();
		render(<EnvValidatorTool />);
		const output = screen.getByLabelText("Result") as HTMLTextAreaElement;
		expect(output.value).toContain("API_TOKEN=••••••");
		expect(output.value).not.toContain("replace-me");
		fireEvent.change(screen.getByLabelText(".env contents"), {
			target: { value: "TOKEN=one\nTOKEN=two\nbad line" },
		});
		expect(screen.getByText(/duplicate keys: TOKEN/u)).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("Line 3");
		await user.click(screen.getByLabelText("Mask values in results"));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("TOKEN=one");
	});

	it("reports WCAG contrast levels and updates when colors change", () => {
		render(<ColorContrastTool />);
		expect(screen.getByText(/17\.40:1 contrast ratio/u)).toBeTruthy();
		fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#777777" } });
		const results = screen.getByLabelText("WCAG contrast results");
		expect(results.textContent).toContain("AA normal textFail");
	});
});
