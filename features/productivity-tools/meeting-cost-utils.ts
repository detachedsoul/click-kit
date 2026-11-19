/**
 * The little bits of arithmetic behind the meeting cost meter, kept apart from React so the
 * numbers can be checked on their own. Money is rounded once, at the end, so a long meeting
 * does not drift.
 */

export const CURRENCIES = ["GBP", "NGN", "USD", "EUR", "KES", "ZAR", "INR", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DURATIONS = [
	{ minutes: 15, label: "15 min" },
	{ minutes: 30, label: "30 min" },
	{ minutes: 45, label: "45 min" },
	{ minutes: 60, label: "1 hour" },
];

export const MAX_ATTENDEES = 500;
export const MAX_RATE = 100_000;

export const sanitiseAttendees = (value: number) => (Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), MAX_ATTENDEES) : 0);

export const sanitiseRate = (value: number) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_RATE) : 0);

/** What the room costs for every minute that passes. */
export const costPerMinute = (attendees: number, hourlyRate: number) => (sanitiseAttendees(attendees) * sanitiseRate(hourlyRate)) / 60;

export const costPerHour = (attendees: number, hourlyRate: number) => sanitiseAttendees(attendees) * sanitiseRate(hourlyRate);

/** The cost of a given stretch of meeting, in minutes (fractions allowed). */
export const costOf = (attendees: number, hourlyRate: number, minutes: number) =>
	costPerMinute(attendees, hourlyRate) * (Number.isFinite(minutes) ? Math.max(minutes, 0) : 0);

/** "12:05" — hours only appear once there is an hour to show. */
export const clockLabel = (seconds: number) => {
	const whole = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(whole / 3600);
	const minutes = Math.floor((whole % 3600) / 60);
	const rest = whole % 60;
	const pad = (value: number) => String(value).padStart(2, "0");
	return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
};

/** Money, in the chosen currency, without a currency that Intl refuses to know. */
export const money = (amount: number, currency: string): string => {
	const safe = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
	try {
		return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: safe < 100 ? 2 : 0 }).format(safe);
	} catch {
		return `${safe.toFixed(2)} ${currency}`;
	}
};

/** A one-line summary worth pasting into the minutes. */
export const costSummary = (attendees: number, hourlyRate: number, currency: string, minutes: number): string => {
	const people = sanitiseAttendees(attendees);
	const total = costOf(people, hourlyRate, minutes);
	return `${people} ${people === 1 ? "person" : "people"} × ${money(hourlyRate, currency)} an hour for ${Math.round(minutes)} min = ${money(total, currency)}`;
};
