const maximumSourceLength = 500_000;
const maximumDepth = 40;
const maximumTypes = 200;

export type CodeLanguage = "go" | "rust" | "python" | "java" | "csharp" | "kotlin" | "swift";

type PrimitiveKind = "string" | "integer" | "number" | "boolean" | "null";

type PrimitiveNode = { kind: "primitive"; kinds: PrimitiveKind[] };
type ArrayNode = { kind: "array"; element: TypeNode };
type ObjectNode = { kind: "object"; fields: Map<string, { node: TypeNode; optional: boolean }> };
type TypeNode = PrimitiveNode | ArrayNode | ObjectNode;

const parseJson = (source: string) => {
	if (!source.trim()) throw new Error("Paste JSON to generate types first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 500,000 characters.");
	try {
		return JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
};

const infer = (value: unknown, depth: number): TypeNode => {
	if (depth > maximumDepth) throw new Error("JSON is nested too deeply to infer types (over 40 levels).");
	if (value === null) return { kind: "primitive", kinds: ["null"] };
	if (Array.isArray(value)) {
		const elements = value.map((item) => infer(item, depth + 1));
		return { kind: "array", element: elements.length === 0 ? { kind: "primitive", kinds: ["null"] } : elements.reduce(mergeNodes) };
	}
	if (typeof value === "object") {
		const fields = new Map<string, { node: TypeNode; optional: boolean }>();
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) fields.set(key, { node: infer(item, depth + 1), optional: false });
		return { kind: "object", fields };
	}
	if (typeof value === "string") return { kind: "primitive", kinds: ["string"] };
	if (typeof value === "boolean") return { kind: "primitive", kinds: ["boolean"] };
	if (typeof value === "number") return { kind: "primitive", kinds: [Number.isInteger(value) ? "integer" : "number"] };
	throw new Error(`Unsupported JSON value type: ${typeof value}.`);
};

function mergeNodes(left: TypeNode, right: TypeNode): TypeNode {
	if (left.kind === "primitive" && right.kind === "primitive") {
		return { kind: "primitive", kinds: [...new Set([...left.kinds, ...right.kinds])] };
	}
	if (left.kind === "array" && right.kind === "array") {
		return { kind: "array", element: mergeNodes(left.element, right.element) };
	}
	if (left.kind === "object" && right.kind === "object") {
		const fields = new Map<string, { node: TypeNode; optional: boolean }>();
		for (const [key, field] of left.fields) {
			const other = right.fields.get(key);
			fields.set(key, other ? { node: mergeNodes(field.node, other.node), optional: field.optional || other.optional } : { ...field, optional: true });
		}
		for (const [key, field] of right.fields) if (!left.fields.has(key)) fields.set(key, { ...field, optional: true });
		return { kind: "object", fields };
	}
	// Objects, arrays, and primitives mixed in one array: fall back to a permissive value type.
	return { kind: "primitive", kinds: ["string", "integer", "number", "boolean", "null"] };
}

const pascalCase = (value: string) =>
	value
		.replace(/[^A-Za-z0-9]+(.)?/gu, (_, character: string | undefined) => (character ? character.toUpperCase() : ""))
		.replace(/^./u, (character) => character.toUpperCase()) || "Value";

const words = (value: string) =>
	value
		.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
		.replace(/[^A-Za-z0-9]+/gu, " ")
		.trim()
		.split(/\s+/u)
		.filter(Boolean);

const snakeCase = (value: string) => {
	const parts = words(value).map((word) => word.toLowerCase());
	const joined = parts.join("_");
	return joined || "value";
};

const camelCase = (value: string) => {
	const parts = words(value).map((word) => word.toLowerCase());
	if (parts.length === 0) return "value";
	return `${parts[0]}${parts.slice(1).map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join("")}`;
};

const singular = (value: string) => (value.endsWith("ies") ? `${value.slice(0, -3)}y` : value.endsWith("s") && !value.endsWith("ss") ? value.slice(0, -1) : value);

type Named = { name: string; node: ObjectNode };

const collectTypes = (root: TypeNode, rootName: string): { named: Named[]; names: Map<TypeNode, string> } => {
	const named: Named[] = [];
	const names = new Map<TypeNode, string>();
	const used = new Set<string>();

	const unique = (hint: string) => {
		const base = pascalCase(hint);
		let candidate = base;
		let suffix = 2;
		while (used.has(candidate)) {
			candidate = `${base}${suffix}`;
			suffix += 1;
		}
		used.add(candidate);
		return candidate;
	};

	const visit = (node: TypeNode, hint: string) => {
		if (node.kind === "array") {
			visit(node.element, singular(hint));
			return;
		}
		if (node.kind !== "object" || names.has(node)) return;
		const name = unique(hint);
		names.set(node, name);
		named.push({ name, node });
		if (named.length > maximumTypes) throw new Error("This JSON produces over 200 object types. Generate types from a smaller sample.");
		for (const [key, field] of node.fields) visit(field.node, key);
	};

	if (root.kind === "object") visit(root, rootName);
	else if (root.kind === "array" && root.element.kind === "object") visit(root.element, singular(rootName));

	return { named, names };
};

const isOptional = (node: TypeNode) => node.kind === "primitive" && node.kinds.includes("null");
const stripNull = (node: TypeNode): TypeNode => (node.kind === "primitive" ? { kind: "primitive", kinds: node.kinds.filter((kind) => kind !== "null") } : node);

const primitiveKind = (node: PrimitiveNode): "string" | "integer" | "number" | "boolean" | "any" => {
	const kinds = node.kinds.filter((kind) => kind !== "null");
	if (kinds.length === 0) return "any";
	if (kinds.includes("string") && kinds.length === 1) return "string";
	if (kinds.includes("boolean") && kinds.length === 1) return "boolean";
	if (kinds.every((kind) => kind === "integer")) return "integer";
	if (kinds.every((kind) => kind === "integer" || kind === "number")) return "number";
	return "any";
};

const goInitialisms = new Set(["id", "url", "uri", "api", "http", "https", "json", "sql", "xml", "html", "css", "ip", "sku", "uuid", "db", "os", "cpu", "gpu", "ui", "ux", "id"]);

const goFieldName = (key: string) =>
	words(key)
		.map((word) => (goInitialisms.has(word.toLowerCase()) ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`))
		.join("") || "Value";

const goKeywords = new Set(["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var"]);
const pythonKeywords = new Set(["False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"]);
const javaKeywords = new Set(["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void", "volatile", "while", "record"]);
const rustKeywords = new Set(["as", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while", "async", "await", "dyn"]);

const renderGo = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const goType = (node: TypeNode): string => {
		if (node.kind === "array") return `[]${goType(node.element)}`;
		if (node.kind === "object") return names.get(node) ?? "map[string]interface{}";
		switch (primitiveKind(node)) {
			case "string":
				return "string";
			case "boolean":
				return "bool";
			case "integer":
				return "int64";
			case "number":
				return "float64";
			default:
				return "any";
		}
	};
	const aliasName = (() => {
		const base = pascalCase(rootName);
		return names.size > 0 && [...names.values()].includes(base) ? `${base}List` : base;
	})();
	const blocks = named.map(({ name, node }) => {
		const fields = [...node.fields.entries()]
			.map(([key, field]) => {
				const optional = field.optional || isOptional(field.node);
				const type = goType(stripNull(field.node));
				const fieldName = goFieldName(key);
				const safeName = goKeywords.has(fieldName) ? `${fieldName}Value` : fieldName;
				const pointer = optional && type !== "any";
				const tag = pointer ? `json:"${key},omitempty"` : `json:"${key}"`;
				return `\t${safeName} ${pointer ? `*${type}` : type} \`${tag}\``;
			})
			.join("\n");
		return `type ${name} struct {\n${fields}\n}`;
	});
	const alias = root.kind === "array" || root.kind === "primitive" ? `type ${aliasName} ${goType(root)}` : "";
	return ["// Code generated from JSON by ClickKit.", "package model", "", [...blocks, alias].filter(Boolean).join("\n\n"), ""].join("\n").replace(/\n{3,}/gu, "\n\n");
};

const renderRust = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const rustType = (node: TypeNode): string => {
		if (node.kind === "array") return `Vec<${rustType(node.element)}>`;
		if (node.kind === "object") return names.get(node) ?? "serde_json::Value";
		switch (primitiveKind(node)) {
			case "string":
				return "String";
			case "boolean":
				return "bool";
			case "integer":
				return "i64";
			case "number":
				return "f64";
			default:
				return "serde_json::Value";
		}
	};
	const blocks = named.map(({ name, node }) => {
		const fields = [...node.fields.entries()]
			.map(([key, field]) => {
				const optional = field.optional || isOptional(field.node);
				const original = snakeCase(key);
				const safeName = rustKeywords.has(original) ? `r#${original}` : original;
				const type = rustType(stripNull(field.node));
				const lines = [];
				if (safeName !== key) lines.push(`\t#[serde(rename = "${key}")]`);
				if (optional) lines.push('\t#[serde(skip_serializing_if = "Option::is_none", default)]');
				lines.push(`\tpub ${safeName}: ${optional ? `Option<${type}>` : type},`);
				return lines.join("\n");
			})
			.join("\n");
		return `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${name} {\n${fields}\n}`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias = root.kind === "array" || root.kind === "primitive" ? `pub type ${aliasName} = ${rustType(root)};` : "";
	return ["// Code generated from JSON by ClickKit.", "use serde::{Deserialize, Serialize};", "", [...blocks, alias].filter(Boolean).join("\n\n"), ""].join("\n").replace(/\n{3,}/gu, "\n\n");
};

const renderPython = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const pythonType = (node: TypeNode): string => {
		if (node.kind === "array") return `list[${pythonType(node.element)}]`;
		if (node.kind === "object") return names.get(node) ?? "Any";
		switch (primitiveKind(node)) {
			case "string":
				return "str";
			case "boolean":
				return "bool";
			case "integer":
				return "int";
			case "number":
				return "float";
			default:
				return "Any";
		}
	};
	let usesOptional = false;
	const blocks = named.map(({ name, node }) => {
		const entries = [...node.fields.entries()].map(([key, field]) => {
			let original = snakeCase(key);
			if (pythonKeywords.has(original)) original = `${original}_`;
			const type = pythonType(stripNull(field.node));
			const optional = (field.optional || isOptional(field.node)) && type !== "Any";
			if (optional) usesOptional = true;
			return { name: original, optional, type };
		});
		const ordered = [...entries.filter((entry) => !entry.optional), ...entries.filter((entry) => entry.optional)];
		const fields = ordered
			.map((entry) => `    ${entry.name}: ${entry.optional ? `Optional[${entry.type}]` : entry.type}${entry.optional ? " = None" : ""}`)
			.join("\n");
		return `@dataclass\nclass ${name}:\n${fields}`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias = root.kind === "array" || root.kind === "primitive" ? `${aliasName} = ${pythonType(root)}` : "";
	const typingImports = ["Any", ...(usesOptional ? ["Optional"] : [])].join(", ");
	return [
		"# Code generated from JSON by ClickKit.",
		"from __future__ import annotations",
		"",
		"from dataclasses import dataclass",
		`from typing import ${typingImports}`,
		"",
		...blocks.map((block) => `${block}\n`),
		alias ? `${alias}\n` : "",
		"",
	]
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n")
		.replace(/\n@dataclass/gu, "\n\n@dataclass");
};

const renderJava = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const javaType = (node: TypeNode, boxed: boolean): string => {
		if (node.kind === "array") return `List<${javaType(node.element, true)}>`;
		if (node.kind === "object") return names.get(node) ?? "Object";
		switch (primitiveKind(node)) {
			case "string":
				return "String";
			case "boolean":
				return boxed ? "Boolean" : "boolean";
			case "integer":
				return boxed ? "Long" : "long";
			case "number":
				return boxed ? "Double" : "double";
			default:
				return "Object";
		}
	};
	const needsList = named.some(({ node }) => [...node.fields.values()].some((field) => field.node.kind === "array"));
	const records = named.map(({ name, node }) => {
		const parts = [...node.fields.entries()].map(([key, field]) => {
			const optional = field.optional || isOptional(field.node);
			const safeName = javaKeywords.has(camelCase(key)) ? `${camelCase(key)}Value` : camelCase(key);
			return `${javaType(stripNull(field.node), optional)} ${safeName}`;
		});
		return `public record ${name}(${parts.join(", ")}) {}`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias = root.kind === "array" || root.kind === "primitive" ? `public record ${aliasName}(${javaType(root, false)} value) {}` : "";
	return [
		"// Code generated from JSON by ClickKit.",
		needsList ? "import java.util.List;" : "",
		"",
		records.join("\n\n"),
		alias,
		"",
	]
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n");
};

const renderCSharp = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const csType = (node: TypeNode, optional: boolean): string => {
		if (node.kind === "array") return `List<${csType(node.element, false)}>${optional ? "?" : ""}`;
		if (node.kind === "object") return `${names.get(node) ?? "JsonElement"}${optional ? "?" : ""}`;
		switch (primitiveKind(node)) {
			case "string":
				return `string${optional ? "?" : ""}`;
			case "boolean":
				return `bool${optional ? "?" : ""}`;
			case "integer":
				return `long${optional ? "?" : ""}`;
			case "number":
				return `double${optional ? "?" : ""}`;
			default:
				return `JsonElement${optional ? "?" : ""}`;
		}
	};
	let usesJsonElement = false;
	const records = named.map(({ name, node }) => {
		const parameters = [...node.fields.entries()].map(([key, field]) => {
			const optional = field.optional || isOptional(field.node);
			const type = csType(stripNull(field.node), optional);
			if (type.includes("JsonElement")) usesJsonElement = true;
			const property = pascalCase(key) || "Value";
			const attribute = property === key ? "" : `[property: JsonPropertyName("${key}")] `;
			return `    ${attribute}${type} ${property}${optional ? " = default" : ""}`;
		});
		return `public sealed record ${name}(\n${parameters.join(",\n")}\n);`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias =
		root.kind === "array" || root.kind === "primitive"
			? `public sealed record ${aliasName}(${csType(root, false)} Value);`
			: "";
	return [
		"// Code generated from JSON by ClickKit.",
		"using System.Collections.Generic;",
		"using System.Text.Json;",
		"using System.Text.Json.Serialization;",
		"",
		"namespace Models;",
		"",
		[...records, alias].filter(Boolean).join("\n\n"),
		usesJsonElement ? "// JsonElement keeps values whose shape could not be narrowed." : "",
		"",
	]
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n");
};

const kotlinKeywords = new Set(["as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var", "when", "while"]);

const renderKotlin = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const kotlinType = (node: TypeNode, optional: boolean): string => {
		if (node.kind === "array") return `List<${kotlinType(node.element, false)}>${optional ? "?" : ""}`;
		if (node.kind === "object") return `${names.get(node) ?? "JsonElement"}${optional ? "?" : ""}`;
		const suffix = optional ? "?" : "";
		switch (primitiveKind(node)) {
			case "string":
				return `String${suffix}`;
			case "boolean":
				return `Boolean${suffix}`;
			case "integer":
				return `Long${suffix}`;
			case "number":
				return `Double${suffix}`;
			default:
				return `JsonElement${suffix}`;
		}
	};
	let usesJsonElement = false;
	const blocks = named.map(({ name, node }) => {
		const fields = [...node.fields.entries()].map(([key, field]) => {
			const optional = field.optional || isOptional(field.node);
			const type = kotlinType(stripNull(field.node), optional);
			if (type.includes("JsonElement")) usesJsonElement = true;
			const raw = key.replace(/[^A-Za-z0-9_]/gu, "_");
			const property = kotlinKeywords.has(raw) ? `\`${raw}\`` : raw;
			const annotation = property === key ? "" : `\n    @SerialName("${key}")`;
			return `${annotation}\n    val ${property}: ${type}${optional ? " = null" : ""}`;
		});
		return `@Serializable\ndata class ${name}(${fields.join(",")}\n)`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias = root.kind === "array" || root.kind === "primitive" ? `typealias ${aliasName} = ${kotlinType(root, false)}` : "";
	return [
		"// Code generated from JSON by ClickKit.",
		"import kotlinx.serialization.SerialName",
		"import kotlinx.serialization.Serializable",
		...(usesJsonElement ? ["import kotlinx.serialization.json.JsonElement"] : []),
		"",
		[...blocks, alias].filter(Boolean).join("\n\n"),
		"",
	]
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n");
};

const swiftKeywords = new Set(["associatedtype", "class", "deinit", "enum", "extension", "fileprivate", "func", "import", "init", "inout", "internal", "let", "open", "operator", "private", "protocol", "public", "rethrows", "static", "struct", "subscript", "typealias", "var", "break", "case", "continue", "default", "defer", "do", "else", "fallthrough", "for", "guard", "if", "in", "repeat", "return", "switch", "where", "while", "as", "Any", "catch", "false", "is", "nil", "super", "self", "Self", "throw", "throws", "true", "try", "Type"]);

const renderSwift = (named: Named[], names: Map<TypeNode, string>, root: TypeNode, rootName: string) => {
	const swiftType = (node: TypeNode, optional: boolean): string => {
		if (node.kind === "array") return `[${swiftType(node.element, false)}]${optional ? "?" : ""}`;
		if (node.kind === "object") return `${names.get(node) ?? "JSONValue"}${optional ? "?" : ""}`;
		const suffix = optional ? "?" : "";
		switch (primitiveKind(node)) {
			case "string":
				return `String${suffix}`;
			case "boolean":
				return `Bool${suffix}`;
			case "integer":
				return `Int64${suffix}`;
			case "number":
				return `Double${suffix}`;
			default:
				return `JSONValue${suffix}`;
		}
	};
	let usesJsonValue = false;
	const structs = named.map(({ name, node }) => {
		const renames: string[] = [];
		const fields = [...node.fields.entries()].map(([key, field]) => {
			const optional = field.optional || isOptional(field.node);
			const type = swiftType(stripNull(field.node), optional);
			if (type.includes("JSONValue")) usesJsonValue = true;
			const raw = camelCase(key) || "value";
			const property = swiftKeywords.has(raw) ? `\`${raw}\`` : raw;
			if (property !== key) renames.push(`        case ${property.replaceAll("`", "")} = "${key}"`);
			return `    let ${property}: ${type}`;
		});
		const codingKeys = renames.length ? `\n\n    enum CodingKeys: String, CodingKey {\n${renames.join("\n")}\n    }` : "";
		return `struct ${name}: Codable {\n${fields.join("\n")}${codingKeys}\n}`;
	});
	const aliasBase = pascalCase(rootName);
	const aliasName = [...names.values()].includes(aliasBase) ? `${aliasBase}List` : aliasBase;
	const alias = root.kind === "array" || root.kind === "primitive" ? `typealias ${aliasName} = ${swiftType(root, false)}` : "";
	return [
		"// Code generated from JSON by ClickKit.",
		"import Foundation",
		"",
		usesJsonValue ? "/// JSONValue stands in for values whose shape could not be narrowed; supply your own decoder." : "",
		[...structs, alias].filter(Boolean).join("\n\n"),
		"",
	]
		.join("\n")
		.replace(/\n{3,}/gu, "\n\n");
};

export const jsonToCode = (source: string, language: CodeLanguage, rootName = "Root") => {
	const value = parseJson(source);
	if (!rootName.trim()) throw new Error("Give the root type a name.");
	const root = infer(value, 0);
	const { named, names } = collectTypes(root, rootName.trim());
	const safeRootName = pascalCase(rootName);
	if (language === "go") return renderGo(named, names, root, safeRootName);
	if (language === "rust") return renderRust(named, names, root, safeRootName);
	if (language === "python") return renderPython(named, names, root, safeRootName);
	if (language === "csharp") return renderCSharp(named, names, root, safeRootName);
	if (language === "kotlin") return renderKotlin(named, names, root, safeRootName);
	if (language === "swift") return renderSwift(named, names, root, safeRootName);
	return renderJava(named, names, root, safeRootName);
};
