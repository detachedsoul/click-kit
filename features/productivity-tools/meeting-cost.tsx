"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { buttonClassName, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import { clockLabel, costOf, costPerHour, costPerMinute, CURRENCIES, type Currency, DURATIONS, MAX_ATTENDEES, MAX_RATE, money, sanitiseAttendees, sanitiseRate } from "@/features/productivity-tools/meeting-cost-utils";
import { CopyTextButton } from "@/features/text-tools/text-tool-shared";

export const MeetingCostMeter = () => {
	const [attendees, setAttendees] = useState("6");
	const [rate, setRate] = useState("45");
	const [currency, setCurrency] = useState<Currency>("GBP");
	const [seconds, setSeconds] = useState(0);
	const [running, setRunning] = useState(false);
	const secondsRef = useRef(0);

	const people = sanitiseAttendees(Number(attendees));
	const hourly = sanitiseRate(Number(rate));
	const spent = costOf(people, hourly, seconds / 60);

	useEffect(() => {
		secondsRef.current = seconds;
	}, [seconds]);

	useEffect(() => {
		if (!running) return;
		// Counting from the moment the clock started, rather than adding one per tick, so a
		// tab that was asleep still shows the real elapsed time when it wakes up.
		const began = Date.now() - secondsRef.current * 1000;
		const timer = setInterval(() => {
			setSeconds(Math.max(0, Math.round((Date.now() - began) / 1000)));
		}, 500);
		return () => clearInterval(timer);
	}, [running]);

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<div>
					<label className={labelClassName} htmlFor="meeting-cost-people">
						People in the room
					</label>
					<input className={fieldClassName} id="meeting-cost-people" max={MAX_ATTENDEES} min={0} onChange={(event) => setAttendees(event.target.value)} type="number" value={attendees} />
				</div>
				<div>
					<label className={labelClassName} htmlFor="meeting-cost-rate">
						Cost each per hour
					</label>
					<input className={fieldClassName} id="meeting-cost-rate" max={MAX_RATE} min={0} onChange={(event) => setRate(event.target.value)} step={1} type="number" value={rate} />
				</div>
				<div>
					<label className={labelClassName} htmlFor="meeting-cost-currency">
						Currency
					</label>
					<select className={`${selectClassName} mt-2`} id="meeting-cost-currency" onChange={(event) => setCurrency(event.target.value as Currency)} value={currency}>
						{CURRENCIES.map((code) => (
							<option key={code} value={code}>
								{code}
							</option>
						))}
					</select>
				</div>
			</div>
			<div className="border border-line bg-[#f8f7f3] p-4">
				<p className={hintClassName}>This meeting has cost</p>
				<p aria-live="polite" className="m-0 mt-1 font-mono text-3xl font-semibold tabular-nums text-ink" role="status">
					{money(spent, currency)}
				</p>
				<p className="m-0 mt-1 text-xs text-muted">
					{clockLabel(seconds)} of a {money(costPerHour(people, hourly), currency)} an hour room — {money(costPerMinute(people, hourly), currency)} a minute
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<button className={primaryButtonClassName} onClick={() => setRunning((current) => !current)} type="button">
					{running ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />} {running ? "Pause the clock" : seconds ? "Carry on" : "Start the clock"}
				</button>
				<button
					className={buttonClassName}
					onClick={() => {
						setRunning(false);
						setSeconds(0);
					}}
					type="button"
				>
					<RotateCcw aria-hidden="true" size={14} /> Reset
				</button>
				<CopyTextButton text={`${money(spent, currency)} so far after ${clockLabel(seconds)} — ${people} ${people === 1 ? "person" : "people"} at ${money(costPerHour(people, hourly), currency)} an hour.`} />
			</div>
			<div>
				<p className={labelClassName}>What it costs by length</p>
				<StatGrid
					items={DURATIONS.map((duration) => ({
						label: duration.label,
						value: money(costOf(people, hourly, duration.minutes), currency),
					}))}
				/>
			</div>
			<StatGrid
				items={[
					{ label: "Per minute", value: money(costPerMinute(people, hourly), currency) },
					{ label: "Per hour", value: money(costPerHour(people, hourly), currency) },
					{ label: "People", value: String(people) },
					{ label: "Clock", value: clockLabel(seconds) },
				]}
			/>
			<p className={hintClassName}>
				A rough figure, not an invoice: it charges each person their hourly cost for the time the clock runs, and says nothing about what the meeting was worth.
			</p>
		</ToolPanel>
	);
};
