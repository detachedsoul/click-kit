export type ObjectIdInfo = {
	hex: string;
	timestamp: Date;
	random: string;
	counter: number;
	canonical: string;
};

const clean = (input: string) => {
	const match = /([0-9a-f]{24})/iu.exec(input.trim());
	if (!match) throw new Error("An ObjectId is 24 hexadecimal characters, for example 507f1f77bcf86cd799439011.");
	return match[1].toLowerCase();
};

export const parseObjectId = (input: string): ObjectIdInfo => {
	if (!input.trim()) throw new Error("Paste an ObjectId first.");
	const hex = clean(input);
	const seconds = Number.parseInt(hex.slice(0, 8), 16);
	const timestamp = new Date(seconds * 1000);
	if (Number.isNaN(timestamp.getTime())) throw new Error("The timestamp part of this ObjectId is not valid.");
	return {
		hex,
		timestamp,
		random: hex.slice(8, 18),
		counter: Number.parseInt(hex.slice(18, 24), 16),
		canonical: `ObjectId("${hex}")`,
	};
};

export const generateObjectId = (date: Date = new Date()) => {
	if (Number.isNaN(date.getTime())) throw new Error("Pick a valid date and time.");
	const seconds = Math.floor(date.getTime() / 1000);
	if (seconds < 0) throw new Error("ObjectIds start at the Unix epoch; pick a later date.");
	if (seconds > 0xffffffff) throw new Error("That date is past the ObjectId timestamp limit (2106).");
	const random = Array.from(crypto.getRandomValues(new Uint8Array(5)), (byte) => byte.toString(16).padStart(2, "0")).join("");
	const counter = (crypto.getRandomValues(new Uint32Array(1))[0] % 0xffffff).toString(16).padStart(6, "0");
	return `${seconds.toString(16).padStart(8, "0")}${random}${counter}`;
};

export const describeAge = (timestamp: Date, now: Date = new Date()) => {
	const seconds = Math.round((now.getTime() - timestamp.getTime()) / 1000);
	if (seconds < 0) return `in ${Math.abs(seconds)} seconds`;
	const units: [number, string][] = [
		[60, "second"],
		[3600, "minute"],
		[86400, "hour"],
		[2592000, "day"],
		[31536000, "month"],
	];
	if (seconds < 60) return `${seconds} seconds ago`;
	for (let index = 1; index < units.length; index += 1) {
		const [limit, name] = units[index];
		if (seconds < limit) {
			const value = Math.floor(seconds / units[index - 1][0]);
			return `${value} ${name}${value === 1 ? "" : "s"} ago`;
		}
	}
	const years = Math.floor(seconds / 31536000);
	return `${years} year${years === 1 ? "" : "s"} ago`;
};
