const maximumSourceLength = 500_000;
const maximumDepth = 60;

export type PatchOperation = { op: "add" | "remove" | "replace"; path: string; value?: unknown };

const escapeToken = (token: string) => token.replaceAll("~", "~0").replaceAll("/", "~1");

const parseDocument = (source: string, label: string) => {
	if (!source.trim()) throw new Error(`Paste the ${label} JSON document first.`);
	if (source.length > maximumSourceLength) throw new Error(`Keep the ${label} document under 500,000 characters.`);
	try {
		return JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `The ${label} document is not valid JSON: ${error.message}` : `The ${label} document is not valid JSON.`);
	}
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEqual = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const diff = (left: unknown, right: unknown, path: string, operations: PatchOperation[], depth: number) => {
	if (depth > maximumDepth) throw new Error("Documents are nested too deeply to diff (over 60 levels).");
	if (isEqual(left, right)) return;
	if (isPlainObject(left) && isPlainObject(right)) {
		for (const key of Object.keys(left)) {
			if (!(key in right)) operations.push({ op: "remove", path: `${path}/${escapeToken(key)}` });
		}
		for (const [key, value] of Object.entries(right)) {
			const childPath = `${path}/${escapeToken(key)}`;
			if (!(key in left)) operations.push({ op: "add", path: childPath, value });
			else diff(left[key], value, childPath, operations, depth + 1);
		}
		return;
	}
	if (Array.isArray(left) && Array.isArray(right) && left.length === right.length) {
		left.forEach((value, index) => diff(value, right[index], `${path}/${index}`, operations, depth + 1));
		return;
	}
	operations.push({ op: "replace", path: path || "", value: right });
};

export const generateJsonPatch = (leftSource: string, rightSource: string) => {
	const left = parseDocument(leftSource, "original");
	const right = parseDocument(rightSource, "updated");
	const operations: PatchOperation[] = [];
	diff(left, right, "", operations, 0);
	return operations;
};

export const formatJsonPatch = (operations: PatchOperation[]) => JSON.stringify(operations, null, 2);

export const summariseJsonPatch = (operations: PatchOperation[]) => {
	const counts = { add: 0, remove: 0, replace: 0 };
	for (const operation of operations) counts[operation.op] += 1;
	return counts;
};

export const applyJsonPatch = (source: string, operations: PatchOperation[]) => {
	const clone = structuredClone(parseDocument(source, "original"));
	for (const operation of operations) {
		const tokens = operation.path.split("/").slice(1).map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
		if (tokens.length === 0) {
			if (operation.op === "remove") return undefined;
			return structuredClone(operation.value);
		}
		let parent: unknown = clone;
		for (const token of tokens.slice(0, -1)) {
			if (Array.isArray(parent)) parent = parent[Number(token)];
			else if (isPlainObject(parent)) parent = parent[token];
			else throw new Error(`Patch path "${operation.path}" does not exist in the original document.`);
		}
		const last = tokens.at(-1)!;
		if (Array.isArray(parent)) {
			const index = last === "-" ? parent.length : Number(last);
			if (!Number.isInteger(index)) throw new Error(`Patch path "${operation.path}" is not an array index.`);
			if (operation.op === "remove") parent.splice(index, 1);
			else if (operation.op === "add") parent.splice(index, 0, structuredClone(operation.value));
			else parent[index] = structuredClone(operation.value);
		} else if (isPlainObject(parent)) {
			if (operation.op === "remove") delete parent[last];
			else parent[last] = structuredClone(operation.value);
		} else {
			throw new Error(`Patch path "${operation.path}" does not exist in the original document.`);
		}
	}
	return clone;
};
