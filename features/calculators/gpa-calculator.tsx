"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import { calculateGpa, gpaStanding, gradeOptions, gradePoint, type GpaCourse, type GpaScale, type Grade } from "@/features/calculators/gpa-utils";

const starterCourses: GpaCourse[] = [
	{ id: "course-1", name: "Calculus I", grade: "A-", credits: 4 },
	{ id: "course-2", name: "World history", grade: "B+", credits: 3 },
	{ id: "course-3", name: "Chemistry lab", grade: "B", credits: 2 },
];

let nextCourse = starterCourses.length + 1;

export default function GpaCalculator() {
	const [courses, setCourses] = useState<GpaCourse[]>(starterCourses);
	const [scale, setScale] = useState<GpaScale>(4);
	const result = useMemo(() => {
		try {
			return { value: calculateGpa(courses, scale), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Could not calculate this GPA." };
		}
	}, [courses, scale]);
	const update = (id: string, patch: Partial<GpaCourse>) => setCourses((current) => current.map((course) => (course.id === id ? { ...course, ...patch } : course)));
	const report = useMemo(() => {
		if (!result.value) return "";
		const { gpa, qualityPoints, credits, courses: count, breakdown } = result.value;
		return [
			...courses
				.filter((course) => course.credits > 0)
				.map((course) => `${course.name || "Course"}  ${course.grade}  ${course.credits} cr  →  ${gradePoint(course.grade, scale).toFixed(1)} pts`),
			"",
			`GPA             ${gpa.toFixed(2)} / ${scale}`,
			`Quality points  ${qualityPoints}`,
			`Credits         ${credits}`,
			`Courses         ${count}`,
			`Standing        ${gpaStanding(gpa, scale)}`,
			"",
			"By grade",
			...breakdown.map((entry) => `${entry.grade.padEnd(3)} ${entry.courses} course${entry.courses === 1 ? "" : "s"} · ${entry.credits} credits · ${entry.points.toFixed(1)} points`),
		].join("\n");
	}, [courses, result, scale]);
	return (
		<ToolPanel>
			<label className={labelClassName} htmlFor="gpa-scale">
				Grading scale
				<select className={selectClassName} id="gpa-scale" onChange={(event) => setScale(Number(event.target.value) === 4.3 ? 4.3 : 4)} value={scale}>
					<option value="4">4.0 scale (A+ = 4.0)</option>
					<option value="4.3">4.3 scale (A+ = 4.3)</option>
				</select>
			</label>
			<div className="flex flex-col gap-3">
				<span className={labelClassName}>Courses</span>
				{courses.map((course, index) => (
					<div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.6fr)_6.5rem_6rem_auto]" key={course.id}>
						<label htmlFor={`${course.id}-name`}>
							<span className="sr-only">{`Course ${index + 1} name`}</span>
							<input className={fieldClassName} id={`${course.id}-name`} onChange={(event) => update(course.id, { name: event.target.value })} placeholder="Course name" value={course.name} />
						</label>
						<label htmlFor={`${course.id}-grade`}>
							<span className="sr-only">{`Course ${index + 1} grade`}</span>
							<select className={selectClassName} id={`${course.id}-grade`} onChange={(event) => update(course.id, { grade: event.target.value as Grade })} value={course.grade}>
								{gradeOptions.map((grade) => (
									<option key={grade} value={grade}>
										{grade} ({gradePoint(grade, scale)})
									</option>
								))}
							</select>
						</label>
						<label htmlFor={`${course.id}-credits`}>
							<span className="sr-only">{`Course ${index + 1} credits`}</span>
							<input
								className={fieldClassName}
								id={`${course.id}-credits`}
								min="0"
								onChange={(event) => update(course.id, { credits: Number(event.target.value) })}
								step="0.5"
								type="number"
								value={Number.isFinite(course.credits) ? course.credits : ""}
							/>
						</label>
						<button
							className="min-h-11 cursor-pointer border border-line bg-surface px-3 text-xs text-[#54554e] hover:border-[#5f6259] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							onClick={() => setCourses((current) => (current.length > 1 ? current.filter((item) => item.id !== course.id) : current))}
							type="button"
						>
							Remove
						</button>
					</div>
				))}
				<button
					className={`${primaryButtonClassName} self-start`}
					onClick={() => {
						nextCourse += 1;
						setCourses((current) => [...current, { id: `course-${nextCourse}`, name: "", grade: "A", credits: 3 }]);
					}}
					type="button"
				>
					Add course
				</button>
			</div>
			<ErrorNote message={result.error} />
			{result.value && (
				<>
					<StatGrid
						items={[
							{ label: "GPA", value: `${result.value.gpa.toFixed(2)} / ${scale}` },
							{ label: "Credits", value: String(result.value.credits) },
							{ label: "Quality points", value: String(result.value.qualityPoints) },
							{ label: "Standing", value: gpaStanding(result.value.gpa, scale) },
						]}
					/>
					<ResultBlock fileName="gpa-report.txt" rows={14} title="Result" value={report} />
				</>
			)}
			<p className={hintClassName}>
				GPA is credit-weighted: each grade&apos;s points are multiplied by the course credits and divided by the total credits. Courses with zero credits are
				ignored, so pass/fail classes do not drag the average down.
			</p>
		</ToolPanel>
	);
}
