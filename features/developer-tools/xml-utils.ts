import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

const maximumSourceLength = 200_000;
const xmlNamePattern = /^[A-Za-z_][\w.-]*$/u;

const parserOptions = { ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" } as const;

const parser = (includeAttributes: boolean) =>
	new XMLParser({
		...parserOptions,
		ignoreAttributes: !includeAttributes,
		parseTagValue: false,
		parseAttributeValue: false,
		trimValues: true,
		ignoreDeclaration: true,
		processEntities: true,
	});

const builder = (includeAttributes: boolean) =>
	new XMLBuilder({
		...parserOptions,
		ignoreAttributes: !includeAttributes,
		format: true,
		indentBy: "  ",
		suppressEmptyNode: true,
	});

export type XmlJsonOptions = { includeAttributes?: boolean; rootName?: string };

export const xmlToJson = (source: string, { includeAttributes = true }: XmlJsonOptions = {}) => {
	if (!source.trim()) throw new Error("Paste XML to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep XML input under 200,000 characters.");
	const validation = XMLValidator.validate(source);
	if (validation !== true) {
		const { msg, line, col } = validation.err;
		throw new Error(`Invalid XML at line ${line}, column ${col}: ${msg}`);
	}
	let value: unknown;
	try {
		value = parser(includeAttributes).parse(source);
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid XML: ${error.message}` : "Invalid XML.");
	}
	return JSON.stringify(value ?? {}, null, 2);
};

const assertXmlSafe = (value: unknown, path: string) => {
	if (typeof value === "string") {
		if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
			throw new Error(`XML 1.0 cannot contain control characters (found one at ${path}).`);
		}
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertXmlSafe(item, `${path}[${index}]`));
		return;
	}
	if (value && typeof value === "object") {
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) assertXmlSafe(item, path ? `${path}.${key}` : key);
	}
};

export const jsonToXml = (source: string, { includeAttributes = true, rootName = "root" }: XmlJsonOptions = {}) => {
	if (!source.trim()) throw new Error("Paste JSON to convert first.");
	if (source.length > maximumSourceLength) throw new Error("Keep JSON input under 200,000 characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	if (value === null || typeof value !== "object") throw new Error("JSON to XML needs an object or an array of values at the root.");
	assertXmlSafe(value, "");
	const keys = Array.isArray(value) ? [] : Object.keys(value as Record<string, unknown>);
	const needsWrapper = Array.isArray(value) || keys.length !== 1;
	if (needsWrapper) {
		if (!xmlNamePattern.test(rootName.trim())) throw new Error("Root element names must start with a letter or underscore and contain only letters, digits, dots, dashes, or underscores.");
		value = { [rootName.trim()]: value };
	}
	try {
		return builder(includeAttributes).build(value as Record<string, unknown>);
	} catch (error) {
		throw new Error(error instanceof Error ? `Could not build XML: ${error.message}` : "Could not build XML.");
	}
};
