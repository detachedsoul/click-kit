"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, SegmentedControl, StatGrid, ToolPanel, hintClassName } from "@/features/developer-tools/tool-ui";
import { eventsFromCsv, eventsToCsv, parseIcs, toIcs } from "@/features/converter-tools/calendar";
import { TextAreaField } from "@/features/text-tools/text-tool-shared";

type Direction = "ics-to-csv" | "csv-to-ics";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261120T100000Z
DTEND:20261120T110000Z
SUMMARY:Rent due
LOCATION:Bank transfer
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261201
DTEND;VALUE=DATE:20261202
SUMMARY:Public holiday
END:VEVENT
END:VCALENDAR
`;

const SAMPLE_CSV = `Title,Start,End,All day,Location,Description,Repeats
Rent due,2026-11-20 10:00,2026-11-20 11:00,no,Bank transfer,,
Public holiday,2026-12-01,2026-12-02,yes,,,`;

export const CalendarConverterTool = () => {
	const [direction, setDirection] = useState<Direction>("ics-to-csv");
	const [source, setSource] = useState(SAMPLE_ICS);

	const result = useMemo(() => {
		const trimmed = source.trim();
		if (!trimmed) return { value: "", error: "", count: 0 };
		if (direction === "ics-to-csv") {
			const events = parseIcs(trimmed);
			if (events.length === 0) return { value: "", error: "No events found. An .ics file holds BEGIN:VEVENT … END:VEVENT blocks with a DTSTART.", count: 0 };
			return { value: eventsToCsv(events), error: "", count: events.length };
		}
		const events = eventsFromCsv(trimmed);
		if (events.length === 0) return { value: "", error: "No rows found. The first line needs headings such as Title, Start, End.", count: 0 };
		return { value: toIcs(events), error: "", count: events.length };
	}, [source, direction]);

	const switchDirection = (next: Direction) => {
		setDirection(next);
		setSource((current) => {
			const untouched = !current.trim() || current === SAMPLE_ICS || current === SAMPLE_CSV;
			if (!untouched) return current;
			return next === "ics-to-csv" ? SAMPLE_ICS : SAMPLE_CSV;
		});
	};

	return (
		<ToolPanel>
			<SegmentedControl<Direction>
				label="Conversion direction"
				onChange={switchDirection}
				options={[
					{ id: "ics-to-csv", label: "Calendar to CSV" },
					{ id: "csv-to-ics", label: "CSV to calendar" },
				]}
				value={direction}
			/>
			<TextAreaField
				hint={
					direction === "ics-to-csv"
						? "Times keep the wall clock written in the file; repeating events are carried as their rule text."
						: "Dates can be 2026-11-20 10:00 or just 2026-11-20. Timed events are written in UTC, the way calendar apps expect."
				}
				id="calendar-input"
				label={direction === "ics-to-csv" ? "Calendar (.ics)" : "CSV"}
				onChange={setSource}
				placeholder={direction === "ics-to-csv" ? "BEGIN:VCALENDAR…" : "Title,Start,End…"}
				rows={12}
				value={source}
			/>
			<StatGrid
				items={[
					{ label: "Events", value: String(result.count) },
					{ label: "Input", value: `${source.trim().length.toLocaleString()} chars` },
					{ label: "Output", value: `${result.value.length.toLocaleString()} chars` },
					{ label: "Lines", value: String(result.value ? result.value.split("\n").length : 0) },
				]}
			/>
			<ErrorNote message={result.error} />
			{!result.error ? (
				<ResultBlock fileName={direction === "ics-to-csv" ? "events.csv" : "events.ics"} title={direction === "ics-to-csv" ? "CSV output" : "Calendar output"} value={result.value} />
			) : null}
			<p className={hintClassName}>Your dates stay in this tab; nothing is uploaded.</p>
		</ToolPanel>
	);
};
