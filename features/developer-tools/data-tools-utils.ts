import Ajv2020, { type AnySchema } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { JSONPath } from "jsonpath-plus";
import type { HashAlgorithm } from "@/features/developer-tools/additional-developer-utils";

const maximumSourceLength = 1_000_000;
const maximumFileBytes = 64 * 1024 * 1024;
const maximumQueryLength = 2_000;
const maximumSchemaLength = 250_000;
const maximumValidationErrors = 100;

export type CsvDelimiter = "," | ";" | "\t";

const parseCsvRows = (source: string, delimiter: CsvDelimiter) => {
	if (!source.trim()) throw new Error("Paste CSV data to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep CSV input under one million characters.");
	const text = source.replace(/^\uFEFF/u, "");
	const rows: string[][] = [];
	let row: string[] = [];
	let value = "";
	let quoted = false;
	let closedQuote = false;
	const pushRow = () => {
		row.push(value);
		if (row.length > 1 || row[0] !== "") rows.push(row);
		row = [];
		value = "";
		closedQuote = false;
	};
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quoted) {
			if (character === '"' && text[index + 1] === '"') {
				value += '"';
				index += 1;
			} else if (character === '"') {
				quoted = false;
				closedQuote = true;
			} else value += character;
			continue;
		}
		if (closedQuote && character !== delimiter && character !== "\n" && character !== "\r" && character !== " ") {
			throw new Error(`Unexpected character after a closing quote near row ${rows.length + 1}.`);
		}
		if (character === '"') {
			if (value.length > 0 || closedQuote) throw new Error(`Unexpected quote in an unquoted field near row ${rows.length + 1}.`);
			quoted = true;
			continue;
		}
		if (character === delimiter) {
			row.push(value);
			value = "";
			closedQuote = false;
			continue;
		}
		if (character === "\n" || character === "\r") {
			if (character === "\r" && text[index + 1] === "\n") index += 1;
			pushRow();
			continue;
		}
		if (!closedQuote) value += character;
	}
	if (quoted) throw new Error(`CSV contains an unclosed quoted field near row ${rows.length + 1}.`);
	if (row.length > 0 || value.length > 0 || closedQuote) pushRow();
	if (rows.length === 0) throw new Error("CSV does not contain any non-empty rows.");
	return rows;
};

const uniqueHeaders = (source: string[]) => {
	const seen = new Map<string, number>();
	return source.map((header, index) => {
		const base = header.trim() || `column_${index + 1}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return count === 1 ? base : `${base}_${count}`;
	});
};

export const csvToJson = (source: string, delimiter: CsvDelimiter = ",", hasHeader = true) => {
	const rows = parseCsvRows(source, delimiter);
	if (!hasHeader) return JSON.stringify(rows, null, 2);
	const headers = uniqueHeaders(rows[0]);
	const records = rows.slice(1).map((cells, index) => {
		if (cells.length !== headers.length) {
			throw new Error(`CSV row ${index + 2} has ${cells.length} fields; expected ${headers.length}.`);
		}
		const record: Record<string, string> = Object.create(null) as Record<string, string>;
		headers.forEach((header, column) => {
			record[header] = cells[column];
		});
		return record;
	});
	return JSON.stringify(records, null, 2);
};

const csvCell = (value: unknown, delimiter: CsvDelimiter) => {
	const cell =
		value === null || value === undefined
			? ""
			: typeof value === "string"
				? value
				: typeof value === "object"
				? JSON.stringify(value)
				: String(value);
	return cell.includes(delimiter) || /["\r\n]/u.test(cell) || /^\s|\s$/u.test(cell)
		? `"${cell.replaceAll('"', '""')}"`
		: cell;
};

export const jsonToCsv = (source: string, delimiter: CsvDelimiter = ",") => {
	if (!source.trim()) throw new Error("Paste a JSON array of objects to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under one million characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	if (!Array.isArray(value) || value.length === 0 || value.some((item) => item === null || Array.isArray(item) || typeof item !== "object")) {
		throw new Error("JSON to CSV requires a non-empty array of objects.");
	}
	const records = value as Record<string, unknown>[];
	const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
	if (headers.length === 0) throw new Error("Each JSON record needs at least one property for a CSV column.");
	return [
		headers.map((header) => csvCell(header, delimiter)).join(delimiter),
		...records.map((record) => headers.map((header) => csvCell(record[header], delimiter)).join(delimiter)),
	].join("\r\n");
};

export type JsonPathMatch = { pointer: string; value: unknown };

export const queryJsonPath = (source: string, query: string): JsonPathMatch[] => {
	if (!source.trim()) throw new Error("Paste JSON to query first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under one million characters.");
	const trimmedQuery = query.trim();
	if (!trimmedQuery) throw new Error("Enter a JSONPath query.");
	if (!trimmedQuery.startsWith("$")) throw new Error("JSONPath queries must start with $ (for example, $.items[*]).");
	if (query.length > maximumQueryLength) throw new Error("Keep JSONPath queries under 2,000 characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	let results: unknown;
	try {
		results = JSONPath({ path: trimmedQuery, json: value, resultType: "all", wrap: true, eval: "safe" });
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSONPath query: ${error.message}` : "Invalid JSONPath query.");
	}
	if (!Array.isArray(results)) throw new Error("This query did not return a list of matches.");
	if (results.length > 1_000) throw new Error("This query returned over 1,000 matches. Narrow the query.");
	return results.map((item) => {
		if (item === null || typeof item !== "object") throw new Error("Could not interpret a JSONPath match.");
		const result = item as { pointer?: unknown; path?: unknown; value?: unknown };
		const pointer =
			typeof result.pointer === "string"
				? result.pointer || "$ (root)"
				: Array.isArray(result.path)
					? JSON.stringify(result.path)
					: "$ (root)";
		return { pointer, value: result.value };
	});
};

export type SchemaValidationIssue = { path: string; keyword: string; message: string };
export type SchemaValidationResult = { valid: boolean; issues: SchemaValidationIssue[]; omittedIssues: number };

export const validateJsonSchema = (dataSource: string, schemaSource: string): SchemaValidationResult => {
	if (!dataSource.trim() || !schemaSource.trim()) throw new Error("Provide both a JSON value and a JSON Schema.");
	if (dataSource.length > maximumSourceLength) throw new Error("Keep JSON data under one million characters.");
	if (schemaSource.length > maximumSchemaLength) throw new Error("Keep JSON Schema input under 250,000 characters.");
	let data: unknown;
	let schema: unknown;
	try {
		data = JSON.parse(dataSource) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `JSON data is invalid: ${error.message}` : "JSON data is invalid.");
	}
	try {
		schema = JSON.parse(schemaSource) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `JSON Schema is invalid JSON: ${error.message}` : "JSON Schema is invalid JSON.");
	}
	if (schema === null || (typeof schema !== "object" && typeof schema !== "boolean") || Array.isArray(schema)) {
		throw new Error("A JSON Schema must be a schema object or a boolean.");
	}
	try {
		const validator = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
		addFormats(validator);
		const validate = validator.compile(schema as AnySchema);
		const valid = validate(data) === true;
		const errors = validate.errors ?? [];
		return {
			valid,
			issues: errors.slice(0, maximumValidationErrors).map((error) => ({
				path: error.instancePath || "$ (root)",
				keyword: error.keyword,
				message: error.message ?? "Does not satisfy the schema.",
			})),
			omittedIssues: Math.max(0, errors.length - maximumValidationErrors),
		};
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not validate with this schema: ${error.message}` : "Could not compile this schema.");
	}
};

export type FileDigest = { fileName: string; size: number; algorithm: HashAlgorithm; digest: string };

export const maximumHashFileBytes = maximumFileBytes;

export const hashFile = async (
	file: Blob & { name?: string },
	algorithm: HashAlgorithm,
	subtle: SubtleCrypto | null = globalThis.crypto?.subtle,
): Promise<FileDigest> => {
	if (file.size > maximumFileBytes) throw new Error("Keep files at or below 64 MiB to hash them in this browser.");
	if (!subtle) throw new Error("Secure file hashing is not available in this browser context.");
	let bytes: ArrayBuffer;
	try {
		bytes = await file.arrayBuffer();
	} catch {
		throw new Error("Could not read this file in the browser.");
	}
	const digest = await subtle.digest(algorithm, bytes);
	return {
		fileName: file.name || "Selected file",
		size: file.size,
		algorithm,
		digest: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
	};
};

const gitignoreTemplates = [
	{
		id: "node",
		label: "Node.js / Next.js",
		contents: ["node_modules/", ".next/", "out/", "coverage/", "dist/", "build/", "npm-debug.log*", ".env*", "!.env.example"],
	},
	{
		id: "python",
		label: "Python",
		contents: ["__pycache__/", "*.py[cod]", ".venv/", "venv/", ".pytest_cache/", ".mypy_cache/", "dist/", "build/", "*.egg-info/"],
	},
	{
		id: "rust",
		label: "Rust",
		contents: ["/target/", "**/*.rs.bk", "Cargo.lock"],
	},
	{
		id: "go",
		label: "Go",
		contents: ["/bin/", "*.exe", "*.test", "*.out", "vendor/"],
	},
	{
		id: "vscode",
		label: "Visual Studio Code",
		contents: [".vscode/*", "!.vscode/extensions.json", "!.vscode/settings.json"],
	},
	{
		id: "macos",
		label: "macOS",
		contents: [".DS_Store", ".AppleDouble", ".LSOverride", "._*", ".Spotlight-V100/", ".Trashes/"],
	},
	{
		id: "windows",
		label: "Windows",
		contents: ["Thumbs.db", "Thumbs.db:encryptable", "Desktop.ini", "$RECYCLE.BIN/", "*.lnk"],
	},
] as const;

export type GitignoreTemplateId = (typeof gitignoreTemplates)[number]["id"];
export const gitignoreTemplateOptions = gitignoreTemplates.map(({ id, label }) => ({ id, label }));

export const generateGitignore = (selected: readonly GitignoreTemplateId[]) => {
	if (selected.length === 0) throw new Error("Choose at least one project or operating-system template.");
	const selectedTemplates = selected.map((id) => {
		const template = gitignoreTemplates.find((item) => item.id === id);
		if (!template) throw new Error("Choose a supported .gitignore template.");
		return template;
	});
	const lines = [...new Set(selectedTemplates.flatMap(({ contents }) => contents))];
	return `# Generated for ${selectedTemplates.map(({ label }) => label).join(", ")}\n\n${lines.join("\n")}\n`;
};
