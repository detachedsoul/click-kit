import { parse, stringify } from "smol-toml";

const maximumSourceLength = 200_000;

const formatParseError = (error: unknown) => {
	const message = error instanceof Error ? error.message : "Unknown parse error.";
	return message.replace(/^Invalid TOML document:\s*/u, "").replace(/\n{2,}/gu, "\n").trim();
};

const assertObjectRoot = (value: unknown, source: "TOML" | "JSON") => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${source} must decode to a table (object) at the root to convert it.`);
	}
};

export const tomlToJson = (source: string) => {
	if (!source.trim()) throw new Error("Paste TOML to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep TOML input under 200,000 characters.");
	let value: unknown;
	try {
		value = parse(source);
	} catch (error) {
		throw new Error(`Invalid TOML: ${formatParseError(error)}`);
	}
	assertObjectRoot(value, "TOML");
	return JSON.stringify(value, null, 2);
};

const findNullPath = (value: unknown, path: string): string | null => {
	if (value === null) return path || "(root)";
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			const found = findNullPath(item, `${path}[${index}]`);
			if (found) return found;
		}
		return null;
	}
	if (typeof value === "object") {
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			const found = findNullPath(item, path ? `${path}.${key}` : key);
			if (found) return found;
		}
	}
	return null;
};

export const jsonToToml = (source: string) => {
	if (!source.trim()) throw new Error("Paste JSON to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 200,000 characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	assertObjectRoot(value, "JSON");
	const nullPath = findNullPath(value, "");
	if (nullPath) throw new Error(`TOML has no null value. Replace the null at ${nullPath} before converting.`);
	if (Object.keys(value as Record<string, unknown>).length === 0) return "";
	try {
		return stringify(value as Record<string, unknown>);
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not write TOML: ${error.message}` : "Could not write TOML.");
	}
};
