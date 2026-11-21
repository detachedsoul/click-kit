"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Plus, Star, Trash2 } from "lucide-react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, rowButtonClassName, selectClassName, smallActionClassName, ToolPanel } from "@/features/developer-tools/tool-ui";
import { useStoredState } from "@/features/productivity-tools/stored-state";
import {
	CLOCK_KEY,
	convertLocalTime,
	dateDifference,
	findWorkingOverlap,
	FAVOURITE_KEY,
	isZone,
	MAX_CITIES,
	offsetAt,
	WORLD_CITIES,
	overlapSummary,
	reviveZones,
	toggleFavourite,
	zoneName,
} from "@/features/productivity-tools/world-clock-utils";

const STARTER_CITIES = ["Africa/Lagos", "Europe/London", "America/New_York"];

const dayDifferenceLabel = (difference: number) => {
	if (difference === 0) return "same date";
	return difference > 0 ? `+${difference} day${difference === 1 ? "" : "s"}` : `${difference} day${difference === -1 ? "" : "s"} ago`;
};

const localInput = (instant: Date, zone: string) => {
	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
	const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
	return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
};

const localDate = (instant: Date, zone: string) => localInput(instant, zone).slice(0, 10);

export const WorldClock = () => {
	const [cities, setCities] = useStoredState<string[]>(CLOCK_KEY, STARTER_CITIES, (raw) => reviveZones(raw, STARTER_CITIES));
	const [favourites, setFavourites] = useStoredState<string[]>(FAVOURITE_KEY, [], (raw) => reviveZones(raw));
	const [now, setNow] = useState<Date | null>(null);
	const [homeZone, setHomeZone] = useState("UTC");
	const [selectedCity, setSelectedCity] = useState("");
	const [newZone, setNewZone] = useState("");
	const [sourceZone, setSourceZone] = useState("Africa/Lagos");
	const [meetingTime, setMeetingTime] = useState("");
	const [overlapDate, setOverlapDate] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		const tick = () => {
			setNow(new Date());
			try {
				const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
				if (isZone(detected)) setHomeZone(detected);
			} catch {
				// UTC remains the reference if the browser cannot name its local zone.
			}
		};
		const firstTick = window.setTimeout(tick, 0);
		const timer = window.setInterval(tick, 15_000);
		return () => {
			window.clearTimeout(firstTick);
			window.clearInterval(timer);
		};
	}, []);

	const referenceZone = cities[0] ?? homeZone;
	const displayedOverlapDate = overlapDate || (now ? localDate(now, referenceZone) : "");
	const overlap = useMemo(() => {
		if (!displayedOverlapDate || !cities.length) return { slots: [], error: "" };
		try {
			return { slots: findWorkingOverlap(displayedOverlapDate, referenceZone, cities), error: "" };
		} catch (caught) {
			return { slots: [], error: caught instanceof Error ? caught.message : "Could not compare these hours." };
		}
	}, [cities, displayedOverlapDate, referenceZone]);

	const conversion = useMemo(() => {
		if (!meetingTime) return { conversions: [], error: "" };
		try {
			return { ...convertLocalTime(meetingTime, sourceZone, cities.filter((zone) => zone !== sourceZone)), error: "" };
		} catch (caught) {
			return { conversions: [], error: caught instanceof Error ? caught.message : "Could not convert that meeting time." };
		}
	}, [cities, meetingTime, sourceZone]);

	const addCity = (raw = newZone) => {
		const zone = raw.trim();
		if (!zone) {
			setError("Choose a city or type an IANA time zone, such as Asia/Singapore.");
			return;
		}
		if (!isZone(zone)) {
			setError(`“${zone}” is not a valid IANA time zone. Try Europe/Paris or America/Los_Angeles.`);
			return;
		}
		if (cities.includes(zone)) {
			setError(`${zoneName(zone)} is already on your clock.`);
			return;
		}
		if (cities.length >= MAX_CITIES) {
			setError(`Keep up to ${MAX_CITIES} cities on your clock.`);
			return;
		}
		setCities((current) => [...current, zone]);
		setSelectedCity("");
		setNewZone("");
		setError("");
		setMessage(`${zoneName(zone)} added to your clock.`);
	};

	const removeCity = (zone: string) => {
		setCities((current) => current.filter((item) => item !== zone));
		setMessage(`${zoneName(zone)} removed from your clock.`);
	};

	const flipFavourite = (zone: string) => {
		setFavourites((current) => toggleFavourite(current, zone));
		setMessage(favourites.includes(zone) ? `${zoneName(zone)} removed from favourites.` : `${zoneName(zone)} saved as a favourite.`);
	};

	const quickAdd = favourites.filter((zone) => !cities.includes(zone));
	const cityError = error;

	return (
		<ToolPanel>
			<section className="flex flex-col gap-3" aria-labelledby="world-clock-title">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<div>
						<h2 className="m-0 text-sm font-semibold text-ink" id="world-clock-title">Cities on your clock</h2>
						<p className={`${hintClassName} mt-1`}>Your browser’s IANA time-zone database handles summer time and the clocks changing.</p>
					</div>
					<span className="text-xs text-muted">{cities.length} of {MAX_CITIES}</span>
				</div>

				{cities.length ? (
					<ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
						{cities.map((zone) => {
							const dateDelta = now ? dateDifference(now, zone, homeZone) : 0;
							const selected = favourites.includes(zone);
							return (
								<li className="flex min-w-0 flex-col gap-3 border border-line bg-[#fbfaf7] p-3" key={zone}>
									<div className="flex min-w-0 items-start justify-between gap-2">
										<div className="min-w-0">
											<h3 className="m-0 truncate text-sm font-semibold text-ink">{zoneName(zone)}</h3>
											<p className="m-0 truncate text-[11px] text-muted">{zone}</p>
										</div>
										<div className="flex shrink-0 gap-1">
											<button aria-label={`${selected ? "Remove" : "Save"} ${zoneName(zone)} ${selected ? "favourite" : "as favourite"}`} aria-pressed={selected} className="cursor-pointer p-1 text-forest focus-visible:outline-2 focus-visible:outline-accent" onClick={() => flipFavourite(zone)} title={selected ? "Remove favourite" : "Save favourite"} type="button">
												{selected ? <Star aria-hidden="true" fill="currentColor" size={15} /> : <Heart aria-hidden="true" size={15} />}
											</button>
											<button aria-label={`Remove ${zoneName(zone)}`} className="cursor-pointer p-1 text-muted hover:text-accent-dark focus-visible:outline-2 focus-visible:outline-accent" onClick={() => removeCity(zone)} title={`Remove ${zoneName(zone)}`} type="button">
												<Trash2 aria-hidden="true" size={15} />
											</button>
										</div>
									</div>
									<p className="m-0 font-mono text-[28px] leading-none tracking-[-.04em] text-ink" aria-label={`${zoneName(zone)} local time`}>
										{now ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now) : "—:—:—"}
									</p>
									<div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-muted">
										<span>{now ? new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(now) : "Local date"}</span>
										<span>{now ? offsetAt(now, zone) : "UTC offset"} · {dayDifferenceLabel(dateDelta)}</span>
									</div>
								</li>
							);
						})}
					</ul>
				) : (
					<p className="m-0 border border-dashed border-line p-4 text-sm text-muted">Your clock is empty. Add a city below to get time moving.</p>
				)}

				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<label className={labelClassName} htmlFor="world-clock-city">Choose from {WORLD_CITIES.length} cities</label>
						<select className={selectClassName} id="world-clock-city" onChange={(event) => { setSelectedCity(event.target.value); setError(""); }} value={selectedCity}>
							<option value="">Choose a city…</option>
							{["Africa", "Americas", "Europe", "Asia", "Oceania"].map((continent) => (
								<optgroup key={continent} label={continent}>
									{WORLD_CITIES.filter((city) => city.continent === continent).map((city) => (
										<option disabled={cities.includes(city.zone)} key={city.zone} value={city.zone}>{city.label}</option>
									))}
								</optgroup>
							))}
						</select>
						<button className={`${rowButtonClassName} mt-2`} disabled={!selectedCity || cities.length >= MAX_CITIES} onClick={() => addCity(selectedCity)} type="button"><Plus aria-hidden="true" size={13} /> Add city</button>
					</div>
					<div>
						<label className={labelClassName} htmlFor="world-clock-zone">Or add a custom IANA time zone</label>
						<input
							aria-describedby={cityError ? "world-clock-error" : undefined}
							className={fieldClassName}
							id="world-clock-zone"
							onChange={(event) => { setNewZone(event.target.value); setError(""); }}
							onKeyDown={(event) => { if (event.key === "Enter") addCity(); }}
							placeholder="America/Argentina/Buenos_Aires"
							type="text"
							value={newZone}
						/>
						<button className={`${rowButtonClassName} mt-2`} disabled={!newZone.trim() || cities.length >= MAX_CITIES} onClick={() => addCity()} type="button">Add custom zone</button>
					</div>
				</div>
				{cityError ? <p className="m-0 text-xs text-[#8a3f30]" id="world-clock-error" role="alert">{cityError}</p> : null}
				{message ? <p className="m-0 text-xs text-ink" role="status">{message}</p> : null}
				{quickAdd.length ? (
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-[11px] text-muted">Favourite cities:</span>
						{quickAdd.map((zone) => <button className={smallActionClassName} key={zone} onClick={() => addCity(zone)} type="button">{zoneName(zone)}</button>)}
					</div>
				) : null}
				<p className={hintClassName}>Choose from cities across five continents, or add any valid IANA zone such as America/Argentina/Buenos_Aires. Cities and favourites are saved only in this browser.</p>
			</section>

			<section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="time-convert-title">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="time-convert-title">Convert a meeting time</h2>
					<p className={`${hintClassName} mt-1`}>Choose the time where it starts; see the date and time everywhere else.</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className={labelClassName} htmlFor="world-clock-meeting-time">Date and local time
						<input className={fieldClassName} id="world-clock-meeting-time" onChange={(event) => setMeetingTime(event.target.value)} type="datetime-local" value={meetingTime} />
					</label>
					<label className={labelClassName} htmlFor="world-clock-source-zone">This time is in
						<select className={selectClassName} id="world-clock-source-zone" onChange={(event) => setSourceZone(event.target.value)} value={sourceZone}>
							{[...new Set([...cities, sourceZone, homeZone])].map((zone) => <option key={zone} value={zone}>{zoneName(zone)} · {zone}</option>)}
						</select>
					</label>
				</div>
				{conversion.error ? <ErrorNote message={conversion.error} /> : null}
				{conversion.conversions.length ? (
					<ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2">
						{conversion.conversions.map((entry) => (
							<li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border border-line bg-surface px-3 py-2" key={entry.zone}>
								<span className="text-xs font-semibold text-ink">{zoneName(entry.zone)}</span>
								<span className="font-mono text-xs text-ink">{entry.label}</span>
								<span className="text-[10px] text-muted">{entry.offset} · {dayDifferenceLabel(entry.dayDifference)}</span>
							</li>
						))}
					</ul>
				) : meetingTime ? null : <p className="m-0 text-xs text-muted">Choose a date and time to convert it for the cities on your clock.</p>}
			</section>

			<section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="working-overlap-title">
				<div>
					<h2 className="m-0 text-sm font-semibold text-ink" id="working-overlap-title">Find a shared working hour</h2>
					<p className={`${hintClassName} mt-1`}>Which hours land between 09:00 and 17:00 for every city on your clock?</p>
				</div>
				<label className={`${labelClassName} max-w-64`} htmlFor="world-clock-overlap-date">Date to compare
					<input className={fieldClassName} id="world-clock-overlap-date" onChange={(event) => setOverlapDate(event.target.value)} type="date" value={displayedOverlapDate} />
				</label>
				{overlap.error ? <ErrorNote message={overlap.error} /> : null}
				<p className="m-0 border border-[#d8dfd1] bg-[#e9ede3] px-3 py-2.5 text-xs leading-relaxed text-[#41493f]" role="status">
					{cities.length ? overlapSummary(overlap.slots, referenceZone) : "Add at least one city to find an overlap."}
				</p>
				{overlap.slots.length ? (
					<div className="overflow-x-auto border border-line">
						<table className="w-full border-collapse text-left text-xs">
							<caption className="sr-only">Shared working hours in every city</caption>
							<thead><tr className="bg-[#f7f5ee]"><th className="border-b border-line px-3 py-2 font-semibold" scope="col">{zoneName(referenceZone)} time</th>{cities.map((zone) => <th className="border-b border-line px-3 py-2 font-semibold" key={zone} scope="col">{zoneName(zone)}</th>)}</tr></thead>
							<tbody>{overlap.slots.map((slot) => <tr key={slot.anchorHour}><th className="border-b border-line px-3 py-1.5 font-mono font-normal" scope="row">{String(slot.anchorHour).padStart(2, "0")}:00</th>{cities.map((zone) => <td className="border-b border-line px-3 py-1.5 font-mono" key={zone}>{String(slot.localHours[zone]).padStart(2, "0")}:00{slot.localDays[zone] !== 0 ? <span className="ml-1 text-[10px] text-muted">{slot.localDays[zone] > 0 ? "+1d" : "−1d"}</span> : null}</td>)}</tr>)}</tbody>
						</table>
					</div>
				) : null}
				<p className={hintClassName}>Every date and offset is calculated for the date you choose. Daylight-saving transitions can make a local time repeat or disappear; a time that does not exist is called out instead of silently shifted.</p>
			</section>
		</ToolPanel>
	);
};
