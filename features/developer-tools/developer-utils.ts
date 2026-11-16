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
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON. Check commas, quotes, and brackets.");
	}
	const output = JSON.stringify(value, null, mode === "pretty" ? 2 : undefined);
	if (output === undefined) throw new Error("Could not serialize this JSON value.");
	return output;
};

const isIdentifier = (value: string) => /^[$A-Z_a-z][$\w]*$/u.test(value);

const inferType = (value: unknown, indentation: string): string => {
	if (value === null) return "null";
	if (typeof value === "string") return "string";
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "boolean";
	if (Array.isArray(value)) {
		if (value.length === 0) return "unknown[]";
		const alternatives = [...new Set(value.map((item) => inferType(item, indentation)))];
		return `Array<${alternatives.join(" | ")}>`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value);
		if (entries.length === 0) return "Record<string, unknown>";
		const properties = entries.map(([key, item]) => `${indentation}\t${isIdentifier(key) ? key : JSON.stringify(key)}: ${inferType(item, `${indentation}\t`)};`);
		return `{\n${properties.join("\n")}\n${indentation}}`;
	}
	return "unknown";
};

export const jsonToTypeScript = (source: string, typeName = "Root") => {
	if (!source.trim()) throw new Error("Paste a JSON example first.");
	if (source.length > maximumTextLength) throw new Error("Keep JSON under one million characters.");
	if (!/^[$A-Z_a-z][$\w]*$/u.test(typeName)) throw new Error("Type name must be a valid TypeScript identifier.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON. Check commas, quotes, and brackets.");
	}
	return `export type ${typeName} = ${inferType(value, "")};`;
};

export const encodeBase64 = (source: string) => {
	if (source.length > maximumTextLength) throw new Error("Keep text under one million characters.");
	const bytes = new TextEncoder().encode(source);
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary);
};

export const decodeBase64 = (source: string) => {
	if (source.length > maximumTextLength) throw new Error("Keep Base64 input under one million characters.");
	const compact = source.replace(/\s/gu, "");
	if (!/^[A-Z\d+/_-]*={0,2}$/iu.test(compact) || compact.length % 4 === 1) throw new Error("Enter valid Base64 text.");
	const standard = compact.replaceAll("-", "+").replaceAll("_", "/");
	const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, "=");
	let binary: string;
	try {
		binary = atob(padded);
	} catch {
		throw new Error("Enter valid Base64 text.");
	}
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new Error("This Base64 value does not contain valid UTF-8 text.");
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
		throw new Error(error instanceof Error ? `Invalid regular expression: ${error.message}` : "Invalid regular expression or flags.");
	}
	const matches: RegexMatch[] = [];
	let match: RegExpExecArray | null;
	while ((match = expression.exec(source)) !== null) {
		if (matches.length === 1000) throw new Error("This pattern matches more than 1,000 results. Narrow the pattern or input.");
		matches.push({ text: match[0], index: match.index, captures: match.slice(1) });
		if (match[0] === "") {
			const currentCodePoint = source.codePointAt(expression.lastIndex);
			expression.lastIndex += expression.unicode && currentCodePoint !== undefined && currentCodePoint > 0xffff ? 2 : 1;
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
