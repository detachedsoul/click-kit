"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import { formatClock, formatDuration, sumDurations, type DurationRow } from "@/features/calculators/duration-utils";

const starterRows: DurationRow[] = [
	{ id: "row-1", text: "1:30", sign: 1 },
	{ id: "row-2", text: "45m", sign: 1 },
	{ id: "row-3", text: "0:20", sign: 1 },
];

let nextId = starterRows.length + 1;

export default function DurationCalculator() {
	const [rows, setRows] = useState<DurationRow[]>(starterRows);
	const totals = useMemo(() => sumDurations(rows), [rows]);
	const update = (id: string, patch: Partial<DurationRow>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
	const report = useMemo(
		() =>
			[
				"Entries",
				...rows
					.filter((row) => row.text.trim())
					.map((row, index) => `${String(index + 1).padStart(2, "0")}. ${row.sign === 1 ? "+" : "−"} ${row.text.trim()}`),
				"",
				`Total        ${formatDuration(totals.seconds)}`,
				`Clock        ${formatClock(totals.seconds)}`,
				`Decimal      ${totals.decimalHours}`,
				`Minutes      ${totals.minutes}`,
				`8-hour days  ${totals.workdays}`,
			].join("\n"),
		[rows, totals],
	);
	return (
		<ToolPanel>
			<div className="flex flex-col gap-3">
				<span className={labelClassName}>Durations</span>
				{rows.map((row) => (
					<div className="flex flex-wrap items-end gap-2" key={row.id}>
						<label className="w-24" htmlFor={`${row.id}-sign`}>
							<span className="sr-only">Add or subtract</span>
							<select
								className={selectClassName}
								id={`${row.id}-sign`}
								onChange={(event) => update(row.id, { sign: event.target.value === "-1" ? -1 : 1 })}
								value={row.sign === 1 ? "1" : "-1"}
							>
								<option value="1">Add</option>
								<option value="-1">Subtract</option>
							</select>
						</label>
						<label className="min-w-[180px] flex-1" htmlFor={`${row.id}-value`}>
							<span className="sr-only">Duration</span>
							<input
								className={fieldClassName}
								id={`${row.id}-value`}
								onChange={(event) => update(row.id, { text: event.target.value })}
								placeholder="1:30, 45m, 2h 15m"
								value={row.text}
							/>
						</label>
						<button
							className="min-h-11 cursor-pointer border border-line bg-surface px-3 text-xs text-[#54554e] hover:border-[#5f6259] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => setRows((current) => (current.length > 1 ? current.filter((item) => item.id !== row.id) : current))}
							type="button"
						>
							Remove
						</button>
					</div>
				))}
				<button
					className={`${primaryButtonClassName} self-start`}
					onClick={() => {
						nextId += 1;
						setRows((current) => [...current, { id: `row-${nextId}`, text: "", sign: 1 }]);
					}}
					type="button"
				>
					Add duration
				</button>
			</div>
			<ErrorNote message={totals.errors.join("\n")} />
			{!totals.errors.length && (
				<>
					<StatGrid
						items={[
							{ label: "Total", value: totals.total },
							{ label: "Clock", value: totals.clock },
							{ label: "Decimal hours", value: totals.decimalHours },
							{ label: "Minutes", value: String(totals.minutes) },
						]}
					/>
					<ResultBlock fileName="durations.txt" rows={10} title="Result" value={report} />
				</>
			)}
			<p className={hintClassName}>
				Accepts <code>1:30</code> (hours:minutes), <code>1:02:03</code>, <code>1h 30m</code>, <code>90m</code>, <code>2.5h</code>, or a bare number of
				minutes. Use Subtract for breaks, or to find the gap between two times. An 8-hour day is shown for timesheet totals.
			</p>
		</ToolPanel>
	);
}
