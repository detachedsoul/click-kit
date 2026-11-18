export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const hashAlgorithms: HashAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

export const toBase64Url = (bytes: Uint8Array) =>
	toBase64(bytes).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");

export const base32Decode = (input: string): Uint8Array => {
	const cleaned = input.replace(/[\s=]/gu, "").toUpperCase();
	if (!cleaned) throw new Error("The Base32 secret is empty.");
	let bits = 0;
	let value = 0;
	const output: number[] = [];
	for (const character of cleaned) {
		const index = base32Alphabet.indexOf(character);
		if (index < 0) throw new Error(`"${character}" is not a Base32 character (A–Z and 2–7 only).`);
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			bits -= 8;
			output.push((value >>> bits) & 0xff);
		}
	}
	if (output.length === 0) throw new Error("The Base32 secret is too short to decode.");
	return Uint8Array.from(output);
};

const encoder = new TextEncoder();

export const keyBytes = (key: string, encoding: "utf8" | "base32") => (encoding === "base32" ? base32Decode(key) : encoder.encode(key));

export const hmac = async (message: string, key: string, algorithm: HashAlgorithm, encoding: "utf8" | "base32" = "utf8") => {
	if (!key) throw new Error("Enter a key to sign with.");
	const cryptoKey = await crypto.subtle.importKey("raw", keyBytes(key, encoding) as unknown as BufferSource, { name: "HMAC", hash: algorithm }, false, ["sign"]);
	const signature = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message) as unknown as BufferSource));
	return { hex: toHex(signature), base64: toBase64(signature), base64Url: toBase64Url(signature) };
};

export type TotpOptions = {
	secret: string;
	digits?: number;
	period?: number;
	algorithm?: HashAlgorithm;
	timestamp?: number;
};

const counterBytes = (counter: number) => {
	const bytes = new Uint8Array(8);
	let remaining = counter;
	for (let index = 7; index >= 0; index -= 1) {
		bytes[index] = remaining % 256;
		remaining = Math.floor(remaining / 256);
	}
	return bytes;
};

export const totp = async ({ secret, digits = 6, period = 30, algorithm = "SHA-1", timestamp = Date.now() }: TotpOptions) => {
	if (!Number.isInteger(period) || period < 1) throw new Error("Period must be a positive number of seconds.");
	if (!Number.isInteger(digits) || digits < 4 || digits > 10) throw new Error("Digits must be between 4 and 10.");
	const counter = Math.floor(timestamp / 1000 / period);
	const cryptoKey = await crypto.subtle.importKey("raw", base32Decode(secret) as unknown as BufferSource, { name: "HMAC", hash: algorithm }, false, ["sign"]);
	const signature = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes(counter) as unknown as BufferSource));
	const offset = signature[signature.length - 1] & 0x0f;
	const binary =
		((signature[offset] & 0x7f) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3];
	const code = String(binary % 10 ** digits).padStart(digits, "0");
	const elapsed = (timestamp / 1000) % period;
	return {
		code,
		counter,
		remaining: Math.ceil(period - elapsed),
		progress: Math.round((elapsed / period) * 100),
		period,
		digits,
	};
};

export const verifyTotp = async (token: string, options: TotpOptions & { window?: number }) => {
	const { window = 1, timestamp = Date.now(), ...rest } = options;
	const cleaned = token.replace(/\s/gu, "");
	if (!new RegExp(`^\\d{${rest.digits ?? 6}}$`, "u").test(cleaned)) return false;
	for (let offset = -window; offset <= window; offset += 1) {
		const candidate = await totp({ ...rest, timestamp: timestamp + offset * (rest.period ?? 30) * 1000 });
		if (candidate.code === cleaned) return true;
	}
	return false;
};

export const generateSecret = (bytes = 20) => {
	const random = crypto.getRandomValues(new Uint8Array(bytes));
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of random) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			bits -= 5;
			output += base32Alphabet[(value >>> bits) & 31];
		}
	}
	if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
	return output;
};
