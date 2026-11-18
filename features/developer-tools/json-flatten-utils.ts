const maximumSourceLength = 500_000;
const maximumDepth = 60;
const maximumEntries = 20_000;

export type FlattenOptions = {
	delimiter?: "." | "/" | "_";
	arrayStyle?: "index" | "bracket";
	flattenArrays?: boolean;
};

const escapeKey = (key: string, delimiter: string) => key.replaceAll("\\", "\\\\").replaceAll(delimiter, `\\${delimiter}`);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (source: string) => {
	if (!source.trim()) throw new Error("Paste JSON to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 500,000 characters.");
	try {
		return JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
};

export const flattenJson = (source: string, { delimiter = ".", arrayStyle = "index", flattenArrays = true }: FlattenOptions = {}) => {
	const value = parseJson(source);
	const leaves: [string, unknown][] = [];

	const walk = (node: unknown, path: string, depth: number) => {
		if (depth > maximumDepth) throw new Error("JSON is nested too deeply to flatten (over 60 levels).");
		const isArray = Array.isArray(node);
		if (isArray ? flattenArrays : isPlainObject(node)) {
			const entries: [string | number, unknown][] = isArray ? (node as unknown[]).map((item, index) => [index, item]) : Object.entries(node as Record<string, unknown>);
			if (entries.length === 0) {
				leaves.push([path || "(root)", node]);
				return;
			}
			for (const [key, item] of entries) {
				let childPath: string;
				if (typeof key === "number") childPath = arrayStyle === "bracket" ? `${path}[${key}]` : path ? `${path}${delimiter}${key}` : String(key);
				else childPath = path ? `${path}${delimiter}${escapeKey(key, delimiter)}` : escapeKey(key, delimiter);
				walk(item, childPath, depth + 1);
				if (leaves.length > maximumEntries) throw new Error("This document flattens to over 20,000 keys. Narrow it first.");
			}
			return;
		}
		leaves.push([path || "(root)", node]);
	};

	walk(value, "", 0);
	return JSON.stringify(Object.fromEntries(leaves), null, 2);
};

const splitPath = (path: string, delimiter: string) => {
	const segments: string[] = [];
	let current = "";
	let escaping = false;
	let justClosedBracket = false;
	for (let index = 0; index < path.length; index += 1) {
		const character = path[index];
		if (escaping) {
			current += character;
			escaping = false;
			continue;
		}
		if (character === "\\") {
			escaping = true;
			continue;
		}
		if (character === delimiter) {
			if (justClosedBracket && current === "") {
				justClosedBracket = false;
				continue;
			}
			segments.push(current);
			current = "";
			justClosedBracket = false;
			continue;
		}
		if (character === "[") {
			const close = path.indexOf("]", index);
			if (close > index + 1 && /^\d+$/u.test(path.slice(index + 1, close))) {
				if (current) segments.push(current);
				current = "";
				segments.push(path.slice(index + 1, close));
				index = close;
				justClosedBracket = true;
				continue;
			}
		}
		current += character;
		justClosedBracket = false;
	}
	if (escaping) current += "\\";
	if (current || segments.length === 0) segments.push(current);
	return segments;
};

const isNumeric = (segment: string) => /^\d+$/u.test(segment);

const toArrays = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(toArrays);
	if (!isPlainObject(value)) return value;
	const keys = Object.keys(value);
	const converted: Record<string, unknown> = Object.fromEntries(keys.map((key) => [key, toArrays(value[key])]));
	if (keys.length === 0) return converted;
	const numericKeys = keys.filter(isNumeric).sort((a, b) => Number(a) - Number(b));
	if (numericKeys.length !== keys.length) return converted;
	if (numericKeys.some((key, index) => Number(key) !== index)) return converted;
	return numericKeys.map((key) => converted[key]);
};

export const unflattenJson = (source: string, { delimiter = "." }: Pick<FlattenOptions, "delimiter"> = {}) => {
	const value = parseJson(source);
	if (!isPlainObject(value)) throw new Error("Unflattening needs a JSON object of path keys and values.");
	const root: Record<string, unknown> = {};
	for (const [path, leaf] of Object.entries(value)) {
		const segments = splitPath(path, delimiter);
		let node: Record<string, unknown> = root;
		for (const [index, segment] of segments.entries()) {
			const last = index === segments.length - 1;
			if (last) {
				if (node[segment] !== undefined) throw new Error(`Two paths collide at "${path}".`);
				node[segment] = leaf;
				continue;
			}
			const existing = node[segment];
			if (existing === undefined) {
				const next: Record<string, unknown> = {};
				node[segment] = next;
				node = next;
				continue;
			}
			if (!isPlainObject(existing)) throw new Error(`Path "${path}" runs through a non-object value at "${segment}".`);
			node = existing;
		}
	}
	return JSON.stringify(toArrays(root), null, 2);
};
