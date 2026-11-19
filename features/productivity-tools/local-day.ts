/**
 * Calendar dates as the person living in them sees them. `toISOString()` would give the UTC
 * date, so a tick at 00:30 in Lagos would land on yesterday: these helpers never do that.
 */

const pad = (value: number) => String(value).padStart(2, "0");

export const isoDay = (date: Date): string =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = (now: Date = new Date()): string => isoDay(now);

export const parseDay = (iso: string): Date => new Date(`${iso}T00:00:00`);

export const shiftDay = (iso: string, delta: number): string => {
	const date = parseDay(iso);
	date.setDate(date.getDate() + delta);
	return isoDay(date);
};
