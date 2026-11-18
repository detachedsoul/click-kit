"use client";

import { useState } from "react";
import { CheckboxField, ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	buildSlots,
	DEFAULT_ZONES,
	describeOverlap,
	formatHour,
	MAX_ZONES,
	offsetLabel,
	overlapSlots,
	TIME_ZONES,
	WORK_END,
	WORK_START,
	zoneOffsetMinutes,
	zonedMidnight,
} from "@/features/productivity-tools/timezone-utils";

const today = () => new Date().toISOString().slice(0, 10);

export const MeetingPlanner = () => {
	const [date, setDate] = useState(today);
	const [baseZone, setBaseZone] = useState("Europe/London");
	const [zones, setZones] = useState<string[]>(DEFAULT_ZONES);
	const [twelveHour, setTwelveHour] = useState(false);

	const result = (() => {
		try {
			const slots = buildSlots({ date, baseZone, zones });
			return { slots, overlap: describeOverlap(slots), error: "" };
		} catch (caught) {
			return { slots: [], overlap: describeOverlap([]), error: caught instanceof Error ? caught.message : "Could not build this grid." };
		}
	})();

	const toggleZone = (zone: string, checked: boolean) => {
		setZones((current) => {
			if (checked) return current.length >= MAX_ZONES ? current : [...current, zone];
			return current.filter((item) => item !== zone);
		});
	};

	const label = (zone: string) => TIME_ZONES.find((item) => item.id === zone)?.label ?? zone;
	const shift = (zone: string) => {
		try {
			return offsetLabel(zoneOffsetMinutes(zonedMidnight(date, baseZone), zone));
		} catch {
			return "";
		}
	};

	const best = overlapSlots(result.slots);
	const bestLabels = best.map((slot) => slot.label);

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="planner-date">
					Date
					<input className={fieldClassName} id="planner-date" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
				</label>
				<label className={labelClassName} htmlFor="planner-base">
					Your time zone
					<select className={selectClassName} id="planner-base" onChange={(event) => setBaseZone(event.target.value)} value={baseZone}>
						{TIME_ZONES.map((zone) => (
							<option key={zone.id} value={zone.id}>
								{zone.label}
							</option>
						))}
					</select>
				</label>
				<label className={labelClassName} htmlFor="planner-format">
					Hour format
					<select className={selectClassName} id="planner-format" onChange={(event) => setTwelveHour(event.target.value === "12")} value={twelveHour ? "12" : "24"}>
						<option value="24">24-hour</option>
						<option value="12">12-hour</option>
					</select>
				</label>
			</div>
			<fieldset className="m-0 min-w-0 border-0 p-0">
				<legend className={`${labelClassName} mb-2`}>Time zones to compare ({zones.length} of {MAX_ZONES})</legend>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{TIME_ZONES.map((zone) => (
						<CheckboxField
							checked={zones.includes(zone.id)}
							disabled={!zones.includes(zone.id) && zones.length >= MAX_ZONES}
							id={`planner-zone-${zone.id}`}
							key={zone.id}
							label={zone.label}
							onChange={(checked) => toggleZone(zone.id, checked)}
						/>
					))}
				</div>
			</fieldset>
			<ErrorNote message={result.error} />
			{result.slots.length > 0 && zones.length > 0 ? (
				<>
					<p className="m-0 border border-[#d8dfd1] bg-[#e9ede3] px-[15px] py-3 text-[13px] leading-relaxed text-[#41493f]" role="status">
						{result.overlap.text}
					</p>
					<div className="overflow-x-auto border border-line">
						<table className="w-full border-collapse text-left text-xs">
							<caption className="sr-only">Local hour in each selected time zone, hour by hour</caption>
							<thead>
								<tr className="bg-[#f7f5ee]">
									<th className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[.06em] text-[#7a7c72]" scope="col">
										{label(baseZone)}
									</th>
									{zones.map((zone) => (
										<th className="border-b border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[.06em] text-[#7a7c72]" key={zone} scope="col">
											{label(zone)} <span className="font-normal normal-case tracking-normal text-[#a09f95]">{shift(zone)}</span>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{result.slots.map((slot) => {
									const worksForEveryone = bestLabels.includes(slot.label);
									return (
										<tr className={worksForEveryone ? "bg-[#eef3e8]" : undefined} key={slot.label}>
											<th className="border-b border-line px-3 py-1.5 font-mono text-[11px] font-normal text-ink" scope="row">
												{formatHour(Number(slot.label.slice(0, 2)), twelveHour ? "12" : "24")}
												{worksForEveryone ? <span className="ml-2 text-[10px] uppercase tracking-[.04em] text-[#4d6247]">works</span> : null}
											</th>
											{slot.cells.map((cell) => (
												<td
													className={`border-b border-line px-3 py-1.5 font-mono text-[11px] ${cell.working ? "text-ink" : "text-[#a8a79d]"}`}
													key={cell.zoneId}
												>
													{formatHour(cell.hour, twelveHour ? "12" : "24")}
													{cell.dayOffset !== 0 ? <span className="ml-1 text-[10px] text-[#b08a4e]">{cell.dayOffset > 0 ? "+1d" : "−1d"}</span> : null}
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<StatGrid
						items={[
							{ label: "Zones", value: String(zones.length) },
							{ label: "Working hours", value: `${WORK_START}:00 – ${WORK_END}:00 local` },
							{ label: "Hours that work for all", value: String(result.overlap.count) },
							{ label: "Best window", value: result.overlap.count > 0 ? `${result.overlap.first} – ${result.overlap.last} ${label(baseZone)}` : "None" },
						]}
					/>
					<ResultBlock
						fileName="meeting-windows.txt"
						rows={6}
						title="Suggested windows"
						value={
							best.length === 0
								? "No hour overlaps for these zones. Try a shorter call, or meet twice."
								: best
										.map((slot) => `${slot.label} ${label(baseZone)} — ${slot.cells.map((cell) => `${label(cell.zoneId)} ${formatHour(cell.hour, twelveHour ? "12" : "24")}`).join(", ")}`)
										.join("\n")
						}
					/>
					<p className={hintClassName}>
						Shaded rows fall inside {WORK_START}:00–{WORK_END}:00 in every selected zone. Daylight saving is handled by your browser&apos;s own time zone
						database, so check the offsets above again closer to the date — governments change them more often than you would hope.
					</p>
				</>
			) : null}
			<p className={hintClassName}>
				The grid starts at midnight on the chosen date in {label(baseZone)}{zones.length > 0 ? ` and shows the local hour in each of the ${zones.length} zones you picked` : ""}. Hours outside the working day are greyed out, and a ±1d marker means that person is already on the next or previous day.
			</p>
		</ToolPanel>
	);
};
