import { CronExpressionParser } from "cron-parser";
import { parseDocument, stringify } from "yaml";
import { readColorChannels } from "@/features/developer-tools/additional-developer-utils";

const maximumSourceLength = 1_000_000;
const maximumDifferences = 1_000;

export type JsonDifference = {
	path: string;
	kind: "added" | "removed" | "changed";
	before?: unknown;
	after?: unknown;
};

const parseJsonSide = (source: string, label: string): unknown => {
	if (source.length > maximumSourceLength) throw new Error(`${label} JSON must be under one million characters.`);
	try {
		return JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error ? `${label} JSON is invalid: ${error.message}` : `${label} JSON is invalid.`,
		);
	}
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

export const compareJson = (leftSource: string, rightSource: string): JsonDifference[] => {
	if (!leftSource.trim() || !rightSource.trim()) throw new Error("Paste JSON in both sides to compare them.");
	const left = parseJsonSide(leftSource, "Left");
	const right = parseJsonSide(rightSource, "Right");
	const differences: JsonDifference[] = [];
	const compare = (before: unknown, after: unknown, path: string, depth: number) => {
		if (Object.is(before, after)) return;
		if (depth > 100) throw new Error("JSON nesting exceeds the 100-level comparison limit.");
		if (Array.isArray(before) && Array.isArray(after)) {
			const length = Math.max(before.length, after.length);
			for (let index = 0; index < length; index += 1) {
				const itemPath = `${path}[${index}]`;
				if (index >= before.length) differences.push({ path: itemPath, kind: "added", after: after[index] });
				else if (index >= after.length)
					differences.push({ path: itemPath, kind: "removed", before: before[index] });
				else compare(before[index], after[index], itemPath, depth + 1);
				if (differences.length > maximumDifferences) {
					throw new Error("There are over 1,000 differences. Compare a smaller JSON sample.");
				}
			}
			return;
		}
		if (isObjectRecord(before) && isObjectRecord(after)) {
			const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
			for (const key of keys) {
				const itemPath = `${path}[${JSON.stringify(key)}]`;
				if (!Object.hasOwn(before, key)) differences.push({ path: itemPath, kind: "added", after: after[key] });
				else if (!Object.hasOwn(after, key))
					differences.push({ path: itemPath, kind: "removed", before: before[key] });
				else compare(before[key], after[key], itemPath, depth + 1);
				if (differences.length > maximumDifferences) {
					throw new Error("There are over 1,000 differences. Compare a smaller JSON sample.");
				}
			}
			return;
		}
		differences.push({ path, kind: "changed", before, after });
	};
	compare(left, right, "$", 0);
	return differences;
};

const assertJsonValue = (value: unknown, seen = new WeakSet<object>(), depth = 0): void => {
	if (depth > 100) throw new Error("YAML nesting exceeds the 100-level JSON conversion limit.");
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("YAML values must be finite JSON numbers.");
		return;
	}
	if (Array.isArray(value)) {
		if (seen.has(value)) throw new Error("YAML aliases create a circular value, which JSON cannot represent.");
		seen.add(value);
		value.forEach((item) => assertJsonValue(item, seen, depth + 1));
		seen.delete(value);
		return;
	}
	if (isObjectRecord(value)) {
		if (seen.has(value)) throw new Error("YAML aliases create a circular value, which JSON cannot represent.");
		seen.add(value);
		Object.values(value).forEach((item) => assertJsonValue(item, seen, depth + 1));
		seen.delete(value);
		return;
	}
	throw new Error(
		"This YAML value is not representable as JSON. Use only maps, lists, strings, numbers, booleans, and null.",
	);
};

export const yamlToJson = (source: string) => {
	if (!source.trim()) throw new Error("Paste YAML to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep YAML under one million characters.");
	let document: ReturnType<typeof parseDocument>;
	try {
		document = parseDocument(source, { uniqueKeys: true, schema: "core" });
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid YAML: ${error.message}` : "Invalid YAML.");
	}
	if (document.errors.length > 0) {
		throw new Error(`Invalid YAML: ${document.errors[0].message}`);
	}
	let value: unknown;
	try {
		value = document.toJS({ maxAliasCount: 100 }) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error ? `Could not resolve YAML: ${error.message}` : "Could not resolve this YAML.",
		);
	}
	assertJsonValue(value);
	const output = JSON.stringify(value, null, 2);
	if (output === undefined) throw new Error("Could not serialize this YAML value as JSON.");
	return output;
};

export const jsonToYaml = (source: string) => {
	const value = parseJsonSide(source, "Input");
	assertJsonValue(value);
	return stringify(value, { lineWidth: 0 });
};

const cronFieldLabels = ["second", "minute", "hour", "day of month", "month", "day of week"] as const;

const describeCron = (expression: string, hasSeconds: boolean) => {
	const fields = expression.trim().split(/\s+/u);
	const normalizedFields = hasSeconds ? fields : ["0", ...fields];
	return normalizedFields
		.map((field, index) => {
			const label = cronFieldLabels[index];
			if (field === "*") return `every ${label}`;
			const step = field.match(/^\*\/(\d+)$/u);
			if (step) return `every ${step[1]} ${label}${step[1] === "1" ? "" : "s"}`;
			return `${label}: ${field}`;
		})
		.join(" · ");
};

export const previewCronSchedule = (expression: string, timezone = "UTC", from: Date = new Date()) => {
	const source = expression.trim();
	if (!source) throw new Error("Enter a cron expression to preview.");
	if (source.length > 256) throw new Error("Keep cron expressions under 256 characters.");
	const fields = source.split(/\s+/u);
	if (fields.length !== 5 && fields.length !== 6) {
		throw new Error(
			"Use a five-field cron expression (minute hour day month weekday) or six fields including seconds.",
		);
	}
	if (!Number.isFinite(from.getTime())) throw new Error("Choose a valid starting time.");
	try {
		new Intl.DateTimeFormat("en", { timeZone: timezone });
	} catch {
		throw new Error("Enter a valid IANA time zone, such as UTC or Africa/Lagos.");
	}
	try {
		const normalizedSource = fields.length === 5 ? `0 ${source}` : source;
		const schedule = CronExpressionParser.parse(normalizedSource, {
			currentDate: from,
			tz: timezone,
		});
		return {
			expression: schedule.stringify(fields.length === 6),
			description: describeCron(source, fields.length === 6),
			nextRuns: schedule.take(5).map((date) => date.toDate().toISOString()),
		};
	} catch (error) {
		throw new Error(
			error instanceof Error ? `Invalid cron expression: ${error.message}` : "Invalid cron expression.",
		);
	}
};

export type EnvVariable = { name: string; value: string; line: number };
export type EnvParseResult = {
	variables: EnvVariable[];
	errors: { line: number; message: string }[];
	duplicates: string[];
};

const parseEnvValue = (rawValue: string): string => {
	const trimmed = rawValue.trim();
	if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
		const comment = trimmed.search(/\s+#/u);
		return (comment < 0 ? trimmed : trimmed.slice(0, comment)).trimEnd();
	}
	const quote = trimmed[0];
	let closingIndex = -1;
	let escaped = false;
	for (let index = 1; index < trimmed.length; index += 1) {
		if (escaped) {
			escaped = false;
			continue;
		}
		if (trimmed[index] === "\\") {
			escaped = true;
			continue;
		}
		if (trimmed[index] === quote) {
			closingIndex = index;
			break;
		}
	}
	if (closingIndex < 0) throw new Error("Quoted value is missing its closing quote.");
	const trailing = trimmed.slice(closingIndex + 1).trim();
	if (trailing && !trailing.startsWith("#")) throw new Error("Unexpected text after the closing quote.");
	const contents = trimmed.slice(1, closingIndex);
	if (quote === "'") return contents.replace(/\\'/gu, "'");
	return contents.replace(/\\([\\"nrt$])/gu, (_match, character: string) => {
		if (character === "n") return "\n";
		if (character === "r") return "\r";
		if (character === "t") return "\t";
		return character;
	});
};

export const parseEnvFile = (source: string): EnvParseResult => {
	if (!source.trim()) throw new Error("Paste .env contents to inspect first.");
	if (source.length > maximumSourceLength) throw new Error("Keep .env contents under one million characters.");
	const variables: EnvVariable[] = [];
	const errors: EnvParseResult["errors"] = [];
	const duplicateNames = new Set<string>();
	const seen = new Set<string>();
	for (const [index, lineText] of source.split(/\r?\n/u).entries()) {
		const line = lineText.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z\d_]*)\s*=\s*(.*)$/u);
		if (!match) {
			errors.push({ line: index + 1, message: "Expected KEY=value with a valid environment-variable name." });
			continue;
		}
		const [, name, rawValue] = match;
		try {
			const value = parseEnvValue(rawValue);
			if (seen.has(name)) duplicateNames.add(name);
			seen.add(name);
			variables.push({ name, value, line: index + 1 });
		} catch (error) {
			errors.push({
				line: index + 1,
				message: error instanceof Error ? error.message : "Could not parse this value.",
			});
		}
	}
	return { variables, errors, duplicates: [...duplicateNames].sort() };
};

const composite = (foreground: number[], background: number[], alpha: number) =>
	foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));

const relativeLuminance = (channels: number[]) => {
	const linear = channels.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

const channelsToHex = (channels: number[]) =>
	`#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

export const calculateContrast = (foregroundSource: string, backgroundSource: string) => {
	const [foregroundRed, foregroundGreen, foregroundBlue, foregroundAlpha] = readColorChannels(foregroundSource);
	const [backgroundRed, backgroundGreen, backgroundBlue, backgroundAlpha] = readColorChannels(backgroundSource);
	const white = [255, 255, 255];
	const opaqueBackground = composite([backgroundRed, backgroundGreen, backgroundBlue], white, backgroundAlpha);
	const opaqueForeground = composite(
		[foregroundRed, foregroundGreen, foregroundBlue],
		opaqueBackground,
		foregroundAlpha,
	);
	const foregroundLuminance = relativeLuminance(opaqueForeground);
	const backgroundLuminance = relativeLuminance(opaqueBackground);
	const ratio =
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
	return {
		ratio,
		foreground: channelsToHex(opaqueForeground),
		background: channelsToHex(opaqueBackground),
		aaNormal: ratio >= 4.5,
		aaLarge: ratio >= 3,
		aaaNormal: ratio >= 7,
		aaaLarge: ratio >= 4.5,
	};
};
