const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ulidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/u;
const maximumNanoIdSize = 128;

const randomBytes = (length: number) => {
	const bytes = new Uint8Array(length);
	if (!globalThis.crypto?.getRandomValues) throw new Error("Secure randomness is not available in this browser context.");
	globalThis.crypto.getRandomValues(bytes);
	return bytes;
};

export type UuidInspection = {
	uuid: string;
	version: string;
	variant: string;
	normalized: string;
	isNil: boolean;
	isMax: boolean;
	timestamp: string;
	randomness: string;
	note: string;
};

export const inspectUuid = (input: string): UuidInspection => {
	const trimmed = input.trim().toLowerCase().replace(/^urn:uuid:/u, "").replace(/^\{|\}$/gu, "");
	if (!trimmed) throw new Error("Enter a UUID to inspect.");
	if (!uuidPattern.test(trimmed)) throw new Error("UUIDs use 8-4-4-4-12 hexadecimal groups, for example 3f2504e0-4f89-41d3-9a0c-0305e82c3301.");
	const hex = trimmed.replaceAll("-", "");
	const versionNibble = Number.parseInt(hex[12], 16);
	const variantNibble = Number.parseInt(hex[16], 16);
	const isNil = /^0+$/u.test(hex);
	const isMax = /^f+$/u.test(hex);
	const version = isNil ? "Nil (v0)" : versionNibble >= 1 && versionNibble <= 8 ? `v${versionNibble}` : "Unknown";
	const variant =
		variantNibble >= 8 && variantNibble <= 0xb ? "RFC 4122 / RFC 9562" : variantNibble >= 0xc && variantNibble <= 0xd ? "Microsoft GUID" : variantNibble >= 0xe ? "Future / reserved" : "NCS (reserved)";
	let timestamp = "Not time based";
	let randomness = `${hex.slice(0, 12)}… (${hex.length} hex digits)`;
	let note = "";
	if (versionNibble === 1) {
		const ticks =
			Number.parseInt(hex.slice(13, 16), 16) * 2 ** 48 + Number.parseInt(hex.slice(8, 12), 16) * 2 ** 32 + Number.parseInt(hex.slice(0, 8), 16);
		const milliseconds = ticks / 10_000 - 12_219_292_800_000;
		timestamp = new Date(milliseconds).toISOString();
		randomness = `Clock sequence ${Number.parseInt(hex.slice(16, 20), 16) & 0x3fff}, node ${hex.slice(20)}`;
		note = "Version 1 UUIDs embed a 60-bit timestamp in 100-nanosecond units and the generating node's MAC address.";
	} else if (versionNibble === 4) {
		randomness = `${hex.slice(13)} (random)`;
		note = "Version 4 UUIDs are entirely random apart from the version and variant bits.";
	} else if (versionNibble === 7) {
		timestamp = new Date(Number.parseInt(hex.slice(0, 12), 16)).toISOString();
		randomness = hex.slice(13);
		note = "Version 7 UUIDs start with a Unix millisecond timestamp, so they sort by creation time.";
	} else if (versionNibble === 3 || versionNibble === 5) {
		randomness = "Hash based (MD5 for v3, SHA-1 for v5)";
		note = `Version ${versionNibble} UUIDs are derived from a namespace and a name, so the same input always produces the same UUID.`;
	} else if (isNil) {
		timestamp = "None";
		note = "The nil UUID is all zeros and is often used as a placeholder.";
	}
	return { uuid: trimmed, version, variant, normalized: trimmed, isNil, isMax, timestamp, randomness, note };
};

export type UlidParts = { ulid: string; timestamp: string; milliseconds: string; randomness: string };

const encodeTime = (milliseconds: number) => {
	let remaining = milliseconds;
	let output = "";
	for (let index = 0; index < 10; index += 1) {
		output = `${crockford[remaining % 32]}${output}`;
		remaining = Math.floor(remaining / 32);
	}
	return output;
};

const decodeTime = (value: string) => {
	let total = 0;
	for (const character of value) {
		const index = crockford.indexOf(character);
		if (index === -1) throw new Error(`"${character}" is not a Crockford base32 character.`);
		total = total * 32 + index;
	}
	return total;
};

export const generateUlid = (milliseconds = Date.now(), bytes: Uint8Array = randomBytes(16)): UlidParts => {
	if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 281_474_976_710_655) {
		throw new Error("ULID timestamps must be Unix milliseconds between 1970 and the year 10889.");
	}
	let random = "";
	for (const byte of bytes.subarray(0, 16)) random += crockford[byte & 31];
	return parseUlid(`${encodeTime(Math.floor(milliseconds))}${random}`);
};

export const parseUlid = (input: string): UlidParts => {
	const trimmed = input.trim().toUpperCase().replace(/^ULID:/u, "");
	if (!trimmed) throw new Error("Enter a ULID to inspect.");
	if (trimmed.length !== 26) throw new Error("ULIDs are exactly 26 Crockford base32 characters.");
	if (!ulidPattern.test(trimmed)) throw new Error("ULIDs cannot contain I, L, O, or U, and use only Crockford base32 characters.");
	const milliseconds = decodeTime(trimmed.slice(0, 10));
	if (milliseconds > 281_474_976_710_655) throw new Error("This ULID overflows the 48-bit timestamp range.");
	return {
		ulid: trimmed,
		randomness: trimmed.slice(10),
		milliseconds: String(milliseconds),
		timestamp: new Date(milliseconds).toISOString(),
	};
};

const defaultAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

export const generateNanoId = (size = 21, alphabet = defaultAlphabet, random: (max: number) => number = (max) => randomBytes(1)[0] % max) => {
	if (!Number.isInteger(size) || size < 1 || size > maximumNanoIdSize) throw new Error("NanoID length must be a whole number from 1 to 128.");
	const characters = [...new Set(alphabet.split(""))];
	if (characters.length < 2) throw new Error("Use an alphabet with at least two distinct characters.");
	if (characters.length > 255) throw new Error("Keep the alphabet under 255 characters.");
	if (characters.some((character) => /\s/u.test(character))) throw new Error("Alphabet characters cannot include whitespace.");
	return Array.from({ length: size }, () => characters[random(characters.length)]).join("");
};
