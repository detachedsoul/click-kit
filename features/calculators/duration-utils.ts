const unitSeconds: Record<string, number> = {
	h: 3600,
	hr: 3600,
	hrs: 3600,
	hour: 3600,
	hours: 3600,
	m: 60,
	min: 60,
	mins: 60,
	minute: 60,
	minutes: 60,
	s: 1,
	sec: 1,
	secs: 1,
	second: 1,
	seconds: 1,
};

/** Parses "1:30" (hours:minutes), "1:02:03", "1h 30m", "45m", "2.5h", or a bare number of minutes. Returns whole seconds. */
export const parseDuration = (input: string): number => {
	const value = input.trim().toLowerCase();
	if (!value) throw new Error("Enter a duration.");
	if (/^\d+(\.\d+)?$/u.test(value)) return Math.round(Number(value) * 60);
	const clock = value.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/u);
	if (clock) {
		const [, first, second, third] = clock;
		const hours = Number(first);
		const minutes = Number(second);
		const seconds = third ? Number(third) : 0;
		if (minutes > 59 || seconds > 59) throw new Error(`“${input.trim()}” has minutes or seconds above 59.`);
		return hours * 3600 + minutes * 60 + seconds;
	}
	const parts = value.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/gu);
	let total = 0;
	let matched = false;
	for (const [, amount, unit] of parts) {
		const factor = unitSeconds[unit];
		if (!factor) throw new Error(`Unrecognised unit “${unit}” in “${input.trim()}”. Use h, m, or s.`);
		total += Number(amount) * factor;
		matched = true;
	}
	if (!matched) throw new Error(`“${input.trim()}” is not a duration. Try 1:30, 1h 30m, or 45m.`);
	if (!Number.isFinite(total)) throw new Error(`“${input.trim()}” is not a duration.`);
	return Math.round(total);
};

export const formatDuration = (seconds: number) => {
	const sign = seconds < 0 ? "-" : "";
	const absolute = Math.abs(Math.round(seconds));
	const hours = Math.floor(absolute / 3600);
	const minutes = Math.floor((absolute % 3600) / 60);
	const remainder = absolute % 60;
	const parts: string[] = [];
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);
	if (remainder || !parts.length) parts.push(`${remainder}s`);
	return `${sign}${parts.join(" ")}`;
};

export const formatClock = (seconds: number) => {
	const sign = seconds < 0 ? "-" : "";
	const absolute = Math.abs(Math.round(seconds));
	const hours = Math.floor(absolute / 3600);
	const minutes = Math.floor((absolute % 3600) / 60);
	const remainder = absolute % 60;
	return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

export const formatDecimalHours = (seconds: number) => `${Math.round((seconds / 3600) * 100) / 100} h`;

export type DurationRow = { id: string; text: string; sign: 1 | -1 };

export type DurationTotals = {
	seconds: number;
	total: string;
	clock: string;
	decimalHours: string;
	minutes: number;
	workdays: string;
};

export const sumDurations = (rows: DurationRow[]) => {
	const errors: string[] = [];
	let seconds = 0;
	for (const row of rows) {
		if (!row.text.trim()) continue;
		try {
			seconds += parseDuration(row.text) * row.sign;
		} catch (error) {
			errors.push(error instanceof Error ? error.message : "Could not read this duration.");
		}
	}
	const totals: DurationTotals = {
		seconds,
		total: formatDuration(seconds),
		clock: formatClock(seconds),
		decimalHours: formatDecimalHours(seconds),
		minutes: Math.round(seconds / 60),
		workdays: `${Math.round((seconds / 28800) * 100) / 100} × 8h`,
	};
	return { ...totals, errors };
};
