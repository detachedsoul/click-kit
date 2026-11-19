import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { calculateGpa, formatScale, GRADE_SETS, GPA_SCALES, gradesFor, gpaStanding, gradePoint, parseScale, scaleSummary, simplifyGrade, type GpaCourse } from "@/features/calculators/gpa-utils";
import GpaCalculator from "@/features/calculators/gpa-calculator";

afterEach(cleanup);

const course = (id: string, grade: GpaCourse["grade"], credits: number): GpaCourse => ({ id, name: id, grade, credits });

describe("GPA calculator", () => {
	it("weights grades by credits", () => {
		const result = calculateGpa([course("a", "A", 4), course("b", "B", 2)]);
		expect(result.gpa).toBe(3.67);
		expect(result.credits).toBe(6);
		expect(result.qualityPoints).toBe(22);
		expect(result.courses).toBe(2);
	});

	it("supports the 4.0 and 4.3 scales", () => {
		expect(gradePoint("A+", 4)).toBe(4);
		expect(gradePoint("A+", 4.3)).toBe(4.3);
		expect(calculateGpa([course("a", "A+", 3)], 4).gpa).toBe(4);
		expect(calculateGpa([course("a", "A+", 3)], 4.3).gpa).toBe(4.3);
		expect(gradePoint("F", 4.3)).toBe(0);
	});

	it("supports the 5.0 scale", () => {
		expect(gradePoint("A", 5)).toBe(5);
		expect(gradePoint("B", 5)).toBe(4);
		expect(gradePoint("C", 5)).toBe(3);
		expect(gradePoint("D", 5)).toBe(2);
		expect(gradePoint("F", 5)).toBe(0);
		expect(gradePoint("A-", 5)).toBe(4.7);
		expect(gradePoint("B+", 5)).toBe(4.3);
		expect(calculateGpa([course("a", "A", 3), course("b", "C", 3)], 5).gpa).toBe(4);
		expect(calculateGpa([course("a", "A", 4), course("b", "B", 2)], 5).gpa).toBe(4.67);
		expect(calculateGpa([course("a", "A", 3)], 5).scale).toBe(5);
		expect(gpaStanding(4.5, 5)).toBe("summa cum laude range");
	});

	it("labels and parses each scale", () => {
		expect(GPA_SCALES.map((option) => option.value)).toEqual([5, 4, 4.3]);
		expect(GPA_SCALES.map((option) => formatScale(option.value))).toEqual(["5.0", "4.0", "4.3"]);
		expect(scaleSummary(5)).toBe("A 5.0 · B 4.0 · C 3.0 · D 2.0 · E 1.0 · F 0.0");
		expect(parseScale("5")).toBe(5);
		expect(parseScale("4.3")).toBe(4.3);
		expect(parseScale("nonsense")).toBe(4);
	});

	it("offers plain letters, with E only on the 5.0 scale", () => {
		expect(gradesFor(5, "simple")).toEqual(["A", "B", "C", "D", "E", "F"]);
		expect(gradesFor(4, "simple")).toEqual(["A", "B", "C", "D", "F"]);
		expect(gradesFor(4.3, "simple")).toEqual(["A", "B", "C", "D", "F"]);
		expect(gradesFor(5, "detailed")).toHaveLength(13);
		expect(GRADE_SETS.map((option) => option.id)).toEqual(["simple", "detailed"]);
		expect(simplifyGrade("B+")).toBe("B");
		expect(gradePoint("E", 5)).toBe(1);
		expect(gradePoint("E", 4)).toBe(0);
	});

	it("skips zero-credit courses and reports the spread", () => {
		const result = calculateGpa([course("a", "A", 3), course("pass", "A", 0), course("b", "C", 3)]);
		expect(result.courses).toBe(2);
		expect(result.credits).toBe(6);
		expect(result.gpa).toBe(3);
		expect(result.best?.id).toBe("a");
		expect(result.worst?.id).toBe("b");
		expect(result.breakdown.map((entry) => entry.grade)).toEqual(["A", "C"]);
		expect(() => calculateGpa([])).toThrow(/at least one course/u);
	});

	it("describes standing", () => {
		expect(gpaStanding(3.9, 4)).toBe("summa cum laude range");
		expect(gpaStanding(3.5, 4)).toBe("magna cum laude range");
		expect(gpaStanding(3.25, 4)).toBe("cum laude range");
		expect(gpaStanding(1.9, 4)).toBe("needs improvement");
		expect(gpaStanding(4.2, 4.3)).toBe("summa cum laude range");
	});

	it("starts on the 5.0 scale with plain A–F letters", async () => {
		const user = userEvent.setup();
		render(<GpaCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(screen.getByLabelText("Grading scale")).toHaveProperty("value", "5");
		expect(screen.getByLabelText("Grade letters")).toHaveProperty("value", "simple");
		expect(screen.getByLabelText("Course 1 grade").querySelectorAll("option")).toHaveLength(6);
		expect(output()).toContain("GPA             4.22 / 5.0");
		await user.selectOptions(screen.getByLabelText("Course 3 grade"), "A");
		expect(output()).toContain("GPA             4.67 / 5.0");
		expect(document.body.textContent).toContain("Highest possible GPA is 5.0");
		expect(document.body.textContent).toContain("Nigerian");
	});

	it("switches scale and grade letters, simplifying existing grades", async () => {
		const user = userEvent.setup();
		render(<GpaCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		await user.selectOptions(screen.getByLabelText("Grade letters"), "detailed");
		expect(screen.getByLabelText("Course 1 grade").querySelectorAll("option")).toHaveLength(13);
		await user.selectOptions(screen.getByLabelText("Course 1 grade"), "A-");
		expect(output()).toContain("A- 4 cr  →  4.7 pts");
		await user.selectOptions(screen.getByLabelText("Grading scale"), "4");
		expect(output()).toContain("/ 4.0");
		await user.selectOptions(screen.getByLabelText("Grade letters"), "simple");
		expect(screen.getByLabelText("Course 1 grade")).toHaveProperty("value", "A");
		expect(screen.getByLabelText("Course 1 grade").querySelectorAll("option")).toHaveLength(5);
		expect(output()).toContain("/ 4.0");
	});

	it("starts a fresh semester in one click", async () => {
		const user = userEvent.setup();
		render(<GpaCalculator />);
		await user.click(screen.getByRole("button", { name: "Start a fresh semester" }));
		expect(screen.getAllByLabelText(/^Course \d credits$/u)).toHaveLength(2);
		expect(screen.getByLabelText("Result")).toHaveProperty("value");
	});
});
