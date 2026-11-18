const parseDate = (value: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.trim())) throw new Error("Use dates in YYYY-MM-DD form.");
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${value} is not a real date.`);
	return date;
};

const DAY = 86_400_000;

export type DateDiffOptions = { includeEnd: boolean };

export type DateDiffResult = {
	days: number;
	weeks: number;
	remainderDays: number;
	businessDays: number;
	weekendDays: number;
	years: number;
	months: number;
	dayRemainder: number;
	breakdown: string;
	weekdaysBreakdown: string;
	swapped: boolean;
};

const countDays = (start: Date, end: Date, includeEnd: boolean) => {
	const total = Math.round((end.getTime() - start.getTime()) / DAY) + (includeEnd ? 1 : 0);
	let business = 0;
	let weekend = 0;
	for (let index = 0; index < total; index += 1) {
		const weekday = new Date(start.getTime() + index * DAY).getUTCDay();
		if (weekday === 0 || weekday === 6) weekend += 1;
		else business += 1;
	}
	return { total, business, weekend };
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const addMonths = (date: Date, months: number) => {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + months;
	const day = Math.min(date.getUTCDate(), daysInMonth(year + Math.floor(month / 12), ((month % 12) + 12) % 12));
	return new Date(Date.UTC(year + Math.floor(month / 12), ((month % 12) + 12) % 12, day));
};

const addYears = (date: Date, years: number) => {
	const year = date.getUTCFullYear() + years;
	const month = date.getUTCMonth();
	return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), daysInMonth(year, month))));
};

// Walk forward from the start date so month lengths and leap days are handled
// the way a person would count them, instead of subtracting fields.
const calendarBreakdown = (start: Date, end: Date) => {
	let cursor = start;
	let years = 0;
	let months = 0;
	while (addYears(cursor, 1).getTime() <= end.getTime()) {
		cursor = addYears(cursor, 1);
		years += 1;
	}
	while (addMonths(cursor, 1).getTime() <= end.getTime()) {
		cursor = addMonths(cursor, 1);
		months += 1;
	}
	return { years, months, days: Math.round((end.getTime() - cursor.getTime()) / DAY) };
};

export const dateDifference = (startValue: string, endValue: string, options: Partial<DateDiffOptions> = {}): DateDiffResult => {
	const settings = { includeEnd: false, ...options };
	let start = parseDate(startValue);
	let end = parseDate(endValue);
	let swapped = false;
	if (end.getTime() < start.getTime()) {
		[start, end] = [end, start];
		swapped = true;
	}
	const { total, business, weekend } = countDays(start, end, settings.includeEnd);
	const { years, months, days } = calendarBreakdown(start, end);
	const weeks = Math.floor(total / 7);
	const parts = [years ? `${years} year${years === 1 ? "" : "s"}` : "", months ? `${months} month${months === 1 ? "" : "s"}` : "", days ? `${days} day${days === 1 ? "" : "s"}` : ""].filter(Boolean);
	return {
		days: total,
		weeks,
		remainderDays: total % 7,
		businessDays: business,
		weekendDays: weekend,
		years,
		months,
		dayRemainder: days,
		breakdown: parts.length ? parts.join(", ") : "the same day",
		weekdaysBreakdown: `${business} weekday${business === 1 ? "" : "s"} and ${weekend} weekend day${weekend === 1 ? "" : "s"}`,
		swapped,
	};
};

export const monthDifference = (startValue: string, endValue: string) => {
	const start = parseDate(startValue);
	const end = parseDate(endValue);
	const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
	return months + (end.getUTCDate() >= start.getUTCDate() ? 0 : -1);
};
