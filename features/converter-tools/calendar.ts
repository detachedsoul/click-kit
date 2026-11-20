/**
 * Calendars: iCalendar (.ics) and CSV.
 *
 * A calendar file is a list of events with long property names; a spreadsheet is the same
 * list with short column headings. Times are read as written, and every timed event is
 * written back in UTC, which is what calendar apps expect.
 */

export type CalendarEvent = {
	title: string;
	start: string;
	end: string;
	allDay: boolean;
	location: string;
	description: string;
	repeats: string;
};

export const EMPTY_EVENT: CalendarEvent = { title: "", start: "", end: "", allDay: false, location: "", description: "", repeats: "" };

export const EVENT_COLUMNS: { key: keyof CalendarEvent; label: string }[] = [
	{ key: "title", label: "Title" },
	{ key: "start", label: "Start" },
	{ key: "end", label: "End" },
	{ key: "allDay", label: "All day" },
	{ key: "location", label: "Location" },
	{ key: "description", label: "Description" },
	{ key: "repeats", label: "Repeats" },
];

const unfold = (source: string) => source.replace(/\r\n?/gu, "\n").replace(/\n[ \t]/gu, "");

const decode = (value: string) =>
	value
		.replace(/\\n/giu, "\n")
		.replace(/\\,/gu, ",")
		.replace(/\\;/gu, ";")
		.replace(/\\\\/gu, "\\")
		.trim();

const pad = (value: number) => String(value).padStart(2, "0");

/** "20261115T140000Z" → "2026-11-15 14:00", "20261115" → "2026-11-15". */
export const formatStamp = (stamp: string) => {
	const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/u.exec(stamp.trim());
	if (!match) return "";
	const date = `${match[1]}-${match[2]}-${match[3]}`;
	return match[4] ? `${date} ${match[4]}:${match[5]}` : date;
};

/** The other direction: "2026-11-15 14:00" → "20261115T140000Z". */
export const toStamp = (value: string, allDay: boolean) => {
	const text = value.trim().replace("T", " ");
	const day = /^(\d{4})-?(\d{2})-?(\d{2})/u.exec(text);
	if (!day) return "";
	const time = /(\d{2}):?(\d{2})/u.exec(text.slice(day[0].length));
	if (allDay || !time) return `${day[1]}${day[2]}${day[3]}`;
	return `${day[1]}${day[2]}${day[3]}T${time[1]}${time[2]}00Z`;
};

const isAllDay = (parameters: string, stamp: string) => /VALUE=DATE(?!-TIME)/iu.test(parameters) || !/T\d/u.test(stamp);

export const parseIcs = (source: string): CalendarEvent[] => {
	const text = unfold(source);
	const events: CalendarEvent[] = [];
	for (const block of text.split(/BEGIN:VEVENT/iu).slice(1)) {
		const body = block.split(/END:VEVENT/iu)[0] ?? "";
		const event: CalendarEvent = { ...EMPTY_EVENT };
		let allDay = false;
		for (const rawLine of body.split("\n")) {
			const line = rawLine.trim();
			const colon = line.indexOf(":");
			if (colon === -1) continue;
			const left = line.slice(0, colon);
			const value = line.slice(colon + 1);
			const [rawName, ...params] = left.split(";");
			const name = rawName.toUpperCase();
			const parameters = params.join(";");
			if (name === "SUMMARY") event.title = decode(value);
			else if (name === "DTSTART") {
				event.start = formatStamp(value);
				allDay = isAllDay(parameters, value);
			} else if (name === "DTEND") event.end = formatStamp(value);
			else if (name === "LOCATION") event.location = decode(value);
			else if (name === "DESCRIPTION") event.description = decode(value);
			else if (name === "RRULE") event.repeats = decode(value);
		}
		event.allDay = allDay;
		if (event.title || event.start) events.push(event);
	}
	return events;
};

const csvCell = (value: string) => (/[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value);

export const eventsToCsv = (events: CalendarEvent[]): string => {
	const header = EVENT_COLUMNS.map((column) => csvCell(column.label)).join(",");
	const rows = events.map((event) =>
		EVENT_COLUMNS.map((column) => csvCell(column.key === "allDay" ? (event.allDay ? "yes" : "no") : event[column.key])).join(","),
	);
	return [header, ...rows].join("\n").concat(events.length ? "\n" : "");
};

/** Splits CSV text into records, respecting quotes. */
export const splitCsv = (source: string): string[][] => {
	const text = source.replace(/\r\n?/gu, "\n");
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (quoted) {
			if (char === '"' && text[index + 1] === '"') {
				cell += '"';
				index += 1;
			} else if (char === '"') quoted = false;
			else cell += char;
			continue;
		}
		if (char === '"') quoted = true;
		else if (char === ",") {
			row.push(cell);
			cell = "";
		} else if (char === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else cell += char;
	}
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
};

export const eventsFromCsv = (source: string): CalendarEvent[] => {
	const rows = splitCsv(source);
	if (rows.length < 2) return [];
	const keys = rows[0].map((label) => EVENT_COLUMNS.find((column) => column.label.toLowerCase() === label.trim().toLowerCase())?.key ?? null);
	return rows
		.slice(1)
		.map((row) => {
			const event: CalendarEvent = { ...EMPTY_EVENT };
			keys.forEach((key, index) => {
				const value = (row[index] ?? "").trim();
				if (!key) return;
				if (key === "allDay") event.allDay = /^(yes|true|y|1|x)$/iu.test(value);
				else event[key] = value;
			});
			if (!event.end && event.start) event.end = event.start;
			return event;
		})
		.filter((event) => event.title || event.start);
};

const escapeIcs = (value: string) => value.replace(/\\/gu, "\\\\").replace(/\n/gu, "\\n").replace(/;/gu, "\\;").replace(/,/gu, "\\,");

const fold = (line: string) => {
	if (line.length <= 75) return line;
	const parts: string[] = [];
	for (let index = 0; index < line.length; index += 75) parts.push(line.slice(index, index + 75));
	return parts.join("\n ");
};

export const toIcs = (events: CalendarEvent[], calendarName = "ClickKit calendar"): string => {
	const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClickKit//Converters//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcs(calendarName)}`];
	events.forEach((event, index) => {
		const start = toStamp(event.start, event.allDay);
		const end = toStamp(event.end || event.start, event.allDay);
		lines.push("BEGIN:VEVENT");
		lines.push(`UID:${start || "event"}-${index + 1}@clickkit.local`);
		lines.push(`DTSTAMP:${toStamp(new Date().toISOString().slice(0, 16).replace("T", " "), false)}`);
		if (start) lines.push(event.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`);
		if (end) lines.push(event.allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`);
		lines.push(`SUMMARY:${escapeIcs(event.title || "Untitled event")}`);
		if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
		if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
		if (event.repeats) lines.push(`RRULE:${event.repeats.replace(/^RRULE:/iu, "").trim()}`);
		lines.push("END:VEVENT");
	});
	lines.push("END:VCALENDAR");
	return lines.map(fold).join("\n").concat("\n");
};

/** A readable "15 Nov 2026 14:00" for the table, without pulling in a date library. */
export const friendlyTime = (value: string) => (value ? value.replace(/^(\d{4})-(\d{2})-(\d{2})/u, (_, year, month, day) => `${day}/${month}/${year}`) : "");

export const todayStamp = () => {
	const now = new Date();
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
