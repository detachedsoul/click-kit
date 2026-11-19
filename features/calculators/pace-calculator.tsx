"use client";

import { useState } from "react";
import { ErrorNote, fieldClassName, hintClassName, labelClassName, ResultBlock, SegmentedControl, selectClassName, StatGrid, ToolPanel } from "@/features/developer-tools/tool-ui";
import {
	distanceForTime,
	evenSplits,
	formatDistance,
	formatDuration,
	formatPace,
	PACE_PRESETS,
	pacePerKm,
	parseDistance,
	parseDuration,
	speedKph,
	timeForDistance,
} from "@/features/calculators/pace-utils";

type Solve = "pace" | "time" | "distance";

export const PaceCalculator = () => {
	const [solve, setSolve] = useState<Solve>("pace");
	const [distanceInput, setDistanceInput] = useState("10");
	const [timeInput, setTimeInput] = useState("50:00");
	const [paceInput, setPaceInput] = useState("5:00");
	const [unit, setUnit] = useState<"km" | "mi">("km");

	const result = (() => {
		try {
			const distance = solve === "distance" ? 0 : parseDistance(distanceInput);
			const time = solve === "time" ? 0 : parseDuration(timeInput);
			const pace = solve === "pace" ? 0 : parseDuration(paceInput);
			if (solve === "pace") {
				const secondsPerKm = pacePerKm(distance, time);
				return { secondsPerKm, time, distance, error: "" };
			}
			if (solve === "time") {
				const secondsPerKm = pacePerKm(1, pace);
				return { secondsPerKm, time: timeForDistance(distance, secondsPerKm), distance, error: "" };
			}
			const secondsPerKm = pacePerKm(1, pace);
			return { secondsPerKm, time, distance: distanceForTime(time, secondsPerKm), error: "" };
		} catch (caught) {
			return { secondsPerKm: 0, time: 0, distance: 0, error: caught instanceof Error ? caught.message : "Check the numbers and try again." };
		}
	})();

	const valid = !result.error && result.distance > 0 && result.time > 0 && Number.isFinite(result.secondsPerKm);
	const splits = valid ? evenSplits(result.distance, result.time) : [];
	const summary = valid
		? [
				`Distance: ${formatDistance(result.distance)} (${formatDistance(result.distance, "mi")})`,
				`Time: ${formatDuration(result.time)}`,
				`Pace: ${formatPace(result.secondsPerKm)} (${formatPace(result.secondsPerKm, "mi")})`,
				`Speed: ${speedKph(result.distance, result.time).toFixed(2)} km/h`,
			].join("\n")
		: "";

	return (
		<ToolPanel>
			<SegmentedControl
				label="What do you want to find?"
				onChange={setSolve}
				options={[
					{ id: "pace", label: "Pace" },
					{ id: "time", label: "Finish time" },
					{ id: "distance", label: "Distance" },
				]}
				value={solve}
			/>
			<div className="grid gap-4 sm:grid-cols-3">
				{solve !== "distance" ? (
					<label className={labelClassName} htmlFor="pace-distance">
						Distance (km or mi)
						<input className={fieldClassName} id="pace-distance" onChange={(event) => setDistanceInput(event.target.value)} value={distanceInput} />
					</label>
				) : null}
				{solve !== "time" ? (
					<label className={labelClassName} htmlFor="pace-time">
						Time (h:mm:ss)
						<input className={fieldClassName} id="pace-time" onChange={(event) => setTimeInput(event.target.value)} placeholder="50:00" value={timeInput} />
					</label>
				) : null}
				{solve !== "pace" ? (
					<label className={labelClassName} htmlFor="pace-pace">
						Pace per {unit === "km" ? "km" : "mile"}
						<input className={fieldClassName} id="pace-pace" onChange={(event) => setPaceInput(event.target.value)} placeholder="5:00" value={paceInput} />
					</label>
				) : null}
				<span className="flex flex-col justify-end gap-2">
					<span className={labelClassName}>Preset distances</span>
					<span className="flex flex-wrap gap-2">
						{PACE_PRESETS.map((preset) => (
							<button
								className="cursor-pointer border border-line bg-[#fbfaf7] px-2.5 py-1 text-[11px] hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								key={preset.label}
								onClick={() => {
									setSolve((current) => (current === "distance" ? "pace" : current));
									setDistanceInput(String(preset.km));
								}}
								type="button"
							>
								{preset.label}
							</button>
						))}
					</span>
				</span>
			</div>
			<label className={labelClassName} htmlFor="pace-unit">
				Speed shown in
				<select className={selectClassName} id="pace-unit" onChange={(event) => setUnit(event.target.value === "mi" ? "mi" : "km")} value={unit}>
					<option value="km">Kilometres</option>
					<option value="mi">Miles</option>
				</select>
			</label>
			<ErrorNote message={result.error} />
			{valid ? (
				<>
					<StatGrid
						items={[
							{ label: "Pace", value: formatPace(result.secondsPerKm) },
							{ label: "Pace per mile", value: formatPace(result.secondsPerKm, "mi") },
							{ label: "Finish time", value: formatDuration(result.time) },
							{ label: unit === "km" ? "Speed (km/h)" : "Speed (mph)", value: (unit === "km" ? speedKph(result.distance, result.time) : speedKph(result.distance, result.time) / 1.609344).toFixed(2) },
						]}
					/>
					<section className="flex flex-col gap-2">
						<h2 className="m-0 text-sm font-semibold">Even 5 km splits</h2>
						<ol className="m-0 flex list-none flex-col gap-1 p-0">
							{splits.map((split) => (
								<li className="flex items-center justify-between gap-3 border border-line bg-[#fbfaf7] px-3 py-1.5 text-xs" key={split.distance}>
									<span className="text-ink">{formatDistance(split.distance)}</span>
									<span className="font-mono text-muted">{formatDuration(split.time)}</span>
								</li>
							))}
						</ol>
					</section>
					<ResultBlock fileName="pace-summary.txt" rows={5} title="Pace summary" value={summary} />
				</>
			) : null}
			<p className={hintClassName}>
				Pace is time divided by distance; speed is the same relationship upside down. Times are entered as hh:mm:ss or mm:ss, and a bare number is read as
				seconds.
			</p>
		</ToolPanel>
	);
};
