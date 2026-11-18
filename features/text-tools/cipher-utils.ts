export type CipherMode = "caesar" | "rot13" | "atbash" | "rot47";

const normaliseShift = (shift: number) => ((Math.round(shift) % 26) + 26) % 26;

export const caesarShift = (source: string, shift: number) => {
	const amount = normaliseShift(shift);
	if (amount === 0) return source;
	return source.replace(/[a-z]/giu, (letter) => {
		const code = letter.charCodeAt(0);
		const base = letter === letter.toLowerCase() ? 97 : 65;
		return String.fromCharCode(((code - base + amount) % 26) + base);
	});
};

export const atbash = (source: string) =>
	source.replace(/[a-z]/giu, (letter) => {
		const base = letter === letter.toLowerCase() ? 97 : 65;
		return String.fromCharCode(base + 25 - (letter.charCodeAt(0) - base));
	});

export const rot47 = (source: string) =>
	source.replace(/[!-~]/gu, (character) => String.fromCharCode(33 + ((character.charCodeAt(0) - 33 + 47) % 94)));

export const applyCipher = (source: string, mode: CipherMode, shift = 3, decode = false) => {
	if (!source.trim()) throw new Error("Paste some text to transform.");
	switch (mode) {
		case "rot13":
			return caesarShift(source, 13);
		case "atbash":
			return atbash(source);
		case "rot47":
			return rot47(source);
		default:
			if (!Number.isFinite(shift)) throw new Error("Shift must be a number.");
			return caesarShift(source, decode ? -normaliseShift(shift) : shift);
	}
};

export const bruteForceCaesar = (source: string) => {
	if (!source.trim()) throw new Error("Paste some text to transform.");
	return Array.from({ length: 25 }, (_, index) => ({ shift: index + 1, text: caesarShift(source, -(index + 1)) }));
};

export const caesarToText = (rows: { shift: number; text: string }[]) => rows.map((row) => `${String(row.shift).padStart(2, "0")} → ${row.text}`).join("\n");
