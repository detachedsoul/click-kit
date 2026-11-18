export type ModelKind = "string" | "int" | "float" | "boolean" | "date" | "object" | "array" | "mixed";

export type ModelField = { key: string; kind: ModelKind; optional: boolean; children?: ModelField[]; itemKind?: ModelKind };

export type Model = { name: string; fields: ModelField[] };

const isoDate = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/u;

const isPlainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const kindOfValue = (value: unknown): ModelKind => {
	if (typeof value === "string") return isoDate.test(value) ? "date" : "string";
	if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
	if (typeof value === "boolean") return "boolean";
	if (Array.isArray(value)) return "array";
	if (isPlainObject(value)) return "object";
	return "mixed";
};

const mergeKinds = (values: unknown[]): ModelKind => {
	const kinds = values.map(kindOfValue).filter((kind) => kind !== "mixed");
	if (kinds.length === 0) return "mixed";
	const unique = [...new Set(kinds)];
	if (unique.length === 1) return unique[0];
	if (unique.includes("date") && unique.includes("string")) return "string";
	if (unique.every((kind) => kind === "int" || kind === "float")) return "float";
	return "mixed";
};

export const inferFields = (objects: Record<string, unknown>[]): ModelField[] => {
	if (objects.length === 0) return [];
	const keys: string[] = [];
	for (const object of objects) for (const key of Object.keys(object)) if (!keys.includes(key)) keys.push(key);
	return keys.map((key) => {
		const present = objects.filter((object) => key in object);
		const values = present.map((object) => object[key]).filter((value) => value !== null && value !== undefined);
		const optional = present.length < objects.length || present.some((object) => object[key] === null || object[key] === undefined);
		const kind = mergeKinds(values);
		const field: ModelField = { key, kind, optional };
		if (kind === "object") {
			const nested = values.filter(isPlainObject);
			field.children = inferFields(nested);
		}
		if (kind === "array") {
			const items = values.flatMap((value) => (Array.isArray(value) ? value : [])).filter((item) => item !== null && item !== undefined);
			const itemKind = mergeKinds(items);
			field.itemKind = itemKind;
			if (itemKind === "object") field.children = inferFields(items.filter(isPlainObject));
		}
		return field;
	});
};

export const parseModel = (source: string, name: string): Model => {
	if (!source.trim()) throw new Error("Paste sample JSON first.");
	let parsed: unknown;
	try {
		parsed = JSON.parse(source);
	} catch (error) {
		throw new Error(error instanceof Error ? error.message.replace(/^JSON\.parse: /u, "") : "Invalid JSON");
	}
	const object = Array.isArray(parsed) ? parsed[0] : parsed;
	if (!isPlainObject(object)) throw new Error("Expected a JSON object (or an array of objects) to model.");
	const samples = Array.isArray(parsed) ? parsed.filter(isPlainObject) : [object];
	if (samples.length === 0) throw new Error("Expected at least one JSON object to model.");
	const modelName = name.trim() || "Record";
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(modelName)) throw new Error(`"${modelName}" is not a valid model name.`);
	return { name: modelName, fields: inferFields(samples) };
};

const pascal = (value: string) => value.replace(/(^|[-_.\s])(\w)/gu, (_, __: string, letter: string) => letter.toUpperCase());
const camel = (value: string) => {
	const cleaned = pascal(value);
	return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
};
const safeKey = (value: string) => value.replace(/[^A-Za-z0-9_]/gu, "_");

export type MongooseOptions = { timestamps: boolean; strictMode: boolean };

export const toMongoose = (model: Model, options: MongooseOptions) => {
	const renderField = (field: ModelField, depth: number): string => {
		const pad = "  ".repeat(depth);
		const name = safeKey(field.key);
		const typeFor = (kind: ModelKind, children?: ModelField[], itemKind?: ModelKind): string => {
			switch (kind) {
				case "string":
					return "String";
				case "int":
				case "float":
					return "Number";
				case "boolean":
					return "Boolean";
				case "date":
					return "Date";
				case "array":
					return itemKind === "object" ? "[subSchema]" : `[${typeFor(itemKind ?? "mixed")}]`;
				case "object":
					return children && children.length ? "subSchema" : "Schema.Types.Mixed";
				default:
					return "Schema.Types.Mixed";
			}
		};
		if (field.kind === "object" && field.children?.length) {
			const nested = field.children.map((child) => renderField(child, depth + 1)).join(",\n");
			return `${pad}${name}: new Schema({\n${nested}\n${pad}})`;
		}
		if (field.kind === "array" && field.itemKind === "object" && field.children?.length) {
			const nested = field.children.map((child) => renderField(child, depth + 1)).join(",\n");
			return `${pad}${name}: [new Schema({\n${nested}\n${pad}})]`;
		}
		const type = typeFor(field.kind, field.children, field.itemKind);
		const extras = [type];
		if (!field.optional) extras.push("required: true");
		const definition = extras.length === 1 ? type : `{ type: ${type}, required: true }`;
		return `${pad}${name}: ${definition}`;
	};
	const body = model.fields.map((field) => renderField(field, 1)).join(",\n");
	const optionsLine = [options.timestamps ? "timestamps: true" : "", options.strictMode ? "" : "strict: false"].filter(Boolean).join(", ");
	return `import mongoose from "mongoose";

const { Schema } = mongoose;

const ${model.name}Schema = new Schema(
  {
${body}
  },
  ${optionsLine ? `{ ${optionsLine} }` : "{}"},
);

export const ${model.name} = mongoose.model(${JSON.stringify(model.name)}, ${model.name}Schema);
export default ${model.name};
`;
};

export type PrismaOptions = { idField: boolean; nullableOptional: boolean; mapTo: string };

const prismaType = (field: ModelField): string => {
	switch (field.kind) {
		case "string":
			return "String";
		case "date":
			return "DateTime";
		case "int":
			return "Int";
		case "float":
			return "Float";
		case "boolean":
			return "Boolean";
		case "array":
			switch (field.itemKind) {
				case "string":
					return "String[]";
				case "date":
					return "DateTime[]";
				case "int":
					return "Int[]";
				case "float":
					return "Float[]";
				case "boolean":
					return "Boolean[]";
				default:
					return "Json";
			}
		default:
			return "Json";
	}
};

export const toPrisma = (model: Model, options: PrismaOptions) => {
	const modelName = pascal(model.name) || "Record";
	const rows: { name: string; type: string; modifiers: string }[] = [];
	if (options.idField) rows.push({ name: "id", type: "String", modifiers: "@id @default(uuid())" });
	for (const field of model.fields) {
		const name = camel(field.key);
		if (options.idField && name === "id") {
			rows[0] = { name: "id", type: prismaType(field), modifiers: "@id" };
			continue;
		}
		const type = prismaType(field);
		const modifier = field.optional && options.nullableOptional ? "?" : "";
		rows.push({ name, type: `${type}${modifier}`, modifiers: "" });
	}
	const nameWidth = Math.max(...rows.map((row) => row.name.length));
	const typeWidth = Math.max(...rows.map((row) => row.type.length));
	const body = rows.map((row) => `  ${row.name.padEnd(nameWidth)} ${row.type.padEnd(typeWidth)}${row.modifiers ? ` ${row.modifiers}` : ""}`.trimEnd());
	const mapped = options.mapTo.trim() ? `\n  @@map(${JSON.stringify(options.mapTo.trim())})` : "";
	return `model ${modelName} {\n${body.join("\n")}${mapped}\n}\n`;
};
