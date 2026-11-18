export const gradeOptions = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"] as const;

export type Grade = (typeof gradeOptions)[number];

const fourPoint: Record<Grade, number> = {
	"A+": 4,
	A: 4,
	"A-": 3.7,
	"B+": 3.3,
	B: 3,
	"B-": 2.7,
	"C+": 2.3,
	C: 2,
	"C-": 1.7,
	"D+": 1.3,
	D: 1,
	"D-": 0.7,
	F: 0,
};

const fourThreePoint: Record<Grade, number> = { ...fourPoint, "A+": 4.3 };

export type GpaScale = 4 | 4.3;

export const gradePoint = (grade: Grade, scale: GpaScale = 4) => (scale === 4.3 ? fourThreePoint : fourPoint)[grade];

export type GpaCourse = { id: string; name: string; grade: Grade; credits: number };

export type GpaResult = {
	gpa: number;
	scale: GpaScale;
	qualityPoints: number;
	credits: number;
	courses: number;
	best: GpaCourse | null;
	worst: GpaCourse | null;
	breakdown: { grade: Grade; courses: number; credits: number; points: number }[];
};

export const calculateGpa = (courses: GpaCourse[], scale: GpaScale = 4): GpaResult => {
	const counted = courses.filter((course) => Number.isFinite(course.credits) && course.credits > 0);
	if (!counted.length) throw new Error("Add at least one course with credit hours.");
	const byGrade = new Map<Grade, { courses: number; credits: number; points: number }>();
	let credits = 0;
	let qualityPoints = 0;
	for (const course of counted) {
		const points = gradePoint(course.grade, scale);
		credits += course.credits;
		qualityPoints += points * course.credits;
		const entry = byGrade.get(course.grade) ?? { courses: 0, credits: 0, points: 0 };
		entry.courses += 1;
		entry.credits += course.credits;
		entry.points += points * course.credits;
		byGrade.set(course.grade, entry);
	}
	const sorted = [...counted].sort((left, right) => gradePoint(right.grade, scale) - gradePoint(left.grade, scale));
	return {
		gpa: Math.round((qualityPoints / credits) * 100) / 100,
		scale,
		qualityPoints: Math.round(qualityPoints * 100) / 100,
		credits,
		courses: counted.length,
		best: sorted[0] ?? null,
		worst: sorted[sorted.length - 1] ?? null,
		breakdown: [...byGrade.entries()]
			.map(([grade, entry]) => ({ grade, ...entry }))
			.sort((left, right) => gradePoint(right.grade, scale) - gradePoint(left.grade, scale)),
	};
};

export const gpaStanding = (gpa: number, scale: GpaScale = 4) => {
	const ratio = gpa / scale;
	if (ratio >= 0.9) return "summa cum laude range";
	if (ratio >= 0.85) return "magna cum laude range";
	if (ratio >= 0.8) return "cum laude range";
	if (ratio >= 0.7) return "good standing";
	if (ratio >= 0.6) return "satisfactory";
	return "needs improvement";
};
