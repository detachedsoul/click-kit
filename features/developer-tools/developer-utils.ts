export type JsonOutputMode = "pretty" | "minify";
export type TimestampUnit = "seconds" | "milliseconds";
export type RegexMatch = { text: string; index: number; captures: (string | undefined)[] };

const maximumTextLength = 1_000_000;

export const formatJson = (source: string, mode: JsonOutputMode) => {
	if (!source.trim()) throw new Error("Paste JSON to format first.");
	if (source.length > maximumTextLength) throw new Error("Keep JSON under one million characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid JSON: ${error.message}`
				: "Invalid JSON. Check commas, quotes, and brackets.",
		);
	}
	const output = JSON.stringify(value, null, mode === "pretty" ? 2 : undefined);
	if (output === undefined) throw new Error("Could not serialize this JSON value.");
	return output;
};

export type JsonTypeMode = "strict" | "flexible";

const isIdentifier = (value: string) => /^[$_\p{ID_Start}][$\u200c\u200d_\p{ID_Continue}]*$/u.test(value);

const reservedTypeNames = new Set([
	"abstract",
	"any",
	"as",
	"asserts",
	"bigint",
	"boolean",
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"function",
	"if",
	"implements",
	"import",
	"in",
	"infer",
	"instanceof",
	"interface",
	"is",
	"keyof",
	"let",
	"module",
	"namespace",
	"never",
	"new",
	"null",
	"number",
	"object",
	"out",
	"override",
	"package",
	"private",
	"protected",
	"public",
	"readonly",
	"require",
	"return",
	"satisfies",
	"set",
	"static",
	"string",
	"super",
	"switch",
	"symbol",
	"this",
	"throw",
	"true",
	"try",
	"typeof",
	"type",
	"undefined",
	"unique",
	"unknown",
	"var",
	"void",
	"while",
	"with",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

const uniqueTypes = (values: unknown[], indentation: string, mode: JsonTypeMode) =>
	[...new Set(values.map((item) => inferType(item, indentation, mode)))].join(" | ");

const mergeObjectShapes = (objects: Record<string, unknown>[], indentation: string, mode: JsonTypeMode) => {
	const observations = new Map<string, unknown[]>();
	for (const object of objects) {
		for (const [key, value] of Object.entries(object)) {
			const values = observations.get(key);
			if (values) values.push(value);
			else observations.set(key, [value]);
		}
	}
	if (observations.size === 0) return "Record<string, unknown>";
	const properties = [...observations].map(([key, values]) => {
		const optional = values.length < objects.length ? "?" : "";
		return `${indentation}\t${isIdentifier(key) ? key : JSON.stringify(key)}${optional}: ${inferObservedValues(values, `${indentation}\t`, mode)};`;
	});
	return `{\n${properties.join("\n")}\n${indentation}}`;
};

const inferObservedValues = (values: unknown[], indentation: string, mode: JsonTypeMode): string => {
	if (values.length === 0) return "unknown";
	if (mode === "strict") return uniqueTypes(values, indentation, mode);

	const types: string[] = [];
	const objects = values.filter(isRecord);
	const arrays = values.filter(Array.isArray);
	const scalars = values.filter((value) => !isRecord(value) && !Array.isArray(value));
	if (objects.length > 0) types.push(mergeObjectShapes(objects, indentation, mode));
	if (arrays.length > 0) types.push(`Array<${inferArrayElementType(arrays.flat(), indentation, mode)}>`);
	if (scalars.length > 0) types.push(uniqueTypes(scalars, indentation, mode));
	return types.join(" | ");
};

const inferArrayElementType = (values: unknown[], indentation: string, mode: JsonTypeMode): string =>
	inferObservedValues(values, indentation, mode);

const inferType = (value: unknown, indentation: string, mode: JsonTypeMode): string => {
	if (value === null) return "null";
	if (typeof value === "string") return "string";
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "boolean";
	if (Array.isArray(value)) {
		if (value.length === 0) return "unknown[]";
		return `Array<${inferArrayElementType(value, indentation, mode)}>`;
	}
	if (isRecord(value)) {
		const entries = Object.entries(value);
		if (entries.length === 0) return "Record<string, unknown>";
		const properties = entries.map(
			([key, item]) =>
				`${indentation}\t${isIdentifier(key) ? key : JSON.stringify(key)}: ${inferType(item, `${indentation}\t`, mode)};`,
		);
		return `{\n${properties.join("\n")}\n${indentation}}`;
	}
	return "unknown";
};

export const jsonToTypeScript = (source: string, typeName = "Root", mode: JsonTypeMode = "strict") => {
	if (!source.trim()) throw new Error("Paste a JSON example first.");
	if (source.length > maximumTextLength) throw new Error("Keep JSON under one million characters.");
	if (!isIdentifier(typeName) || reservedTypeNames.has(typeName)) {
		throw new Error("Type name must be a non-reserved TypeScript identifier.");
	}
	if (mode !== "strict" && mode !== "flexible")
		throw new Error("Choose strict or flexible TypeScript inference mode.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid JSON: ${error.message}`
				: "Invalid JSON. Check commas, quotes, and brackets.",
		);
	}
	return `export type ${typeName} = ${inferType(value, "", mode)};`;
};

export const maximumBinaryBytes = 8_000_000;
const maximumBase64Length = Math.ceil(maximumBinaryBytes / 3) * 4 + 4096;

export type DecodedBase64 = { bytes: Uint8Array; mimeType: string | null };

export const isValidMimeType = (mimeType: string) => /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/u.test(mimeType);

export const encodeBase64Bytes = (bytes: Uint8Array) => {
	if (bytes.byteLength > maximumBinaryBytes)
		throw new Error("Keep binary files under 8 MB to encode them in the browser.");
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
};

export const decodeBase64Bytes = (source: string): DecodedBase64 => {
	if (source.length > maximumBase64Length)
		throw new Error("Keep Base64 input under 10.7 MB to decode it in the browser.");
	let payload = source.trim();
	let mimeType: string | null = null;
	if (/^data:/iu.test(payload)) {
		const dataUri = payload.match(/^data:([^,]*);base64,([\s\S]*)$/iu);
		if (!dataUri) throw new Error("Enter a valid Base64 data URL or raw Base64 value.");
		const metadata = dataUri[1].split(";");
		mimeType = metadata[0] || null;
		if (mimeType && !isValidMimeType(mimeType)) {
			throw new Error("This data URL has an invalid MIME type.");
		}
		payload = dataUri[2];
	}
	const compact = payload.replace(/\s/gu, "");
	if (
		!/^[A-Z\d+/_-]*={0,2}$/iu.test(compact) ||
		((compact.includes("+") || compact.includes("/")) && (compact.includes("-") || compact.includes("_"))) ||
		compact.length % 4 === 1 ||
		(compact.includes("=") && compact.length % 4 !== 0)
	) {
		throw new Error("Enter valid Base64 text.");
	}
	const standard = compact.replaceAll("-", "+").replaceAll("_", "/");
	const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
	let binary: string;
	try {
		binary = atob(padded);
	} catch {
		throw new Error("Enter valid Base64 text.");
	}
	if (binary.length > maximumBinaryBytes) throw new Error("Decoded files must be 8 MB or smaller.");
	if (btoa(binary) !== padded) throw new Error("Enter valid Base64 text with canonical padding bits.");
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return { bytes, mimeType };
};

export const encodeBase64 = (source: string) => {
	if (source.length > maximumTextLength) throw new Error("Keep text under one million characters.");
	return encodeBase64Bytes(new TextEncoder().encode(source));
};

export const decodeBase64 = (source: string) => {
	if (source.length > maximumTextLength) throw new Error("Keep Base64 text under one million characters.");
	const { bytes } = decodeBase64Bytes(source);
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new Error("Decoded bytes are not valid UTF-8 text. Switch to File mode to handle binary data.");
	}
};

export const generateUuidV4 = () => {
	const cryptoApi = globalThis.crypto;
	if (!cryptoApi?.getRandomValues) throw new Error("Secure random generation is not available in this browser.");
	const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

export const findRegexMatches = (source: string, pattern: string, flags: string): RegexMatch[] => {
	if (source.length > 100_000) throw new Error("Keep text under 100,000 characters to test a pattern.");
	if (pattern.length > 500) throw new Error("Keep the regular expression under 500 characters.");
	if (!pattern) throw new Error("Enter a regular expression first.");
	let expression: RegExp;
	try {
		expression = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
	} catch (error) {
		throw new Error(
			error instanceof Error
				? `Invalid regular expression: ${error.message}`
				: "Invalid regular expression or flags.",
		);
	}
	const matches: RegexMatch[] = [];
	let match: RegExpExecArray | null;
	while ((match = expression.exec(source)) !== null) {
		if (matches.length === 1000)
			throw new Error("This pattern matches more than 1,000 results. Narrow the pattern or input.");
		matches.push({ text: match[0], index: match.index, captures: match.slice(1) });
		if (match[0] === "") {
			const currentCodePoint = source.codePointAt(expression.lastIndex);
			expression.lastIndex +=
				expression.unicode && currentCodePoint !== undefined && currentCodePoint > 0xffff ? 2 : 1;
		}
	}
	return matches;
};

export const timestampToIso = (timestamp: number, unit: TimestampUnit) => {
	if (!Number.isFinite(timestamp)) throw new Error("Enter a finite timestamp.");
	const milliseconds = unit === "seconds" ? timestamp * 1000 : timestamp;
	const date = new Date(milliseconds);
	if (!Number.isFinite(date.getTime())) throw new Error("This timestamp is outside the supported date range.");
	return date.toISOString();
};

export const isoToTimestamp = (isoDate: string, unit: TimestampUnit) => {
	if (!isoDate.trim()) throw new Error("Enter an ISO 8601 date and time.");
	const fields = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u);
	if (!fields) throw new Error("Enter an ISO 8601 date and time with a timezone, such as 2025-03-08T12:00:00Z.");
	const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = fields;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] || hour > 23 || minute > 59 || second > 59) {
		throw new Error("Enter a valid ISO 8601 calendar date and time.");
	}
	if (zone !== "Z") {
		const [zoneHours, zoneMinutes] = zone.slice(1).split(":").map(Number);
		if (zoneHours > 23 || zoneMinutes > 59) throw new Error("Enter a valid ISO 8601 timezone offset.");
	}
	const milliseconds = Date.parse(isoDate);
	if (!Number.isFinite(milliseconds)) throw new Error("This ISO 8601 date is outside the supported range.");
	return unit === "seconds" ? milliseconds / 1000 : milliseconds;
};
