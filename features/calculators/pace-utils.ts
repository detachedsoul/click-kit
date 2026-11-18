export type PacePreset = { label: string; km: number };

export const PACE_PRESETS: PacePreset[] = [
	{ label: "5K", km: 5 },
	{ label: "10K", km: 10 },
	{ label: "Half marathon", km: 21.0975 },
	{ label: "Marathon", km: 42.195 },
	{ label: "One mile", km: 1.609344 },
];

export const KM_PER_MILE = 1.609344;

/** Accepts "45:30", "1:05:30", "90" (seconds), or "1h 5m 30s". Returns whole seconds. */
export const parseDuration = (input: string) => {
	const value = input.trim().toLowerCase();
	if (!value) return 0;
	const words = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/u.exec(value);
	if (words && (words[1] || words[2] || words[3])) {
		const hours = Number(words[1] ?? 0);
		const minutes = Number(words[2] ?? 0);
		const seconds = Number(words[3] ?? 0);
		return Math.round(hours * 3600 + minutes * 60 + seconds);
	}
	const parts = value.split(":").map((part) => part.trim());
	if (parts.length === 1) {
		const seconds = Number(parts[0]);
		if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Time must be a positive number of seconds.");
		return Math.round(seconds);
	}
	if (parts.length > 3 || parts.some((part) => !/^\d+$/u.test(part))) throw new Error("Use mm:ss or hh:mm:ss for a time.");
	const numbers = parts.map(Number);
	const seconds = parts.length === 3 ? numbers[0] * 3600 + numbers[1] * 60 + numbers[2] : numbers[0] * 60 + numbers[1];
	if (parts.length === 3 && numbers[1] > 59) throw new Error("Minutes must be below 60 in an hh:mm:ss time.");
	if (parts.length === 2 && numbers[1] > 59) throw new Error("Seconds must be below 60 in an mm:ss time.");
	return seconds;
};

const pad = (value: number) => String(value).padStart(2, "0");

export const formatDuration = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Time must be a positive number of seconds.");
	const total = Math.round(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = total % 60;
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
};

/** Accepts "10", "10k", "10 km", "10km", "6.2mi", "6.2 miles". Returns kilometres. */
export const parseDistance = (input: string) => {
	const value = input.trim().toLowerCase().replace(/,/gu, "");
	if (!value) throw new Error("Enter a distance.");
	const miles = /^([\d.]+)\s*(?:mi|mile|miles)$/u.exec(value);
	if (miles) return Number(miles[1]) * KM_PER_MILE;
	const kilometres = /^([\d.]+)\s*(?:k|km|kilometre|kilometres|kilometer|kilometers)$/u.exec(value);
	if (kilometres) return Number(kilometres[1]);
	const plain = /^([\d.]+)$/u.exec(value);
	if (plain) return Number(plain[1]);
	throw new Error('Write the distance as a number, optionally followed by "km" or "mi".');
};

export const formatDistance = (km: number, unit: "km" | "mi" = "km") => {
	const value = unit === "mi" ? km / KM_PER_MILE : km;
	return `${value.toFixed(value < 10 ? 2 : 1)} ${unit}`;
};

const requirePositive = (value: number, label: string) => {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero.`);
	return value;
};

/** Seconds per kilometre. */
export const pacePerKm = (distanceKm: number, timeSeconds: number) => requirePositive(timeSeconds, "Time") / requirePositive(distanceKm, "Distance");

export const timeForDistance = (distanceKm: number, secondsPerKm: number) => requirePositive(distanceKm, "Distance") * requirePositive(secondsPerKm, "Pace");

export const distanceForTime = (timeSeconds: number, secondsPerKm: number) => requirePositive(timeSeconds, "Time") / requirePositive(secondsPerKm, "Pace");

export const speedKph = (distanceKm: number, timeSeconds: number) => (requirePositive(distanceKm, "Distance") / requirePositive(timeSeconds, "Time")) * 3600;

export const formatPace = (secondsPerKm: number, unit: "km" | "mi" = "km") => {
	const seconds = unit === "mi" ? secondsPerKm * KM_PER_MILE : secondsPerKm;
	return `${formatDuration(seconds)} /${unit}`;
};

/** Split a race time into even 5 km splits, with the final partial split kept. */
export const evenSplits = (distanceKm: number, timeSeconds: number, everyKm = 5) => {
	requirePositive(distanceKm, "Distance");
	requirePositive(timeSeconds, "Time");
	if (!Number.isFinite(everyKm) || everyKm <= 0) throw new Error("Splits must cover a positive distance.");
	const pace = timeSeconds / distanceKm;
	const splits: { distance: number; time: number }[] = [];
	let covered = 0;
	while (covered < distanceKm) {
		const step = Math.min(everyKm, distanceKm - covered);
		covered += step;
		splits.push({ distance: covered, time: covered * pace });
	}
	return splits;
};
