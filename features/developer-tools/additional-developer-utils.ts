import type { SqlLanguage } from "sql-formatter";
import { decodeBase64 } from "@/features/developer-tools/developer-utils";

export type HashAlgorithm = "SHA-256" | "SHA-384" | "SHA-512";
export type ColorValue = { hex: string; rgb: string; hsl: string; alpha: number };
export type JwtPayload = Record<string, unknown>;
type RgbaTuple = [red: number, green: number, blue: number, alpha: number];

type UrlQueryEntry = { name: string; value: string };
export type UrlInspection = {
	url: string;
	protocol: string;
	origin: string;
	host: string;
	pathname: string;
	fragment: string;
	query: UrlQueryEntry[];
};

const maximumInputLength = 1_000_000;

export const inspectUrl = (source: string): UrlInspection => {
	if (!source.trim()) throw new Error("Enter an absolute HTTP or HTTPS URL.");
	if (source.length > maximumInputLength) throw new Error("Keep URLs under one million characters.");
	let parsed: URL;
	try {
		parsed = new URL(source.trim());
	} catch {
		throw new Error("Enter a complete URL, including https:// or http://.");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
		throw new Error("Only HTTP and HTTPS URLs can be inspected.");
	const normalized = new URL(parsed.href);
	if (normalized.username || normalized.password) {
		normalized.username = "";
		normalized.password = "";
	}
	return {
		url: normalized.href,
		protocol: parsed.protocol,
		origin: parsed.origin,
		host: parsed.host,
		pathname: parsed.pathname,
		fragment: parsed.hash,
		query: [...parsed.searchParams.entries()].map(([name, value]) => ({ name, value })),
	};
};

export const hashText = async (
	source: string,
	algorithm: HashAlgorithm,
	subtle: SubtleCrypto | null = globalThis.crypto?.subtle,
) => {
	if (source.length > maximumInputLength) throw new Error("Keep text under one million characters to hash it.");
	if (!subtle) throw new Error("Secure hashing is not available in this browser context.");
	const digest = await subtle.digest(algorithm, new TextEncoder().encode(source));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const formatSql = async (source: string, language: SqlLanguage) => {
	if (!source.trim()) throw new Error("Paste a SQL query to format first.");
	if (source.length > 250_000) throw new Error("Keep SQL input under 250,000 characters.");
	const { format } = await import("sql-formatter");
	return format(source, { language, keywordCase: "upper", tabWidth: 2 });
};

const parseAlpha = (input: string) => {
	const alpha = input.endsWith("%") ? Number(input.slice(0, -1)) / 100 : Number(input);
	if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)
		throw new Error("Alpha must be between 0 and 1, or 0% and 100%.");
	return alpha;
};

const makeColor = (red: number, green: number, blue: number, alpha = 1): ColorValue => {
	if (
		![red, green, blue].every(Number.isFinite) ||
		[red, green, blue].some((channel) => channel < 0 || channel > 255)
	) {
		throw new Error("RGB channels must be between 0 and 255.");
	}
	if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error("Alpha must be between 0 and 1.");
	const byteHex = (channel: number) => Math.round(channel).toString(16).padStart(2, "0");
	const hex = `#${byteHex(red)}${byteHex(green)}${byteHex(blue)}${alpha < 1 ? byteHex(alpha * 255) : ""}`;
	const rgb =
		alpha < 1
			? `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${Number(alpha.toFixed(3))})`
			: `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
	const normalized = [red, green, blue].map((channel) => channel / 255);
	const maximum = Math.max(...normalized);
	const minimum = Math.min(...normalized);
	const delta = maximum - minimum;
	const lightness = (maximum + minimum) / 2;
	let hue = 0;
	let saturation = 0;
	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		if (maximum === normalized[0]) hue = ((normalized[1] - normalized[2]) / delta) % 6;
		else if (maximum === normalized[1]) hue = (normalized[2] - normalized[0]) / delta + 2;
		else hue = (normalized[0] - normalized[1]) / delta + 4;
		hue *= 60;
		if (hue < 0) hue += 360;
	}
	const compact = (value: number) => Number(value.toFixed(1)).toString();
	const hsl =
		alpha < 1
			? `hsla(${compact(hue)}, ${compact(saturation * 100)}%, ${compact(lightness * 100)}%, ${Number(alpha.toFixed(3))})`
			: `hsl(${compact(hue)}, ${compact(saturation * 100)}%, ${compact(lightness * 100)}%)`;
	return { hex, rgb, hsl, alpha };
};

const parseHexColor = (source: string) => {
	const hex = source.slice(1);
	if (hex.length === 3 || hex.length === 4) {
		const [red, green, blue, alpha = "f"] = hex;
		return [
			Number.parseInt(red + red, 16),
			Number.parseInt(green + green, 16),
			Number.parseInt(blue + blue, 16),
			Number.parseInt(alpha + alpha, 16) / 255,
		] as const;
	}
	const red = Number.parseInt(hex.slice(0, 2), 16);
	const green = Number.parseInt(hex.slice(2, 4), 16);
	const blue = Number.parseInt(hex.slice(4, 6), 16);
	const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
	return [red, green, blue, alpha] as const;
};

const parseRgbColor = (source: string): RgbaTuple | null => {
	const match = source.match(/^rgba?\((.*)\)$/iu);
	if (!match) return null;
	const values = match[1].split(",").map((value) => value.trim());
	if (values.length !== 3 && values.length !== 4)
		throw new Error("Use comma-separated rgb(r, g, b) or rgba(r, g, b, a).");
	const channels = values.slice(0, 3).map((value) => {
		const channel = value.endsWith("%") ? (Number(value.slice(0, -1)) * 255) / 100 : Number(value);
		if (!Number.isFinite(channel) || channel < 0 || channel > 255)
			throw new Error("RGB channels must be between 0 and 255 (or 0% and 100%).");
		return channel;
	});
	const alpha = values[3] === undefined ? 1 : parseAlpha(values[3]);
	return [channels[0], channels[1], channels[2], alpha];
};

const parseHslColor = (source: string): RgbaTuple | null => {
	const match = source.match(/^hsla?\((.*)\)$/iu);
	if (!match) return null;
	const values = match[1].split(",").map((value) => value.trim());
	if (values.length !== 3 && values.length !== 4)
		throw new Error("Use comma-separated hsl(h, s%, l%) or hsla(h, s%, l%, a).");
	const hueInput = values[0].replace(/deg$/iu, "");
	const hue = Number(hueInput);
	const saturation = values[1].endsWith("%") ? Number(values[1].slice(0, -1)) / 100 : Number.NaN;
	const lightness = values[2].endsWith("%") ? Number(values[2].slice(0, -1)) / 100 : Number.NaN;
	if (
		!Number.isFinite(hue) ||
		!Number.isFinite(saturation) ||
		!Number.isFinite(lightness) ||
		saturation < 0 ||
		saturation > 1 ||
		lightness < 0 ||
		lightness > 1
	) {
		throw new Error("HSL requires a finite hue and saturation/lightness percentages from 0% to 100%.");
	}
	const normalizedHue = (((hue % 360) + 360) % 360) / 360;
	const alpha = values[3] === undefined ? 1 : parseAlpha(values[3]);
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const section = normalizedHue * 6;
	const secondary = chroma * (1 - Math.abs((section % 2) - 1));
	const [red, green, blue] =
		section < 1
			? [chroma, secondary, 0]
			: section < 2
				? [secondary, chroma, 0]
				: section < 3
					? [0, chroma, secondary]
					: section < 4
						? [0, secondary, chroma]
						: section < 5
							? [secondary, 0, chroma]
							: [chroma, 0, secondary];
	const offset = lightness - chroma / 2;
	return [(red + offset) * 255, (green + offset) * 255, (blue + offset) * 255, alpha] as RgbaTuple;
};

export const convertColor = (source: string): ColorValue => {
	const value = source.trim();
	if (/^transparent$/iu.test(value)) return makeColor(0, 0, 0, 0);
	if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(value)) {
		const [red, green, blue, alpha] = parseHexColor(value);
		return makeColor(red, green, blue, alpha);
	}
	const rgb = parseRgbColor(value);
	if (rgb) return makeColor(...rgb);
	const hsl = parseHslColor(value);
	if (hsl) return makeColor(...hsl);
	throw new Error("Enter a HEX color (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba(), hsl()/hsla(), or transparent.");
};

const inferJsonSchema = (value: unknown): Record<string, unknown> => {
	if (value === null) return { type: "null" };
	if (typeof value === "string") return { type: "string" };
	if (typeof value === "number") return { type: "number" };
	if (typeof value === "boolean") return { type: "boolean" };
	if (Array.isArray(value)) {
		const uniqueSchemas = [
			...new Map(
				value.map((item) => {
					const schema = inferJsonSchema(item);
					return [JSON.stringify(schema), schema] as const;
				}),
			).values(),
		];
		return {
			type: "array",
			items:
				uniqueSchemas.length === 0
					? {}
					: uniqueSchemas.length === 1
						? uniqueSchemas[0]
						: { anyOf: uniqueSchemas },
		};
	}
	if (typeof value === "object") {
		const properties = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inferJsonSchema(item)]));
		return {
			type: "object",
			properties,
			...(Object.keys(properties).length > 0 ? { required: Object.keys(properties) } : {}),
		};
	}
	return {};
};

export const jsonToSchema = (source: string) => {
	if (!source.trim()) throw new Error("Paste a JSON example to generate a schema.");
	if (source.length > maximumInputLength) throw new Error("Keep JSON under one million characters.");
	let value: unknown;
	try {
		value = JSON.parse(source) as unknown;
	} catch (error) {
		throw new Error(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
	}
	const output = JSON.stringify(
		{ $schema: "https://json-schema.org/draft/2020-12/schema", ...inferJsonSchema(value) },
		null,
		2,
	);
	if (output === undefined) throw new Error("Could not serialize this JSON Schema.");
	return output;
};

const parseJwtJson = (segment: string, label: string): JwtPayload => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(decodeBase64(segment)) as unknown;
	} catch (error) {
		throw new Error(
			error instanceof Error && error.message.startsWith("Enter")
				? `${label}: ${error.message}`
				: `${label} is not valid Base64URL-encoded JSON.`,
		);
	}
	if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
		throw new Error(`${label} must be a JSON object.`);
	return parsed as JwtPayload;
};

export const decodeJwt = (token: string) => {
	const parts = token.trim().split(".");
	if (parts.length !== 3 || !parts[0] || !parts[1])
		throw new Error("Enter a three-part JWT with header, payload, and signature segments.");
	const header = parseJwtJson(parts[0], "JWT header");
	const payload = parseJwtJson(parts[1], "JWT payload");
	const expiration = payload.exp;
	const expirationDate =
		typeof expiration === "number" && Number.isFinite(expiration) ? new Date(expiration * 1000) : null;
	const expiresAt = expirationDate && Number.isFinite(expirationDate.getTime()) ? expirationDate.toISOString() : null;
	return { header, payload, expiresAt, signaturePresent: parts[2].length > 0 };
};
