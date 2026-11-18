import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SemverTool } from "@/features/developer-tools/semver-tool";
import { bumpVersion, checkRange, compareVersions, sortVersions } from "@/features/developer-tools/semver-utils";

afterEach(cleanup);

describe("semantic version helper", () => {
	it("compares versions with semver precedence", () => {
		expect(compareVersions("1.4.2", "1.5.0")).toMatchObject({ relation: "older than", difference: "minor" });
		expect(compareVersions("2.0.0", "2.0.0")).toMatchObject({ relation: "equal to", difference: "none" });
		expect(compareVersions("2.0.0", "1.9.9")).toMatchObject({ relation: "newer than", majorAhead: true });
		expect(compareVersions("1.0.0-alpha", "1.0.0")).toMatchObject({ relation: "older than" });
	});

	it("checks ranges, normalizes them, and reports the minimum version", () => {
		expect(checkRange("1.4.9", "^1.4.0")).toMatchObject({ satisfies: true, normalizedRange: ">=1.4.0 <2.0.0-0", minimum: "1.4.0" });
		expect(checkRange("2.0.0", "^1.4.0").satisfies).toBe(false);
		expect(checkRange("1.5.0", "1.2 - 1.6").satisfies).toBe(true);
		expect(checkRange("3.1.0", ">=2 <3").satisfies).toBe(false);
	});

	it("bumps versions for every release type", () => {
		expect(bumpVersion("1.4.2", "major").next).toBe("2.0.0");
		expect(bumpVersion("1.4.2", "minor").next).toBe("1.5.0");
		expect(bumpVersion("1.4.2", "patch").next).toBe("1.4.3");
		expect(bumpVersion("1.4.2", "preminor").next).toBe("1.5.0-0");
		expect(bumpVersion("1.4.2-alpha.1", "prerelease").next).toBe("1.4.2-alpha.2");
	});

	it("sorts version lists and separates invalid entries", () => {
		const result = sortVersions("1.10.0\n1.2.3\n2.0.0-beta.1\n1.2.3-alpha\nnope");
		expect(result.ascending.split("\n")).toEqual(["1.2.3-alpha", "1.2.3", "1.10.0", "2.0.0-beta.1"]);
		expect(result.descending.split("\n")[0]).toBe("2.0.0-beta.1");
		expect(result.latest).toBe("2.0.0-beta.1");
		expect(result.invalid).toEqual(["nope"]);
	});

	it("rejects invalid versions, ranges, and empty lists", () => {
		expect(() => compareVersions("one", "1.0.0")).toThrow(/not a valid semantic version/u);
		expect(() => compareVersions("1.0.0", "")).toThrow(/Enter a second version/u);
		expect(() => checkRange("1.0.0", "not a range ^")).toThrow(/not a valid semver range/u);
		expect(() => sortVersions(" , ")).toThrow(/at least one version/u);
		expect(() => bumpVersion(`${"1".repeat(101)}.0.0`, "major")).toThrow(/under 100 characters/u);
	});

	it("renders each mode and updates results", async () => {
		const user = userEvent.setup();
		render(<SemverTool />);
		expect(screen.getByText("1.4.2 is older than 1.5.0")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Range check" }));
		fireEvent.change(screen.getByLabelText("Version"), { target: { value: "2.0.0" } });
		expect(screen.getByText("No")).toBeTruthy();
		await user.click(screen.getByRole("button", { name: "Bump" }));
		fireEvent.change(screen.getByLabelText("First version"), { target: { value: "1.4.2" } });
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("1.5.0");
		await user.click(screen.getByRole("button", { name: "Sort list" }));
		expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toContain("1.2.3-alpha");
	});

	it("shows errors for invalid input", () => {
		render(<SemverTool />);
		fireEvent.change(screen.getByLabelText("First version"), { target: { value: "bad" } });
		expect(screen.getByRole("alert").textContent).toContain("not a valid semantic version");
	});
});
