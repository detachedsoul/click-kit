"use client";

import { useMemo, useState } from "react";
import { ErrorNote, ResultBlock, StatGrid, ToolPanel, fieldClassName, hintClassName, labelClassName, primaryButtonClassName, selectClassName } from "@/features/developer-tools/tool-ui";
import {
	calculateGpa,
	formatScale,
	GRADE_SETS,
	GPA_SCALES,
	gradePoint,
	gradesFor,
	gpaStanding,
	parseScale,
	scaleSummary,
	simplifyGrade,
	type GpaCourse,
	type GpaScale,
	type Grade,
	type GradeSet,
} from "@/features/calculators/gpa-utils";

const starterCourses: GpaCourse[] = [
	{ id: "course-1", name: "Calculus I", grade: "A", credits: 4 },
	{ id: "course-2", name: "World history", grade: "B", credits: 3 },
	{ id: "course-3", name: "Chemistry lab", grade: "C", credits: 2 },
];

let nextCourse = starterCourses.length + 1;

export default function GpaCalculator() {
	const [courses, setCourses] = useState<GpaCourse[]>(starterCourses);
	const [scale, setScale] = useState<GpaScale>(5);
	const [gradeSet, setGradeSet] = useState<GradeSet>("simple");
	const choices = useMemo(() => gradesFor(scale, gradeSet), [gradeSet, scale]);
	const result = useMemo(() => {
		try {
			return { value: calculateGpa(courses, scale), error: "" };
		} catch (error) {
			return { value: null, error: error instanceof Error ? error.message : "Could not calculate this GPA." };
		}
	}, [courses, scale]);
	const update = (id: string, patch: Partial<GpaCourse>) => setCourses((current) => current.map((course) => (course.id === id ? { ...course, ...patch } : course)));
	const chooseGradeSet = (next: GradeSet) => {
		setGradeSet(next);
		// Keep every course on a letter the new set actually offers.
		if (next === "simple") setCourses((current) => current.map((course) => ({ ...course, grade: simplifyGrade(course.grade) })));
	};
	const report = useMemo(() => {
		if (!result.value) return "";
		const { gpa, qualityPoints, credits, courses: count, breakdown } = result.value;
		return [
			...courses
				.filter((course) => course.credits > 0)
				.map((course) => `${(course.name || "Course").padEnd(16)} ${course.grade.padEnd(2)} ${course.credits} cr  →  ${gradePoint(course.grade, scale).toFixed(1)} pts`),
			"",
			`GPA             ${gpa.toFixed(2)} / ${formatScale(scale)}`,
			`Scale           ${formatScale(scale)} — ${scaleSummary(scale, gradeSet)}`,
			`Grade letters   ${GRADE_SETS.find((option) => option.id === gradeSet)?.label ?? gradeSet}`,
			`Total points    ${qualityPoints}`,
			`Credits         ${credits}`,
			`Courses         ${count}`,
			`Standing        ${gpaStanding(gpa, scale)}`,
			"",
			"By grade",
			...breakdown.map((entry) => `${entry.grade.padEnd(3)} ${entry.courses} course${entry.courses === 1 ? "" : "s"} · ${entry.credits} credits · ${entry.points.toFixed(1)} points`),
		].join("\n");
	}, [courses, gradeSet, result, scale]);

	return (
		<ToolPanel>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<label className={labelClassName} htmlFor="gpa-scale">
						Grading scale
						<select className={selectClassName} id="gpa-scale" onChange={(event) => setScale(parseScale(event.target.value))} value={scale}>
							{GPA_SCALES.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<p className="m-0 text-[11px] leading-[1.55] text-muted">
						{GPA_SCALES.find((option) => option.value === scale)?.note} Highest possible GPA is {formatScale(scale)}.
					</p>
				</div>
				<div className="flex flex-col gap-1.5">
					<label className={labelClassName} htmlFor="gpa-grade-set">
						Grade letters
						<select
							className={selectClassName}
							id="gpa-grade-set"
							onChange={(event) => chooseGradeSet(event.target.value === "detailed" ? "detailed" : "simple")}
							value={gradeSet}
						>
							{GRADE_SETS.map((option) => (
								<option key={option.id} value={option.id}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<p className="m-0 text-[11px] leading-[1.55] text-muted">{GRADE_SETS.find((option) => option.id === gradeSet)?.note}</p>
				</div>
			</div>

			<p className="m-0 border border-line bg-[#f8f7f3] px-3 py-2 font-mono text-[11px] leading-[1.6] text-[#3c3d37]">
				{scaleSummary(scale, gradeSet)}
			</p>

			<div className="flex flex-col gap-3">
				<div className="grid items-center gap-2 font-mono text-[10px] uppercase tracking-[.08em] text-muted sm:grid-cols-[minmax(0,1.6fr)_6.5rem_6rem_auto]">
					<span>Course</span>
					<span>Grade</span>
					<span>Credit hours</span>
					<span aria-hidden="true" />
				</div>
				{courses.map((course, index) => (
					<div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1.6fr)_6.5rem_6rem_auto]" key={course.id}>
						<label htmlFor={`${course.id}-name`}>
							<span className="sr-only">{`Course ${index + 1} name`}</span>
							<input
								className={fieldClassName}
								id={`${course.id}-name`}
								onChange={(event) => update(course.id, { name: event.target.value })}
								placeholder="Course name"
								value={course.name}
							/>
						</label>
						<label htmlFor={`${course.id}-grade`}>
							<span className="sr-only">{`Course ${index + 1} grade`}</span>
							<select
								className={selectClassName}
								id={`${course.id}-grade`}
								onChange={(event) => update(course.id, { grade: event.target.value as Grade })}
								value={course.grade}
							>
								{choices.map((grade) => (
									<option key={grade} value={grade}>
										{grade} ({gradePoint(grade, scale).toFixed(1)})
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
				<div className="flex flex-wrap gap-2">
					<button
						className={primaryButtonClassName}
						onClick={() => {
							nextCourse += 1;
							setCourses((current) => [...current, { id: `course-${nextCourse}`, name: "", grade: "A", credits: 3 }]);
						}}
						type="button"
					>
						Add course
					</button>
					<button
						className="inline-flex min-h-10 cursor-pointer items-center border border-line bg-surface px-4 text-xs text-ink hover:border-[#5f6259] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						onClick={() =>
							setCourses([
								{ id: "course-1", name: "", grade: "A", credits: 3 },
								{ id: "course-2", name: "", grade: "A", credits: 3 },
							])
						}
						type="button"
					>
						Start a fresh semester
					</button>
				</div>
			</div>

			<ErrorNote message={result.error} />
			{result.value && (
				<>
					<StatGrid
						items={[
							{ label: "GPA", value: `${result.value.gpa.toFixed(2)} / ${formatScale(scale)}` },
							{ label: "Credits", value: String(result.value.credits) },
							{ label: "Total points", value: String(result.value.qualityPoints) },
							{ label: "Standing", value: gpaStanding(result.value.gpa, scale) },
						]}
					/>
					<ResultBlock fileName="gpa-report.txt" rows={16} title="Result" value={report} />
				</>
			)}
			<p className={hintClassName}>
				GPA is credit-weighted: each grade&apos;s points are multiplied by the course credits and divided by the total credits. A three-credit A and a
				two-credit C, for example, average out the same way your school computes it. Courses with zero credits are ignored, so pass/fail classes do not drag
				the average down.
			</p>
		</ToolPanel>
	);
}
