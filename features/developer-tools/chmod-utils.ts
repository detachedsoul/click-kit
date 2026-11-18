export type PermissionClass = "user" | "group" | "other";
export type Bit = { read: boolean; write: boolean; execute: boolean };
export type SpecialBits = { setuid: boolean; setgid: boolean; sticky: boolean };

export type Permissions = {
	octal: string;
	symbolic: string;
	user: Bit;
	group: Bit;
	other: Bit;
	special: SpecialBits;
	command: string;
	summary: string[];
};

const classLabel: Record<PermissionClass, string> = { user: "Owner", group: "Group", other: "Others" };

const bitToNumber = (bit: Bit) => (bit.read ? 4 : 0) + (bit.write ? 2 : 0) + (bit.execute ? 1 : 0);

const numberToBit = (value: number): Bit => ({ read: (value & 4) !== 0, write: (value & 2) !== 0, execute: (value & 1) !== 0 });

const describeBit = (bit: Bit) => {
	const actions = [bit.read ? "read" : "", bit.write ? "write" : "", bit.execute ? "execute" : ""].filter(Boolean);
	return actions.length === 0 ? "no access" : actions.join(", ");
};

export const permissionsFromOctal = (input: string): Permissions => {
	const trimmed = input.trim();
	if (!trimmed) throw new Error("Enter an octal mode such as 755 or 0644.");
	if (!/^[0-7]{3,4}$/u.test(trimmed)) throw new Error("Octal modes use three or four digits from 0 to 7, for example 755 or 4755.");
	const padded = trimmed.padStart(4, "0");
	const specialDigit = Number(padded[0]);
	const user = numberToBit(Number(padded[1]));
	const group = numberToBit(Number(padded[2]));
	const other = numberToBit(Number(padded[3]));
	const special: SpecialBits = { setuid: (specialDigit & 4) !== 0, setgid: (specialDigit & 2) !== 0, sticky: (specialDigit & 1) !== 0 };
	const symbolic = `${special.setuid ? (user.execute ? "s" : "S") : user.execute ? "x" : "-"}`;
	const renderClass = (bit: Bit, specialChar: string | null) =>
		`${bit.read ? "r" : "-"}${bit.write ? "w" : "-"}${specialChar ?? (bit.execute ? "x" : "-")}`;
	const symbolicMode = [
		renderClass(user, special.setuid ? (user.execute ? "s" : "S") : null),
		renderClass(group, special.setgid ? (group.execute ? "s" : "S") : null),
		renderClass(other, special.sticky ? (other.execute ? "t" : "T") : null),
	].join("");
	const octal = `${specialDigit === 0 ? "" : specialDigit}${bitToNumber(user)}${bitToNumber(group)}${bitToNumber(other)}`;
	const summary = [
		`${classLabel.user}: ${describeBit(user)}`,
		`${classLabel.group}: ${describeBit(group)}`,
		`${classLabel.other}: ${describeBit(other)}`,
		...(special.setuid ? ["Setuid: the file runs with the owner's privileges"] : []),
		...(special.setgid ? ["Setgid: the file runs with the group's privileges, or new files inherit the directory group"] : []),
		...(special.sticky ? ["Sticky: only file owners can delete entries in this directory"] : []),
	];
	return {
		octal,
		symbolic: `${symbolicMode}${symbolic && ""}`,
		user,
		group,
		other,
		special,
		command: `chmod ${octal} path/to/file`,
		summary,
	};
};

export const permissionsFromBits = (user: Bit, group: Bit, other: Bit, special: SpecialBits): Permissions => {
	const specialDigit = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
	const octal = `${specialDigit === 0 ? "" : specialDigit}${bitToNumber(user)}${bitToNumber(group)}${bitToNumber(other)}`;
	return permissionsFromOctal(octal);
};

export const permissionsFromSymbolic = (input: string): Permissions => {
	const trimmed = input.trim();
	if (!/^[-r][-w][-xsS][-r][-w][-xsS][-r][-w][-xtT]$/u.test(trimmed)) {
		throw new Error("Symbolic modes look like rwxr-xr-x, with three characters per class.");
	}
	const convert = (chunk: string, specialChars: string) => ({
		read: chunk[0] === "r",
		write: chunk[1] === "w",
		execute: chunk[2] === "x" || specialChars.includes(chunk[2]),
	});
	const user = convert(trimmed.slice(0, 3), "sS");
	const group = convert(trimmed.slice(3, 6), "sS");
	const other = convert(trimmed.slice(6, 9), "tT");
	const special: SpecialBits = {
		setuid: /[sS]/u.test(trimmed[2] ?? ""),
		setgid: /[sS]/u.test(trimmed[5] ?? ""),
		sticky: /[tT]/u.test(trimmed[8] ?? ""),
	};
	return permissionsFromBits(user, group, other, special);
};
