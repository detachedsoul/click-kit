import { parse as parseYamlSource, stringify } from "yaml";

export type EnvEntry = { key: string; value: string; quote: "raw" | "single" | "double" };
export type EnvWarning = { line: number; message: string };
export type EnvParse = { entries: EnvEntry[]; warnings: EnvWarning[] };

const keyPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;

export const parseEnvFile = (source: string): EnvParse => {
	if (!source.trim()) throw new Error("Paste a .env file first.");
	const lines = source.replace(/\r\n/gu, "\n").split("\n");
	const entries: EnvEntry[] = [];
	const warnings: EnvWarning[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < lines.length; index += 1) {
		const raw = lines[index];
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const body = line.startsWith("export ") ? line.slice(7).trim() : line;
		const equals = body.indexOf("=");
		if (equals < 0) {
			warnings.push({ line: index + 1, message: `Skipped "${truncate(raw)}": no = found.` });
			continue;
		}
		const key = body.slice(0, equals).trim();
		if (!keyPattern.test(key)) {
			warnings.push({ line: index + 1, message: `"${key}" is not a valid variable name.` });
			continue;
		}
		let rest = body.slice(equals + 1);
		let quote: EnvEntry["quote"] = "raw";
		let value = "";
		const opening = rest[0];
		if (opening === '"' || opening === "'") {
			quote = opening === '"' ? "double" : "single";
			rest = rest.slice(1);
			let closed = false;
			let buffer = rest;
			while (!closed) {
				const end = findClosing(buffer, opening);
				if (end >= 0) {
					value += buffer.slice(0, end);
					closed = true;
					const trailing = buffer.slice(end + 1).trim();
					if (trailing && !trailing.startsWith("#")) warnings.push({ line: index + 1, message: `Ignored trailing text after the closing quote on ${key}.` });
				} else {
					value += `${buffer}\n`;
					index += 1;
					if (index >= lines.length) throw new Error(`Unterminated ${opening} quote on ${key}.`);
					buffer = lines[index];
				}
			}
			value = unescape(value, quote === "double");
		} else {
			const comment = rest.search(/\s#/u);
			value = (comment >= 0 ? rest.slice(0, comment) : rest).trim();
		}
		if (seen.has(key)) warnings.push({ line: index + 1, message: `${key} is defined more than once; the last value wins.` });
		seen.add(key);
		entries.push({ key, value, quote });
	}
	if (entries.length === 0) throw new Error("No KEY=value pairs found.");
	return { entries, warnings };
};

const truncate = (value: string) => (value.length > 40 ? `${value.slice(0, 40)}…` : value);

const findClosing = (buffer: string, quote: string) => {
	for (let index = 0; index < buffer.length; index += 1) {
		if (buffer[index] === "\\" && quote === '"') {
			index += 1;
			continue;
		}
		if (buffer[index] === quote) return index;
	}
	return -1;
};

const unescape = (value: string, expand: boolean) => {
	if (!expand) return value;
	return value.replace(/\\n/gu, "\n").replace(/\\r/gu, "\r").replace(/\\t/gu, "\t").replace(/\\"/gu, '"').replace(/\\\\/gu, "\\");
};

const nest = (entries: EnvEntry[], separator: string) => {
	if (!separator) return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
	const root: Record<string, unknown> = {};
	for (const entry of entries) {
		const parts = entry.key.split(separator);
		let cursor = root;
		parts.forEach((part, index) => {
			const last = index === parts.length - 1;
			if (last) {
				cursor[part] = entry.value;
			} else {
				const existing = cursor[part];
				if (typeof existing !== "object" || existing === null) cursor[part] = {};
				cursor = cursor[part] as Record<string, unknown>;
			}
		});
	}
	return root;
};

export type EnvTarget = "json" | "yaml" | "compose" | "shell";

export const envToTarget = (source: string, target: EnvTarget, options: { nested: boolean; separator: string }) => {
	const parsed = parseEnvFile(source);
	const separator = options.nested ? options.separator || "__" : "";
	const object = nest(parsed.entries, separator);
	if (target === "json") return { text: JSON.stringify(object, null, 2), parsed };
	if (target === "yaml") return { text: stringify(object, { lineWidth: 0 }), parsed };
	if (target === "compose") {
		const lines = parsed.entries.map((entry) => `      ${entry.key}: ${composeValue(entry.value)}`);
		return { text: `services:\n  app:\n    environment:\n${lines.join("\n")}`, parsed };
	}
	const lines = parsed.entries.map((entry) => `export ${entry.key}=${shellQuote(entry.value)}`);
	return { text: lines.join("\n"), parsed };
};

const composeValue = (value: string) => (/^[\w@%+=:,./-]*$/u.test(value) ? value : JSON.stringify(value));

const shellQuote = (value: string) => (value === "" ? "''" : /^[\w@%+=:,./-]+$/u.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`);

const needsQuote = (value: string) => value === "" || /[\s#'"\\$`!]/u.test(value);

const escapeEnv = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"').replaceAll("$", "\\$");

const flatten = (value: unknown, prefix: string, separator: string, output: [string, string][]) => {
	if (value === null || value === undefined) {
		output.push([prefix, ""]);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => flatten(item, prefix ? `${prefix}${separator}${index}` : String(index), separator, output));
		return;
	}
	if (typeof value === "object") {
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			flatten(item, prefix ? `${prefix}${separator}${key}` : key, separator, output);
		}
		return;
	}
	output.push([prefix, String(value)]);
};

export const structuredToEnv = (source: string, options: { format: "json" | "yaml"; separator: string; comments: boolean; sort: boolean }) => {
	if (!source.trim()) throw new Error("Paste JSON or YAML first.");
	let parsed: unknown;
	try {
		parsed = options.format === "json" ? (JSON.parse(source) as unknown) : (parseYamlSource(source) as unknown);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message.replace(/^JSON\.parse: /u, "") : "Could not parse this input.");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON or YAML object at the top level.");
	const pairs: [string, string][] = [];
	flatten(parsed, "", options.separator || "__", pairs);
	if (pairs.length === 0) throw new Error("Nothing to convert: the object is empty.");
	const ordered = options.sort ? [...pairs].sort(([left], [right]) => left.localeCompare(right)) : pairs;
	const lines: string[] = [];
	for (const [key, value] of ordered) {
		const upper = key.replace(/[^A-Za-z0-9_]/gu, "_").toUpperCase();
		const name = /^[A-Za-z_]/u.test(upper) ? upper : `_${upper}`;
		if (options.comments) {
			const section = key.split(options.separator || "__")[0];
			if (lines[lines.length - 1] !== `## ${section}`) lines.push(`## ${section}`);
		}
		if (value === "") lines.push(`${name}=`);
		else lines.push(needsQuote(value) ? `${name}="${escapeEnv(value)}"` : `${name}=${value}`);
	}
	return { text: lines.join("\n"), count: ordered.length };
};
