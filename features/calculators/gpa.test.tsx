import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { calculateGpa, gpaStanding, gradePoint, type GpaCourse } from "@/features/calculators/gpa-utils";
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

	it("renders and recalculates from the form", async () => {
		const user = userEvent.setup();
		render(<GpaCalculator />);
		const output = () => (screen.getByLabelText("Result") as HTMLTextAreaElement).value;
		expect(output()).toContain("GPA             3.41 / 4");
		await user.selectOptions(screen.getByLabelText("Course 3 grade"), "A");
		expect(output()).toContain("GPA             3.63 / 4");
		await user.selectOptions(screen.getByLabelText("Grading scale"), "4.3");
		expect(output()).toContain("/ 4.3");
	});
});
