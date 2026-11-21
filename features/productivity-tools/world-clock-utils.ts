import { TIME_ZONES, dayKey, offsetLabel, zoneOffsetMinutes, zonedMidnight } from "@/features/productivity-tools/timezone-utils";

export const CLOCK_KEY = "clickkit-world-clock-cities";
export const FAVOURITE_KEY = "clickkit-world-clock-favourites";
export const MAX_CITIES = 12;

export const isZone = (zone: string) => {
	try {
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return true;
	} catch {
		return false;
	}
};

export const zoneName = (zone: string) => TIME_ZONES.find((item) => item.id === zone)?.label ?? zone.replaceAll("_", " ").split("/").at(-1)?.replaceAll("_", " ") ?? zone;

export const zoneDateTime = (instant: Date, zone: string) => {
	if (!isZone(zone)) throw new Error(`“${zone}” is not a valid IANA time zone.`);
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: zone,
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(instant);
};

export const offsetAt = (instant: Date, zone: string) => offsetLabel(zoneOffsetMinutes(instant, zone));

/** Number of local calendar days a city is ahead of the reference zone, at this exact instant. */
export const dateDifference = (instant: Date, zone: string, referenceZone: string) => {
	const dayNumber = (value: string) => {
		const [year, month, day] = value.split("-").map(Number);
		return Date.UTC(year, month - 1, day) / 86_400_000;
	};
	return dayNumber(dayKey(instant, zone)) - dayNumber(dayKey(instant, referenceZone));
};

/** Convert a wall-clock input into an instant by asking Intl's IANA database for the offset. */
export const localTimeToInstant = (dateTime: string, zone: string) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(dateTime);
	if (!match) throw new Error("Choose a valid date and time.");
	if (!isZone(zone)) throw new Error(`“${zone}” is not a valid IANA time zone.`);
	const [, year, month, day, hour, minute] = match.map(Number);
	const wanted = Date.UTC(year, month - 1, day, hour, minute);
	let instant = new Date(wanted - zoneOffsetMinutes(new Date(wanted), zone) * 60_000);
	// A second pass accounts for the offset on the other side of a DST boundary.
	instant = new Date(wanted - zoneOffsetMinutes(instant, zone) * 60_000);
	const actual = new Intl.DateTimeFormat("en-GB", {
		timeZone: zone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(instant);
	const part = (type: string) => Number(actual.find((item) => item.type === type)?.value ?? -1);
	if (part("year") !== year || part("month") !== month || part("day") !== day || part("hour") !== hour || part("minute") !== minute) {
		throw new Error("That local time does not exist because the clocks change for daylight saving. Choose another time.");
	}
	return instant;
};

export type ConvertedTime = { zone: string; label: string; offset: string; dayDifference: number };

export const convertLocalTime = (dateTime: string, sourceZone: string, zones: string[]): { instant: Date; conversions: ConvertedTime[] } => {
	const instant = localTimeToInstant(dateTime, sourceZone);
	return {
		instant,
		conversions: zones.map((zone) => ({
			zone,
			label: zoneDateTime(instant, zone),
			offset: offsetAt(instant, zone),
			dayDifference: dateDifference(instant, zone, sourceZone),
		})),
	};
};

export type WorkingHour = { anchorHour: number; localHours: Record<string, number>; localDays: Record<string, number> };

/** Hours between midnight and midnight in the reference city that land in 09:00–17:00 everywhere. */
export const findWorkingOverlap = (date: string, referenceZone: string, zones: string[]): WorkingHour[] => {
	if (!zones.length) return [];
	const start = zonedMidnight(date, referenceZone);
	const [year, month, day] = date.split("-").map(Number);
	const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
	const end = zonedMidnight(nextDate, referenceZone);
	const baseDay = dayKey(start, referenceZone);
	const dateIndex = (key: string) => {
		const [dateYear, dateMonth, dateDay] = key.split("-").map(Number);
		return Date.UTC(dateYear, dateMonth - 1, dateDay) / 86_400_000;
	};
	const slots: WorkingHour[] = [];
	for (let timestamp = start.getTime(); timestamp < end.getTime(); timestamp += 3_600_000) {
		const instant = new Date(timestamp);
		const anchorParts = new Intl.DateTimeFormat("en-GB", { timeZone: referenceZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(instant);
		const anchorHour = Number(anchorParts.find((item) => item.type === "hour")?.value ?? 0);
		const localHours: Record<string, number> = {};
		const localDays: Record<string, number> = {};
		let works = true;
		for (const zone of zones) {
			if (!isZone(zone)) throw new Error(`“${zone}” is not a valid IANA time zone.`);
			const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).formatToParts(instant);
			const hour = Number(parts.find((item) => item.type === "hour")?.value ?? 0);
			localHours[zone] = hour;
			localDays[zone] = dateIndex(dayKey(instant, zone)) - dateIndex(baseDay);
			if (hour < 9 || hour >= 17) works = false;
		}
		if (works) slots.push({ anchorHour, localHours, localDays });
	}
	return slots;
};

export const overlapSummary = (slots: WorkingHour[], reference: string) => {
	if (!slots.length) return "There is no shared 09:00–17:00 hour for every city on this date.";
	const first = String(slots[0].anchorHour).padStart(2, "0");
	const last = String(slots.at(-1)!.anchorHour + 1).padStart(2, "0");
	return `${slots.length} shared working hour${slots.length === 1 ? "" : "s"}: ${first}:00–${last}:00 in ${zoneName(reference)}.`;
};

const cleanZones = (raw: unknown) =>
	Array.isArray(raw) ? [...new Set(raw.filter((value): value is string => typeof value === "string" && isZone(value)))].slice(0, MAX_CITIES) : [];

export const reviveZones = (raw: unknown, fallback: string[] = []) => (Array.isArray(raw) ? cleanZones(raw) : cleanZones(fallback));

export const toggleFavourite = (favourites: string[], zone: string) =>
	favourites.includes(zone) ? favourites.filter((item) => item !== zone) : cleanZones([...favourites, zone]);
