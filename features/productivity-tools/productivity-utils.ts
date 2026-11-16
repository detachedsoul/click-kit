import QRCode from "qrcode";

export type PasswordOptions = {
	length: number;
	lowercase: boolean;
	uppercase: boolean;
	numbers: boolean;
	symbols: boolean;
	excludeAmbiguous: boolean;
};

const characterSets = {
	lowercase: "abcdefghijklmnopqrstuvwxyz",
	uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	numbers: "0123456789",
	symbols: "!#$%&()*+,-./:;<=>?@[]^_{|}~",
};
const ambiguousCharacters = new Set("ilLI|1oO0`'\"{}\\");

const secureIndex = (maximum: number) => {
	if (!globalThis.crypto?.getRandomValues)
		throw new Error("Secure random generation is not available in this browser context.");
	if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 256)
		throw new Error("Invalid secure random selection range.");
	const ceiling = Math.floor(256 / maximum) * maximum;
	const byte = new Uint8Array(1);
	for (let attempt = 0; attempt < 100; attempt += 1) {
		globalThis.crypto.getRandomValues(byte);
		if (byte[0] < ceiling) return byte[0] % maximum;
	}
	throw new Error("Could not obtain a secure random value. Try again.");
};

export const generatePassword = (options: PasswordOptions) => {
	if (!Number.isInteger(options.length) || options.length < 4 || options.length > 128)
		throw new Error("Choose a password length from 4 to 128 characters.");
	const selectedSets = (Object.keys(characterSets) as (keyof typeof characterSets)[])
		.filter((key) => options[key])
		.map((key) => characterSets[key]);
	if (selectedSets.length === 0) throw new Error("Choose at least one character type.");
	const availableSets = selectedSets.map((set) =>
		options.excludeAmbiguous ? [...set].filter((character) => !ambiguousCharacters.has(character)).join("") : set,
	);
	if (availableSets.some((set) => set.length === 0))
		throw new Error("The selected types have no characters after excluding ambiguous ones.");
	if (options.length < availableSets.length)
		throw new Error("Length must allow at least one character from every selected type.");
	const allCharacters = availableSets.join("");
	const password = availableSets.map((set) => set[secureIndex(set.length)]);
	while (password.length < options.length) password.push(allCharacters[secureIndex(allCharacters.length)]);
	for (let index = password.length - 1; index > 0; index -= 1) {
		const swapIndex = secureIndex(index + 1);
		[password[index], password[swapIndex]] = [password[swapIndex], password[index]];
	}
	return password.join("");
};

export const generateQrCode = async (source: string) => {
	if (!source.trim()) throw new Error("Enter a link or short message to make a QR code.");
	if (source.length > 2000) throw new Error("Keep QR content under 2,000 characters for reliable scanning.");
	return QRCode.toDataURL(source, {
		errorCorrectionLevel: "M",
		margin: 3,
		width: 512,
		color: { dark: "#1f352d", light: "#ffffff" },
	});
};

export const chooseRandomOption = (source: string) => {
	if (source.length > 100_000) throw new Error("Keep the choices under 100,000 characters.");
	const options = source
		.split(/\r?\n/u)
		.map((option) => option.trim())
		.filter(Boolean);
	if (options.length < 2) throw new Error("Enter at least two non-empty choices on separate lines.");
	if (!globalThis.crypto?.getRandomValues)
		throw new Error("Secure random selection is not available in this browser context.");
	const choice = new Uint32Array(1);
	const ceiling = Math.floor(0x1_0000_0000 / options.length) * options.length;
	for (let attempt = 0; attempt < 100; attempt += 1) {
		globalThis.crypto.getRandomValues(choice);
		if (choice[0] < ceiling) return { choice: options[choice[0] % options.length], count: options.length };
	}
	throw new Error("Could not obtain a secure random value. Try again.");
};
