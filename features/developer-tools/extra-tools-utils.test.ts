import { describe, expect, it } from "vitest";
import {
	calculateContrast,
	compareJson,
	jsonToYaml,
	parseEnvFile,
	previewCronSchedule,
	yamlToJson,
} from "@/features/developer-tools/extra-tools-utils";

describe("structured JSON comparison", () => {
	it("compares parsed nested values and ignores object key order", () => {
		expect(
			compareJson(
				'{"name":"Ada","profile":{"active":true},"items":[1]}',
				'{"items":[1,2],"profile":{"active":false,"score":3},"name":"Ada"}',
			),
		).toEqual([
			{ path: '$["items"][1]', kind: "added", after: 2 },
			{ path: '$["profile"]["active"]', kind: "changed", before: true, after: false },
			{ path: '$["profile"]["score"]', kind: "added", after: 3 },
		]);
	});

	it("reports removed values and root type changes", () => {
		expect(compareJson('{"old":null}', "{}")).toEqual([{ path: '$["old"]', kind: "removed", before: null }]);
		expect(compareJson("[1,2]", "null")).toEqual([{ path: "$", kind: "changed", before: [1, 2], after: null }]);
		expect(compareJson('{"x":1}', '{ "x" : 1 }')).toEqual([]);
	});

	it("validates both inputs and enforces source and recursion limits", () => {
		expect(() => compareJson("", "{}")).toThrow(/both sides/u);
		expect(() => compareJson("{bad", "{}")).toThrow(/Left JSON is invalid/u);
		expect(() => compareJson("{}", "{bad")).toThrow(/Right JSON is invalid/u);
		expect(() => compareJson(`"${"x".repeat(1_000_001)}"`, "{}")).toThrow(/one million/u);
		const deeplyNested = (depth: number) => {
			let source = "0";
			for (let index = 0; index < depth; index += 1) source = `{"child":${source}}`;
			return source;
		};
		expect(() => compareJson(deeplyNested(102), deeplyNested(102))).toThrow(/100-level/u);
		expect(() => compareJson(JSON.stringify(Array(1_001).fill(0)), JSON.stringify(Array(1_001).fill(1)))).toThrow(
			/over 1,000 differences/u,
		);
	});
});

describe("YAML and JSON conversion", () => {
	it("converts JSON-compatible YAML into readable JSON", () => {
		expect(JSON.parse(yamlToJson("name: Ada\nactive: true\nitems:\n  - 1\n  - two"))).toEqual({
			name: "Ada",
			active: true,
			items: [1, "two"],
		});
	});

	it("converts JSON to YAML and round-trips nested values", () => {
		const source = '{"name":"Ada","items":[1,true,null],"profile":{"active":true}}';
		expect(JSON.parse(yamlToJson(jsonToYaml(source)))).toEqual(JSON.parse(source));
	});

	it("rejects malformed, duplicate-key, empty, and non-JSON YAML values", () => {
		expect(() => yamlToJson(" ")).toThrow(/Paste YAML/u);
		expect(() => yamlToJson("name: [unfinished")).toThrow(/Invalid YAML/u);
		expect(() => yamlToJson("name: first\nname: second")).toThrow(/Invalid YAML/u);
		expect(() => yamlToJson("value: .inf")).toThrow(/finite JSON numbers/u);
		expect(() => yamlToJson("loop: &loop [*loop]")).toThrow(/circular/u);
		expect(() => jsonToYaml("{bad")).toThrow(/Input JSON is invalid/u);
	});
});

describe("cron expression explainer", () => {
	it("previews predictable five-field schedules in UTC", () => {
		const result = previewCronSchedule("0 9 * * 1-5", "UTC", new Date("2025-01-01T00:00:00.000Z"));
		expect(result.expression).toBe("0 9 * * 1-5");
		expect(result.description).toContain("minute: 0");
		expect(result.nextRuns).toEqual([
			"2025-01-01T09:00:00.000Z",
			"2025-01-02T09:00:00.000Z",
			"2025-01-03T09:00:00.000Z",
			"2025-01-06T09:00:00.000Z",
			"2025-01-07T09:00:00.000Z",
		]);
	});

	it("supports seconds and IANA time zones", () => {
		expect(previewCronSchedule("*/10 * * * * *", "UTC", new Date("2025-01-01T00:00:00.000Z")).nextRuns[0]).toBe(
			"2025-01-01T00:00:10.000Z",
		);
		expect(previewCronSchedule("0 9 * * *", "Africa/Lagos", new Date("2025-01-01T00:00:00.000Z")).nextRuns[0]).toBe(
			"2025-01-01T08:00:00.000Z",
		);
	});

	it("rejects malformed expressions and invalid zones while supporting both day fields", () => {
		expect(() => previewCronSchedule(" ")).toThrow(/Enter a cron/u);
		expect(() => previewCronSchedule("* * *")).toThrow(/five-field/u);
		expect(() => previewCronSchedule("61 * * * *")).toThrow(/Invalid cron/u);
		expect(previewCronSchedule("0 0 1 * 1", "UTC", new Date("2025-01-01T00:00:00.000Z")).nextRuns).toHaveLength(5);
		expect(() => previewCronSchedule("0 0 32 * *")).toThrow(/Invalid cron/u);
		expect(() => previewCronSchedule("0 0 * * *", "Mars/Olympus")).toThrow(/IANA time zone/u);
	});
});

describe(".env parser and validator", () => {
	it("parses exports, quoted and unquoted values, comments, and keeps interpolation literal", () => {
		const result = parseEnvFile(
			'# local config\nAPP=ClickKit\nexport DEBUG=true\nTOKEN="a # b" # note\nMULTILINE="line\\nnext"\nURL=https://example.com/a#fragment\nEMPTY=\nLITERAL=${HOME}',
		);
		expect(result.variables.map(({ name, value }) => [name, value])).toEqual([
			["APP", "ClickKit"],
			["DEBUG", "true"],
			["TOKEN", "a # b"],
			["MULTILINE", "line\nnext"],
			["URL", "https://example.com/a#fragment"],
			["EMPTY", ""],
			["LITERAL", "${HOME}"],
		]);
		expect(result.errors).toEqual([]);
	});

	it("reports malformed lines and duplicate keys without stopping the parse", () => {
		const result = parseEnvFile('A=one\nnot an assignment\nA=two\nBROKEN="unterminated\nGOOD=ok');
		expect(result.variables.map(({ name }) => name)).toEqual(["A", "A", "GOOD"]);
		expect(result.errors).toEqual([
			{ line: 2, message: "Expected KEY=value with a valid environment-variable name." },
			{ line: 4, message: "Quoted value is missing its closing quote." },
		]);
		expect(result.duplicates).toEqual(["A"]);
		expect(() => parseEnvFile(" ")).toThrow(/Paste .env/u);
	});
});

describe("WCAG color contrast calculator", () => {
	it("calculates standard contrast ratios and WCAG thresholds", () => {
		expect(calculateContrast("#000000", "#ffffff")).toMatchObject({
			ratio: 21,
			aaNormal: true,
			aaLarge: true,
			aaaNormal: true,
			aaaLarge: true,
		});
		const mediumGray = calculateContrast("#767676", "#ffffff");
		expect(mediumGray.ratio).toBeGreaterThan(4.5);
		expect(mediumGray.aaNormal).toBe(true);
		expect(mediumGray.aaaNormal).toBe(false);
		expect(calculateContrast("#777777", "#ffffff").aaNormal).toBe(false);
	});

	it("composites transparency against a white canvas and rejects unsupported colors", () => {
		const result = calculateContrast("rgba(0, 0, 0, 50%)", "#ffffff");
		expect(result.ratio).toBeGreaterThan(3.9);
		expect(result.ratio).toBeLessThan(4.1);
		expect(() => calculateContrast("not-a-color", "#fff")).toThrow(/Enter a HEX/u);
	});
});
