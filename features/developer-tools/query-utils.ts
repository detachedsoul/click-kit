const maximumSourceLength = 200_000;
const maximumDepth = 20;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const splitKey = (raw: string) => {
	const segments: string[] = [];
	let current = "";
	for (let index = 0; index < raw.length; index += 1) {
		const character = raw[index];
		if (character === "[") {
			const close = raw.indexOf("]", index);
			if (close === -1) {
				current += character;
				continue;
			}
			if (current) segments.push(current);
			segments.push(raw.slice(index + 1, close));
			current = "";
			index = close;
			continue;
		}
		current += character;
	}
	if (current) segments.push(current);
	return segments.length > 0 ? segments : [raw];
};

const assign = (root: Record<string, unknown>, segments: string[], value: string) => {
	let node: Record<string, unknown> = root;
	for (const [index, segment] of segments.entries()) {
		const key = segment === "" ? "0" : segment;
		const last = index === segments.length - 1;
		if (last) {
			const existing = node[key];
			if (existing === undefined) node[key] = value;
			else if (Array.isArray(existing)) existing.push(value);
			else node[key] = [existing as string, value];
			return;
		}
		const existing = node[key];
		if (!isPlainObject(existing)) {
			if (existing !== undefined) throw new Error(`Query key "${segments.join("")}" is both a value and a group.`);
			const next: Record<string, unknown> = {};
			node[key] = next;
			node = next;
		} else node = existing;
	}
};

const toArrays = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(toArrays);
	if (!isPlainObject(value)) return value;
	const keys = Object.keys(value);
	const converted: Record<string, unknown> = Object.fromEntries(keys.map((key) => [key, toArrays(value[key])]));
	const numericKeys = keys.filter((key) => /^\d+$/u.test(key)).sort((a, b) => Number(a) - Number(b));
	if (numericKeys.length === keys.length && numericKeys.every((key, index) => Number(key) === index)) return numericKeys.map((key) => converted[key]);
	return converted;
};

export type QueryOptions = { plusAsSpace?: boolean };

export const queryToJson = (source: string, { plusAsSpace = true }: QueryOptions = {}) => {
	const trimmed = source.trim().replace(/^[?#]/u, "").replace(/#.*$/u, "");
	if (!trimmed) throw new Error("Paste a query string to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep query strings under 200,000 characters.");
	const root: Record<string, unknown> = {};
	const appendCounters = new Map<string, number>();
	for (const pair of trimmed.split("&")) {
		if (!pair) continue;
		const equals = pair.indexOf("=");
		const rawKey = equals === -1 ? pair : pair.slice(0, equals);
		const rawValue = equals === -1 ? "" : pair.slice(equals + 1);
		const decode = (value: string) => {
			const prepared = plusAsSpace ? value.replaceAll("+", " ") : value;
			try {
				return decodeURIComponent(prepared);
			} catch {
				return prepared;
			}
		};
		const key = decode(rawKey);
		if (!key) continue;
		const appendMatch = key.match(/^(.*)\[\]$/u);
		let normalizedKey = key;
		if (appendMatch) {
			const base = appendMatch[1];
			const index = appendCounters.get(base) ?? 0;
			appendCounters.set(base, index + 1);
			normalizedKey = `${base}[${index}]`;
		}
		const segments = splitKey(normalizedKey);
		if (segments.length > maximumDepth) throw new Error("Query keys are nested too deeply (over 20 levels).");
		assign(root, segments, decode(rawValue));
	}
	return JSON.stringify(toArrays(root), null, 2);
};

const flattenPairs = (value: unknown, prefix: string, pairs: [string, string][]) => {
	if (Array.isArray(value)) {
		value.forEach((item, index) => flattenPairs(item, `${prefix}[${index}]`, pairs));
		return;
	}
	if (isPlainObject(value)) {
		for (const [key, item] of Object.entries(value)) flattenPairs(item, prefix ? `${prefix}[${key}]` : key, pairs);
		return;
	}
	if (value === null || value === undefined) pairs.push([prefix, ""]);
	else pairs.push([prefix, typeof value === "object" ? JSON.stringify(value) : String(value)]);
};

export const jsonToQuery = (source: string, { leading = false }: { leading?: boolean } = {}) => {
	if (!source.trim()) throw new Error("Paste JSON to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 200,000 characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	if (!isPlainObject(value)) throw new Error("Query strings need a JSON object at the root.");
	const pairs: [string, string][] = [];
	flattenPairs(value, "", pairs);
	if (pairs.length === 0) throw new Error("Add at least one key to build a query string.");
	const query = pairs.map(([key, item]) => `${encodeURIComponent(key).replaceAll("%5B", "[").replaceAll("%5D", "]")}=${encodeURIComponent(item)}`).join("&");
	return leading ? `?${query}` : query;
};
