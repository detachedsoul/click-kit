export type ZoneOption = { id: string; label: string };

export const TIME_ZONES: ZoneOption[] = [
	{ id: "UTC", label: "UTC" },
	{ id: "Europe/London", label: "London" },
	{ id: "Europe/Lisbon", label: "Lisbon" },
	{ id: "Europe/Paris", label: "Paris / Berlin" },
	{ id: "Europe/Athens", label: "Athens" },
	{ id: "Africa/Lagos", label: "Lagos" },
	{ id: "Africa/Nairobi", label: "Nairobi" },
	{ id: "Africa/Johannesburg", label: "Johannesburg" },
	{ id: "Asia/Dubai", label: "Dubai" },
	{ id: "Asia/Karachi", label: "Karachi" },
	{ id: "Asia/Kolkata", label: "Mumbai / Delhi" },
	{ id: "Asia/Singapore", label: "Singapore" },
	{ id: "Asia/Shanghai", label: "Shanghai" },
	{ id: "Asia/Tokyo", label: "Tokyo" },
	{ id: "Australia/Perth", label: "Perth" },
	{ id: "Australia/Sydney", label: "Sydney" },
	{ id: "America/Sao_Paulo", label: "São Paulo" },
	{ id: "America/New_York", label: "New York" },
	{ id: "America/Chicago", label: "Chicago" },
	{ id: "America/Denver", label: "Denver" },
	{ id: "America/Los_Angeles", label: "Los Angeles" },
	{ id: "Pacific/Auckland", label: "Auckland" },
];

export const DEFAULT_ZONES = ["Europe/London", "America/New_York", "Asia/Tokyo"];
export const MAX_ZONES = 6;
export const WORK_START = 9;
export const WORK_END = 17;

const partFormatter = (timeZone: string) =>
	new Intl.DateTimeFormat("en-GB", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

const cache = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
	const cached = cache.get(timeZone);
	if (cached) return cached;
	const formatter = partFormatter(timeZone);
	cache.set(timeZone, formatter);
	return formatter;
};

export const isValidTimeZone = (timeZone: string) => {
	try {
		formatterFor(timeZone);
		return true;
	} catch {
		return false;
	}
};

const zonedParts = (instant: Date, timeZone: string) => {
	const parts = formatterFor(timeZone).formatToParts(instant);
	const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
	return {
		year: pick("year"),
		month: pick("month"),
		day: pick("day"),
		hour: pick("hour") % 24,
		minute: pick("minute"),
		second: pick("second"),
	};
};

/** Minutes the zone is ahead of UTC at that instant (negative for behind). */
export const zoneOffsetMinutes = (instant: Date, timeZone: string) => {
	if (!isValidTimeZone(timeZone)) throw new Error(`"${timeZone}" is not a known time zone.`);
	const parts = zonedParts(instant, timeZone);
	const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return Math.round((asUtc - instant.getTime()) / 60_000);
};

export const offsetLabel = (minutes: number) => {
	const sign = minutes < 0 ? "−" : "+";
	const absolute = Math.abs(minutes);
	const hours = Math.floor(absolute / 60);
	const rest = absolute % 60;
	return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
};

export const localHour = (instant: Date, timeZone: string) => zonedParts(instant, timeZone).hour;

export const dayKey = (instant: Date, timeZone: string) => {
	const parts = zonedParts(instant, timeZone);
	return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

/** The instant of local midnight in a zone, resolved twice so DST changes settle. */
export const zonedMidnight = (dateIso: string, timeZone: string) => {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateIso)) throw new Error("Pick a date first.");
	let guess = Date.parse(`${dateIso}T00:00:00Z`) - zoneOffsetMinutes(new Date(`${dateIso}T12:00:00Z`), timeZone) * 60_000;
	guess = Date.parse(`${dateIso}T00:00:00Z`) - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
	return new Date(guess);
};

export type SlotCell = { zoneId: string; hour: number; dayOffset: number; working: boolean };
export type Slot = { label: string; instant: Date; cells: SlotCell[] };

export type GridOptions = {
	date: string;
	baseZone: string;
	zones: string[];
	workStart?: number;
	workEnd?: number;
};

export const buildSlots = ({ date, baseZone, zones, workStart = WORK_START, workEnd = WORK_END }: GridOptions): Slot[] => {
	if (zones.length === 0) throw new Error("Pick at least one time zone.");
	if (workEnd <= workStart) throw new Error("The working day has to end after it starts.");
	const start = zonedMidnight(date, baseZone);
	const baseDay = dayKey(start, baseZone);
	return Array.from({ length: 24 }, (_, hour) => {
		const instant = new Date(start.getTime() + hour * 3_600_000);
		return {
			label: `${String(hour).padStart(2, "0")}:00`,
			instant,
			cells: zones.map((zoneId) => {
				const local = localHour(instant, zoneId);
				return {
					zoneId,
					hour: local,
					dayOffset: dayKey(instant, zoneId) === baseDay ? 0 : dayKey(instant, zoneId) > baseDay ? 1 : -1,
					working: local >= workStart && local < workEnd,
				};
			}),
		};
	});
};

/** Slots where every selected zone is inside working hours. */
export const overlapSlots = (slots: Slot[]) => slots.filter((slot) => slot.cells.every((cell) => cell.working));

export const describeOverlap = (slots: Slot[]) => {
	const best = overlapSlots(slots);
	if (best.length === 0) return { count: 0, first: "", last: "", text: "No hour works for everyone — someone will be outside a 9–17 day. Consider a shorter call or splitting the meeting." };
	const first = best[0].label;
	const last = best[best.length - 1].label;
	return {
		count: best.length,
		first,
		last,
		text: best.length === 1 ? `Only ${first} works for every zone.` : `${best.length} hours work for everyone, from ${first} to ${last}.`,
	};
};

export const formatHour = (hour: number, style: "24" | "12" = "24") => {
	if (style === "24") return `${String(hour).padStart(2, "0")}:00`;
	const suffix = hour < 12 ? "am" : "pm";
	const twelve = hour % 12 === 0 ? 12 : hour % 12;
	return `${twelve}${suffix}`;
};
