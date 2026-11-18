import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { envToTarget, parseEnvFile, structuredToEnv } from "@/features/developer-tools/env-convert-utils";
import { EnvConvertTool } from "@/features/developer-tools/env-convert-tool";

afterEach(cleanup);

describe(".env converter", () => {
	it("parses quoting, exports, escapes, and comments", () => {
		const parsed = parseEnvFile(`# comment
A=plain
export B="two words"
C='single $HOME'
D="line\\nbreak"
E=value # trailing comment
F=`);
		expect(parsed.entries.map((entry) => [entry.key, entry.value])).toEqual([
			["A", "plain"],
			["B", "two words"],
			["C", "single $HOME"],
			["D", "line\nbreak"],
			["E", "value"],
			["F", ""],
		]);
		expect(parsed.warnings).toEqual([]);
	});

	it("handles multi-line values and duplicate or malformed lines", () => {
		const parsed = parseEnvFile('KEY="first\nsecond"\nDUP=1\nDUP=2\nBROKEN LINE\n9BAD=x');
		expect(parsed.entries[0].value).toBe("first\nsecond");
		expect(parsed.entries.filter((entry) => entry.key === "DUP")).toHaveLength(2);
		const warnings = parsed.warnings.map((warning) => warning.message).join(" | ");
		expect(warnings).toContain("DUP is defined more than once");
		expect(warnings).toContain('Skipped "BROKEN LINE": no = found.');
		expect(warnings).toContain('"9BAD" is not a valid variable name');
		expect(() => parseEnvFile('KEY="unclosed\nstill')).toThrow(/Unterminated/u);
		expect(() => parseEnvFile("   ")).toThrow(/Paste a .env file/u);
		expect(() => parseEnvFile("# only comments")).toThrow(/No KEY=value/u);
	});

	it("converts to JSON, YAML, compose, and shell", () => {
		const env = "NAME=app\nPORT=3000\nDB__HOST=db\nDB__PORT=5432";
		expect(JSON.parse(envToTarget(env, "json", { nested: true, separator: "__" }).text)).toEqual({ NAME: "app", PORT: "3000", DB: { HOST: "db", PORT: "5432" } });
		expect(JSON.parse(envToTarget(env, "json", { nested: false, separator: "__" }).text)).toEqual({ NAME: "app", PORT: "3000", DB__HOST: "db", DB__PORT: "5432" });
		expect(envToTarget(env, "yaml", { nested: true, separator: "__" }).text).toContain("DB:\n  HOST: db");
		const compose = envToTarget('NAME=app\nMOTTO="hello world"', "compose", { nested: false, separator: "__" }).text;
		expect(compose).toBe('services:\n  app:\n    environment:\n      NAME: app\n      MOTTO: "hello world"');
		const shell = envToTarget("NAME=app\nMOTTO=it's fine", "shell", { nested: false, separator: "__" }).text;
		expect(shell).toBe("export NAME=app\nexport MOTTO='it'\\''s fine'");
	});

	it("flattens JSON and YAML back into .env lines", () => {
		const json = structuredToEnv('{"app":{"port":3000},"debug":false,"tags":["a","b"],"empty":null}', { format: "json", separator: "__", comments: false, sort: false });
		expect(json.text).toBe("APP__PORT=3000\nDEBUG=false\nTAGS__0=a\nTAGS__1=b\nEMPTY=");
		expect(json.count).toBe(5);
		const yaml = structuredToEnv("app:\n  name: click kit\ndebug: true", { format: "yaml", separator: "__", comments: true, sort: true });
		expect(yaml.text).toContain('## app\nAPP__NAME="click kit"');
		expect(() => structuredToEnv("[1,2]", { format: "json", separator: "__", comments: false, sort: false })).toThrow(/top level/u);
		expect(() => structuredToEnv("{}", { format: "json", separator: "__", comments: false, sort: false })).toThrow(/empty/u);
	});

	it("round-trips nested keys", () => {
		const env = "DB__HOST=db\nDB__POOL__MIN=2";
		const json = envToTarget(env, "json", { nested: true, separator: "__" }).text;
		expect(structuredToEnv(json, { format: "json", separator: "__", comments: false, sort: false }).text).toBe(env);
	});

	it("renders conversions and switches direction", async () => {
		const user = userEvent.setup();
		render(<EnvConvertTool />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(JSON.parse(output())).toMatchObject({ DATABASE: { HOST: "db.internal", PORT: "5432" } });
		await user.selectOptions(screen.getByLabelText("Output format"), "compose");
		expect(output()).toContain("    environment:");
		await user.selectOptions(screen.getByLabelText("Conversion"), "structured-to-env");
		expect(output()).toContain("APP__PORT=3000");
		fireEvent.change(screen.getByLabelText("JSON object"), { target: { value: "{oops" } });
		expect(screen.queryAllByLabelText("Result")).toHaveLength(0);
	});
});
