"use client";

import { useMemo, useState } from "react";
import { dateDifference, monthDifference } from "@/features/calculators/date-diff-utils";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName } from "@/features/developer-tools/tool-ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function DateDiffCalculator() {
	const [start, setStart] = useState("2024-01-01");
	const [end, setEnd] = useState(today());
	const [includeEnd, setIncludeEnd] = useState(false);
	const result = useMemo(() => {
		try {
			return { report: dateDifference(start, end, { includeEnd }), months: monthDifference(start, end), error: "" };
		} catch (error) {
			return { report: null, months: 0, error: error instanceof Error ? error.message : "Could not compare these dates." };
		}
	}, [start, end, includeEnd]);
	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-3">
				<label className={labelClassName} htmlFor="date-diff-start">
					Start date
					<input className={fieldClassName} id="date-diff-start" onChange={(event) => setStart(event.target.value)} type="date" value={start} />
				</label>
				<label className={labelClassName} htmlFor="date-diff-end">
					End date
					<input className={fieldClassName} id="date-diff-end" onChange={(event) => setEnd(event.target.value)} type="date" value={end} />
				</label>
				<label className="flex items-center gap-2 self-end text-xs font-semibold text-[#3c3d37]" htmlFor="date-diff-include">
					<input checked={includeEnd} id="date-diff-include" onChange={(event) => setIncludeEnd(event.target.checked)} type="checkbox" />
					Count the end date as a full day
				</label>
			</div>
			<ErrorNote message={result.error} />
			{result.report && (
				<>
					<StatGrid
						items={[
							{ label: "Calendar days", value: String(result.report.days) },
							{ label: "Working days", value: String(result.report.businessDays) },
							{ label: "Weekend days", value: String(result.report.weekendDays) },
							{ label: "Whole months", value: String(Math.abs(result.months)) },
						]}
					/>
					<ResultBlock
						title="Result"
						value={[
							`From ${start} to ${end}${result.report.swapped ? " (dates were reversed)" : ""}`,
							`Calendar    ${result.report.days} days (${result.report.weeks} weeks ${result.report.remainderDays} days)`,
							`Breakdown   ${result.report.breakdown}`,
							`Working     ${result.report.weekdaysBreakdown}`,
							`Months      ${Math.abs(result.months)} whole months`,
							`Approximate ${(result.report.days / 7).toFixed(1)} weeks · ${(result.report.days / 30.4375).toFixed(1)} months · ${(result.report.days / 365.25).toFixed(2)} years`,
						].join("\n")}
						rows={8}
						fileName="date-difference.txt"
					/>
				</>
			)}
			<p className={hintClassName}>
				Working days are Monday to Friday and ignore public holidays. The end date is excluded by default, so a Monday-to-Friday range is 4 working
				days; switch on the checkbox to count it as 5.
			</p>
		</ToolPanel>
	);
}
