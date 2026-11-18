export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ErdAttribute = { name: string; type: string; note: string };

export type ErdEntity = { name: string; attributes: ErdAttribute[] };

export type ErdRelation = { from: string; to: string; label: string; cardinality: string };

const singular = (word: string) => {
	if (!word) return word;
	if (/(data|media|series)$/iu.test(word)) return word;
	if (/ies$/iu.test(word)) return `${word.slice(0, -3)}y`;
	if (/(ses|xes|zes|ches|shes)$/iu.test(word)) return word.slice(0, -2);
	if (/s$/iu.test(word) && !/ss$/iu.test(word)) return word.slice(0, -1);
	return word;
};

export const toPascal = (value: string) =>
	value
		.replace(/[^A-Za-z0-9]+/gu, " ")
		.trim()
		.split(/\s+/u)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("") || "Record";

const toSnake = (value: string) =>
	value
		.replace(/([a-z0-9])([A-Z])/gu, "$1_$2")
		.replace(/[^A-Za-z0-9]+/gu, "_")
		.replace(/^_+|_+$/gu, "")
		.toLowerCase() || "field";

const isPlainObject = (value: JsonValue | undefined): value is { [key: string]: JsonValue } =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const typeOf = (value: JsonValue): string => {
	if (value === null) return "null";
	if (Array.isArray(value)) return "json";
	if (typeof value === "string") return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/u.test(value) ? "date" : "string";
	if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
	if (typeof value === "boolean") return "boolean";
	return "json";
};

export type ErdOptions = {
	includeRelations?: boolean;
};

export const jsonToErd = (input: string, options: ErdOptions = {}) => {
	if (!input.trim()) throw new Error("Paste some JSON first.");
	let parsed: JsonValue;
	try {
		parsed = JSON.parse(input) as JsonValue;
	} catch (error) {
		throw new Error(`That is not valid JSON: ${error instanceof Error ? error.message : "parse failed"}.`);
	}
	if (typeof parsed !== "object" || parsed === null) throw new Error("Use a JSON object or an array of objects that describes your records.");
	if (!Array.isArray(parsed) && !Object.keys(parsed).length) throw new Error("That JSON object is empty, so there is nothing to draw.");

	const entities = new Map<string, ErdEntity>();
	const relations: ErdRelation[] = [];
	const relationKeys = new Set<string>();

	const entity = (key: string) => {
		const name = toPascal(singular(toSnake(key)));
		if (!entities.has(name)) entities.set(name, { name, attributes: [] });
		return entities.get(name)!;
	};

	const addAttribute = (target: ErdEntity, name: string, type: string) => {
		const attributeName = toSnake(name);
		if (target.attributes.some((attribute) => attribute.name === attributeName)) return;
		target.attributes.push({ name: attributeName, type, note: type });
	};

	const link = (parent: ErdEntity, child: ErdEntity, label: string, cardinality: string) => {
		if (parent.name === child.name) return;
		const key = `${parent.name}->${child.name}`;
		if (relationKeys.has(key)) return;
		relationKeys.add(key);
		relations.push({ from: parent.name, to: child.name, label: toSnake(label), cardinality });
	};

	const populate = (target: ErdEntity, value: { [key: string]: JsonValue }, depth: number) => {
		if (depth > 8) return;
		for (const [key, fieldValue] of Object.entries(value)) {
			if (Array.isArray(fieldValue)) {
				const sample = fieldValue.find((item) => item !== null && item !== undefined);
				if (isPlainObject(sample)) {
					const child = entity(key);
					addAttribute(child, `${singular(toSnake(target.name))}_id`, "int");
					link(target, child, key, "||--o{");
					populate(child, sample, depth + 1);
				} else if (sample !== undefined) {
					addAttribute(target, key, typeOf(sample));
				}
				continue;
			}
			if (isPlainObject(fieldValue)) {
				const child = entity(key);
				addAttribute(target, `${key}_id`, "int");
				link(target, child, key, "||--||");
				populate(child, fieldValue, depth + 1);
				continue;
			}
			addAttribute(target, key, typeOf(fieldValue));
		}
	};

	if (Array.isArray(parsed)) {
		const sample = parsed.find((item) => isPlainObject(item));
		if (!isPlainObject(sample)) throw new Error("An array must contain objects that describe your records.");
		populate(entity("records"), sample, 0);
	} else {
		const entries = Object.entries(parsed);
		const structured = entries.filter(([, value]) => isPlainObject(value) || (Array.isArray(value) && value.some((item) => isPlainObject(item))));
		if (!structured.length) {
			populate(entity("record"), parsed, 0);
		} else {
			for (const [key, value] of structured) {
				if (Array.isArray(value)) {
					const sample = value.find((item) => isPlainObject(item));
					if (isPlainObject(sample)) populate(entity(key), sample, 1);
				} else if (isPlainObject(value)) {
					populate(entity(key), value, 1);
				}
			}
			for (const [key, value] of entries) {
				if (!Array.isArray(value)) continue;
				const sample = value.find((item) => item !== null && item !== undefined);
				if (sample === undefined || isPlainObject(sample)) continue;
				addAttribute(entity(key), "value", typeOf(sample));
			}
		}
	}

	if (!entities.size) throw new Error("No objects or arrays of objects were found, so there is nothing to draw.");
	for (const target of entities.values()) {
		if (!target.attributes.length) addAttribute(target, "id", "int");
	}

	const lines = ["erDiagram"];
	for (const target of [...entities.values()].sort((left, right) => left.name.localeCompare(right.name))) {
		lines.push(`  ${target.name} {`);
		for (const attribute of target.attributes) lines.push(`    ${attribute.type} ${attribute.name}`);
		lines.push("  }");
	}
	if (options.includeRelations !== false) {
		for (const relation of relations) lines.push(`  ${relation.from} ${relation.cardinality} ${relation.to} : "${relation.label}"`);
	}
	return { mermaid: lines.join("\n"), entities: [...entities.values()], relations, entityCount: entities.size };
};
