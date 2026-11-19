import { describe, expect, it } from "vitest";
import { eventsFromCsv, eventsToCsv, formatStamp, parseIcs, toIcs, toStamp } from "@/features/converter-tools/calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example//EN
BEGIN:VEVENT
UID:one@example.com
DTSTART:20261115T140000Z
DTEND:20261115T150000Z
SUMMARY:Budget review
LOCATION:Room 4
DESCRIPTION:Numbers for the quarter\\, plus next steps
END:VEVENT
BEGIN:VEVENT
UID:two@example.com
DTSTART;VALUE=DATE:20261201
DTEND;VALUE=DATE:20261202
SUMMARY:Public holiday
END:VEVENT
BEGIN:VEVENT
UID:three@example.com
DTSTART;TZID=Africa/Lagos:20270110T090000
DTEND;TZID=Africa/Lagos:20270110T100000
SUMMARY:Stand-up
RRULE:FREQ=WEEKLY;BYDAY=MO
DESCRIPTION:A description that has been folded
  across two lines
END:VEVENT
END:VCALENDAR
`;

describe("ics parsing", () => {
	it("reads every event with its times", () => {
		const events = parseIcs(ICS);
		expect(events).toHaveLength(3);
		expect(events[0]).toMatchObject({ title: "Budget review", start: "2026-11-15 14:00", end: "2026-11-15 15:00", allDay: false, location: "Room 4" });
		expect(events[0].description).toBe("Numbers for the quarter, plus next steps");
	});

	it("marks date-only events as all day", () => {
		expect(parseIcs(ICS)[1]).toMatchObject({ title: "Public holiday", start: "2026-12-01", end: "2026-12-02", allDay: true });
	});

	it("keeps time zones as wall time and rules as written", () => {
		const standup = parseIcs(ICS)[2];
		expect(standup.start).toBe("2027-01-10 09:00");
		expect(standup.repeats).toBe("FREQ=WEEKLY;BYDAY=MO");
		expect(standup.description).toBe("A description that has been folded across two lines");
	});

	it("ignores files with no events", () => {
		expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
	});

	it("formats and writes stamps", () => {
		expect(formatStamp("20261115T140000Z")).toBe("2026-11-15 14:00");
		expect(formatStamp("20261115")).toBe("2026-11-15");
		expect(toStamp("2026-11-15 14:00", false)).toBe("20261115T140000Z");
		expect(toStamp("2026-12-01", true)).toBe("20261201");
		expect(toStamp("not a date", false)).toBe("");
	});
});

describe("ico to csv", () => {
	it("writes a table with a yes or no for all-day", () => {
		const csv = eventsToCsv(parseIcs(ICS));
		expect(csv.split("\n")[0]).toBe("Title,Start,End,All day,Location,Description,Repeats");
		expect(csv).toContain("Budget review,2026-11-15 14:00,2026-11-15 15:00,no,Room 4");
		expect(csv).toContain("Public holiday,2026-12-01,2026-12-02,yes");
	});

	it("reads its own csv back", () => {
		const events = eventsFromCsv(eventsToCsv(parseIcs(ICS)));
		expect(events).toHaveLength(3);
		expect(events[1].allDay).toBe(true);
		expect(events[2].title).toBe("Stand-up");
	});

	it("needs a header before reading rows", () => {
		expect(eventsFromCsv("Budget review,2026-11-15 14:00")).toEqual([]);
	});
});

describe("csv to ics", () => {
	it("writes a calendar a phone can subscribe to", () => {
		const ics = toIcs(eventsFromCsv(eventsToCsv(parseIcs(ICS))), "Work");
		expect(ics.startsWith("BEGIN:VCALENDAR\nVERSION:2.0")).toBe(true);
		expect(ics).toContain("X-WR-CALNAME:Work");
		expect(ics.match(/BEGIN:VEVENT/gu)).toHaveLength(3);
		expect(ics).toContain("DTSTART:20261115T140000Z");
		expect(ics).toContain("DTSTART;VALUE=DATE:20261201");
		expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
		expect(ics).toContain("SUMMARY:Public holiday");
		expect(ics).toContain("END:VCALENDAR");
	});

	it("gives missing titles a placeholder and missing ends a start", () => {
		const ics = toIcs([{ title: "", start: "2026-11-15 14:00", end: "", allDay: false, location: "", description: "", repeats: "" }]);
		expect(ics).toContain("SUMMARY:Untitled event");
		expect(ics).toContain("DTEND:20261115T140000Z");
	});
});
