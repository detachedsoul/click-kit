const maximumSourceLength = 500_000;
const maximumDepth = 40;

type Primitive = "string" | "integer" | "number" | "boolean" | "null";
type Inferred = { kind: "primitive"; types: Primitive[] } | { kind: "array"; item: Inferred } | { kind: "object"; fields: Map<string, { type: Inferred; optional: boolean }> };

const parseJson = (source: string) => {
	if (!source.trim()) throw new Error("Paste JSON to generate a Zod schema.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 500,000 characters.");
	try {
		return JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
};

const infer = (value: unknown, depth: number): Inferred => {
	if (depth > maximumDepth) throw new Error("JSON is nested too deeply to infer a schema (over 40 levels).");
	if (value === null) return { kind: "primitive", types: ["null"] };
	if (Array.isArray(value)) {
		if (value.length === 0) return { kind: "array", item: { kind: "primitive", types: [] } };
		return { kind: "array", item: value.map((item) => infer(item, depth + 1)).reduce(merge) };
	}
	if (typeof value === "object") {
		const fields = new Map<string, { type: Inferred; optional: boolean }>();
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) fields.set(key, { type: infer(item, depth + 1), optional: false });
		return { kind: "object", fields };
	}
	if (typeof value === "string") return { kind: "primitive", types: ["string"] };
	if (typeof value === "boolean") return { kind: "primitive", types: ["boolean"] };
	if (typeof value === "number") return { kind: "primitive", types: [Number.isInteger(value) ? "integer" : "number"] };
	throw new Error(`Unsupported JSON value type: ${typeof value}.`);
};

function merge(left: Inferred, right: Inferred): Inferred {
	if (left.kind === "primitive" && right.kind === "primitive") return { kind: "primitive", types: [...new Set([...left.types, ...right.types])] };
	if (left.kind === "array" && right.kind === "array") return { kind: "array", item: merge(left.item, right.item) };
	if (left.kind === "object" && right.kind === "object") {
		const fields = new Map<string, { type: Inferred; optional: boolean }>();
		for (const [key, field] of left.fields) {
			const other = right.fields.get(key);
			fields.set(key, other ? { type: merge(field.type, other.type), optional: field.optional || other.optional } : { ...field, optional: true });
		}
		for (const [key, field] of right.fields) if (!left.fields.has(key)) fields.set(key, { ...field, optional: true });
		return { kind: "object", fields };
	}
	return { kind: "primitive", types: [] };
}

const baseSchema = (type: Primitive) => {
	if (type === "string") return "z.string()";
	if (type === "integer") return "z.number().int()";
	if (type === "number") return "z.number()";
	if (type === "boolean") return "z.boolean()";
	return "z.null()";
};

const render = (node: Inferred, level: number): string => {
	const indent = "  ".repeat(level);
	if (node.kind === "array") {
		const inner = node.item.kind === "primitive" && node.item.types.length === 0 ? "z.unknown()" : render(node.item, level);
		return `z.array(${inner})`;
	}
	if (node.kind === "object") {
		if (node.fields.size === 0) return "z.object({})";
		const entries = [...node.fields.entries()]
			.map(([key, field]) => {
				const safeKey = /^[A-Za-z_$][\w$]*$/u.test(key) ? key : JSON.stringify(key);
				return `${indent}  ${safeKey}: ${render(field.type, level + 1)}${field.optional ? ".optional()" : ""},`;
			})
			.join("\n");
		return `z.object({\n${entries}\n${indent}})`;
	}
	const nonNull = node.types.filter((type) => type !== "null");
	const nullable = node.types.includes("null") && nonNull.length > 0;
	if (nonNull.length === 0) return "z.null()";
	const unique = [...new Set(nonNull.map((type) => (type === "number" && nonNull.includes("integer") ? "number" : type)))];
	const schema = unique.length === 1 ? baseSchema(unique[0] as Primitive) : `z.union([${unique.map((type) => baseSchema(type as Primitive)).join(", ")}])`;
	return nullable ? `${schema}.nullable()` : schema;
};

export const jsonToZod = (source: string, rootName = "Root") => {
	const value = parseJson(source);
	const trimmed = rootName.trim();
	if (!trimmed) throw new Error("Give the schema a name.");
	if (!/^[A-Za-z_$][\w$]*$/u.test(trimmed)) throw new Error("Schema names must be valid TypeScript identifiers, such as User or ApiResponse.");
	const schemaName = `${trimmed[0].toUpperCase()}${trimmed.slice(1)}Schema`;
	return `import { z } from "zod";\n\nexport const ${schemaName} = ${render(infer(value, 0), 0)};\n\nexport type ${trimmed[0].toUpperCase()}${trimmed.slice(1)} = z.infer<typeof ${schemaName}>;\n`;
};
